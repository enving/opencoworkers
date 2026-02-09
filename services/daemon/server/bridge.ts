import { EventEmitter } from "events";
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import EventSource from 'eventsource';
import { createOpencodeClient } from '@opencode-ai/sdk';
import { AuditLogger } from '../orchestration/audit-trail.js';
import { MemoryService } from '../memory/memory-service.js';
import { SkillRegistry } from '../skills/registry.js';
import { SecretsManager } from '../secrets/secrets-manager.js';
import { PromptBuilder } from '../openclaw-adapters/prompt-builder.js';
import { SSEClient } from './sse-client.js';
import { Task } from '../types/tasks.js';

export interface ServerBridgeConfig {
  baseUrl: string;
  directory: string;
  password?: string;
  memoryDir?: string;
}

export class OpenCodeServerBridge extends EventEmitter {
  private client: any;
  private auditLogger: AuditLogger;
  private memoryService: MemoryService;
  private eventStream: any = null;

  private config: ServerBridgeConfig;
  private skillRegistry: SkillRegistry;
  private secretsManager: SecretsManager; // Feature: Secrets Management

  private currentThoughtId: string | null = null;
  private currentThoughtContent: string = "";
  private sessionTaskMap: Map<string, string> = new Map();

  constructor(config: ServerBridgeConfig) {
    super();
    this.config = config;

    const headers: Record<string, string> = {};
    if (config.password) {
      const auth = Buffer.from(`opencode:${config.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    this.client = createOpencodeClient({
      baseUrl: config.baseUrl,
      directory: config.directory,
      headers
    });
    this.auditLogger = new AuditLogger();
    this.memoryService = new MemoryService(config.memoryDir);

    // Initialize Skill Registry
    const repoRoot = path.resolve(process.cwd());
    this.skillRegistry = new SkillRegistry(path.join(repoRoot, 'vendor', 'openclaw'));

    // Initialize Secrets Manager
    this.secretsManager = new SecretsManager();
  }

  // ...

  async triggerTaskExecution(task: Task, semanticContext?: string, skillInstruction?: string): Promise<string | null> {
    if (!task.skill) {
      console.warn(`[ServerBridge] Task ${task.id} has no skill assigned, skipping execution.`);
      return null;
    }

    console.log(`[ServerBridge] Triggering execution for ${task.id} using skill /${task.skill} on ${this.config.baseUrl}`);

    try {
      await this.auditLogger.logAction({
        agentId: 'server-bridge',
        taskId: task.id,
        action: 'trigger-agent',
        details: { skill: task.skill },
        result: 'pending'
      });

      const createResult = await this.client.session.create({
        body: {
          title: `PM Sync: ${task.title}`
        }
      });

      if (createResult.error) {
        throw new Error(`Failed to create session: ${JSON.stringify(createResult.error)}`);
      }

      const session = createResult.data;
      const agentId = 'general';
      this.sessionTaskMap.set(session.id, task.id);

      // Feature: OpenClaw Skill Injection
      let skillsPrompt = '';
      try {
        await this.skillRegistry.scan();
        skillsPrompt = this.skillRegistry.getSkillsPromptSnippet();
        console.log(`[ServerBridge] Injected ${skillsPrompt.length} chars of skill context.`);
      } catch (e) {
        console.warn('[ServerBridge] Failed to inject skills', e);
      }

      // Feature: Identity / Persona (SOUL.md)
      // Check for SOUL.md in various locations
      let soulContent = '';
      try {
        const soulPaths = [
          path.join(this.config.directory, 'SOUL.md'),
          path.join(this.config.directory, '.agent-config', 'SOUL.md'),
          path.join(this.config.directory, 'soul.md')
        ];

        for (const p of soulPaths) {
          try {
            await fs.access(p);
            soulContent = await fs.readFile(p, 'utf-8');
            console.log(`[ServerBridge] Loaded Persona from ${p}`);
            break;
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.warn(`[ServerBridge] Failed to load SOUL.md:`, err);
      }

      // Feature: Secrets Management
      const availableSecrets = this.secretsManager ? this.secretsManager.getAvailableSecrets() : [];
      if (this.secretsManager) {
        console.log(`[ServerBridge] Injecting ${availableSecrets.length} available secrets into prompt.`);
      }

      // Feature: Prompt Building (OpenClaw Brain)
      const promptBuilder = new PromptBuilder(this.skillRegistry);
      const systemPrompt = await promptBuilder.buildSystemPrompt({
        workspaceDir: '/workspace', // Default for OpenCode container
        skillsPrompt,
        soulContent,
        availableSecrets
      });
      // TASK-177: Persona Prompt Injection (Legacy - will be moved to PromptBuilder)
      let personaPrompt = '';
      if ((task as any).persona) {
        // ... existing logic ...
      }

      // ... existing context logic ...

      const skillInstructionText = skillInstruction || (task.skill ? `\n\n[Skill: ${task.skill}]` : '');
      const contextPrefix = (task as any).refinement_context ? `${(task as any).refinement_context}\n\n---\n\n` : '';
      const toolsContext = semanticContext ? `${semanticContext}\n\n---\n\n` : '';
      const pathsContext = ''; // TODO: Move to PromptBuilder

      // Combine System Prompt with Task Prompt
      const fullPrompt = `${systemPrompt}\n\n${personaPrompt}${contextPrefix}${toolsContext}${pathsContext}Task: ${task.title}\n\nDescription:\n${task.description || 'No description provided.'}${skillInstructionText}`;

      this.client.session.prompt({
        path: { id: session.id },
        body: {
          agent: agentId,
          parts: [{
            type: "text",
            text: fullPrompt
          }]
        }

      }).catch((err: any) => {
        console.error(`[ServerBridge] Background prompt failed for ${task.id}:`, err);
      });

      this.subscribeToEvents();
      return session.id;
    } catch (err) {
      console.error(`[ServerBridge] Failed to trigger task ${task.id}:`, err);
      return null;
    }
  }

  async init(): Promise<void> {
    await this.memoryService.init();
  }

  async subscribeToEvents() {
    if (this.eventStream) return;

    try {
      console.log(`[ServerBridge] Connecting to SSE at ${this.config.baseUrl}/global/event`);

      let url = `${this.config.baseUrl}/api/events`;
      const esOptions: any = {};

      if (this.config.password) {
        // Strip credentials from URL if present (redundant if using headers)
        try {
          const urlObj = new URL(url);
          if (urlObj.username || urlObj.password) {
            urlObj.username = '';
            urlObj.password = '';
            url = urlObj.toString();
          }
        } catch (e) { /* ignore */ }

        if (this.config.password) {
          const auth = Buffer.from(`opencode:${this.config.password}`).toString('base64');
          esOptions.headers = { 'Authorization': `Basic ${auth}` };
        }
      }

      const es = new SSEClient(url, esOptions);
      this.eventStream = es;

      es.on('message', async (e: any) => {
        try {
          if (!e.data) return;
          const rawEvent = JSON.parse(e.data);
          const event = rawEvent.payload || rawEvent;

          if (!event.type) return;
          console.log(`[ServerBridge] Incoming event type: ${event.type}`);
          this.emit("event", event);

          if (event.type === "permission.asked") {
            const { requestID, tool, permission, sessionID } = event.properties;
            const target = tool || permission;
            const taskId = this.sessionTaskMap.get(sessionID) || "unknown";

            console.log(`[ServerBridge] Permission asked:`, JSON.stringify(event.properties));

            await this.auditLogger.logAction({
              agentId: 'server-bridge',
              taskId,
              thoughtId: this.currentThoughtId || undefined,
              action: 'permission_asked',
              details: { tool: target, requestID, sessionID },
              result: 'pending'
            });

            this.emit("permission_asked", event.properties);

            const safeTools = ['external_directory', 'file_read', 'file_write', 'bash', 'glob', 'read', 'write'];

            if (safeTools.includes(target)) {
              console.log(`[ServerBridge] Auto-approving ${target} (Request: ${requestID})`);
              try {
                await this.client.permission.reply({
                  path: { requestID },
                  body: { reply: 'always' }
                });

                await this.auditLogger.logAction({
                  agentId: 'server-bridge',
                  taskId,
                  thoughtId: this.currentThoughtId || undefined,
                  action: 'permission_granted',
                  details: { tool: target, requestID, sessionID, type: 'auto' },
                  result: 'success'
                });
              } catch (replyErr) {
                console.error(`[ServerBridge] Failed to reply to permission ${requestID}:`, replyErr);
              }
            }
          } else if (event.type === "message.part.updated") {
            const { part, sessionID } = event.properties;

            // Detect thinking parts or text containing <think>
            let isThinking = part.type === "thinking" || part.type === "reasoning";
            let content = part.text || "";

            // Handle models that wrap thinking in <think> tags within a text part
            if (part.type === "text" && content.includes("<think>")) {
              isThinking = true;
            }

            if (isThinking) {
              if (!this.currentThoughtId) {
                this.currentThoughtId = uuidv4();
                this.currentThoughtContent = "";
              }

              // Strip tags if present
              const cleanContent = content.replace(/<\/?think>/g, "");
              this.currentThoughtContent += cleanContent;

              this.emit("thought_updated", {
                sessionId: sessionID,
                taskId: this.sessionTaskMap.get(sessionID) || "unknown",
                thoughtId: this.currentThoughtId,
                content: this.currentThoughtContent,
                isComplete: false
              });
            } else if (this.currentThoughtId && part.type === "text" && content.trim().length > 0) {
              // If we have a thought ID and we see non-thinking text, the thought is likely done
              this.emit("thought_updated", {
                sessionId: sessionID,
                taskId: this.sessionTaskMap.get(sessionID) || "unknown",
                thoughtId: this.currentThoughtId,
                content: this.currentThoughtContent,
                isComplete: true
              });
              // We keep this.currentThoughtId for Action Provenance (Task 3)
            }

            this.emit("message_part_updated", event.properties);
          } else if (event.type === "session.idle") {
            const sessionID = event.properties.sessionID;
            this.currentThoughtId = null;
            this.currentThoughtContent = "";
            this.sessionTaskMap.delete(sessionID);
            await this.captureMemory(sessionID);
          }
        } catch (err) {
          console.error('[ServerBridge] Error processing SSE event:', err);
        }
      });

      es.on('error', (err: any) => {
        console.error("[ServerBridge] SSE error:", err);
        es.close();
        this.eventStream = null;
        setTimeout(() => this.subscribeToEvents(), 5000);
      });

    } catch (err) {
      console.error("[ServerBridge] SSE setup failed:", err);
      this.eventStream = null;
      setTimeout(() => this.subscribeToEvents(), 5000);
    }
  }

  private async captureMemory(sessionId: string): Promise<void> {
    try {
      const messagesResult = await this.client.session.messages({
        path: { id: sessionId }
      });
      if (messagesResult.error || !messagesResult.data || messagesResult.data.length === 0) return;

      const messages = messagesResult.data;
      const sessionResult = await this.client.session.get({
        path: { id: sessionId }
      });
      if (sessionResult.error || !sessionResult.data) return;

      const session = sessionResult.data;
      const taskIdMatch = session.title?.match(/TASK-\d+/);
      const taskId = taskIdMatch ? taskIdMatch[0] : 'unknown';

      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        await this.memoryService.store({
          taskId,
          agentId: lastMessage.agent || 'unknown',
          category: 'task-outcome',
          content: lastMessage.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n'),
          tags: ['automated-capture', taskId]
        });
      }
    } catch (err) {
      console.error(`[ServerBridge] Failed to capture memory for session ${sessionId}:`, err);
    }
  }

  async getSessionMessages(sessionId: string): Promise<any[]> {
    try {
      const messagesResult = await this.client.session.messages({
        path: { id: sessionId }
      });
      if (messagesResult.error || !messagesResult.data) {
        return [];
      }
      return messagesResult.data;
    } catch (err) {
      console.error(`[ServerBridge] Failed to get messages for session ${sessionId}:`, err);
      return [];
    }
  }

  async replyToPermission(requestId: string, reply: "once" | "always" | "reject") {
    try {
      console.warn(`[ServerBridge] Cannot reply '${reply}' to permission ${requestId} - missing session ID context.`);
      return false;
    } catch (err) {
      console.error(`[ServerBridge] Failed to reply to permission ${requestId}:`, err);
      return false;
    }
  }



  async registerMcpServer(name: string, config: any): Promise<boolean> {
    try {
      console.log(`[ServerBridge] Registering MCP Server: ${name}`);
      // The SDK might not have .mcp.add exposed clearly, so we use raw fetch to /mcp
      const headers: any = { 'Content-Type': 'application/json' };
      if (this.config.password) {
        const auth = Buffer.from(`opencode:${this.config.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      const res = await fetch(`${this.config.baseUrl}/mcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, config })
      });

      if (!res.ok) {
        const txt = await res.text();
        console.warn(`[ServerBridge] Failed to register MCP ${name}: ${res.status} ${txt}`);
        return false;
      }
      return true;
    } catch (err) {
      console.error(`[ServerBridge] Error registering MCP ${name}:`, err);
      return false;
    }
  }

  async getMcpServers(): Promise<any> {
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (this.config.password) {
        const auth = Buffer.from(`opencode:${this.config.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      const res = await fetch(`${this.config.baseUrl}/mcp`, { headers });
      if (res.ok) {
        return await res.json();
      }
      return {};
    } catch (err) {
      console.error('[ServerBridge] Failed to fetch MCP servers:', err);
      return {};
    }
  }

  async * getSessionStream(sessionId: string): AsyncGenerator<any> {
    let url = `${this.config.baseUrl}/global/event`;
    if (this.config.password) {
      const urlObj = new URL(url);
      urlObj.username = 'opencode';
      urlObj.password = this.config.password;
      url = urlObj.toString();
    }
    const es = new EventSource(url);

    try {
      for await (const e of (es as any)) {
        const rawEvent = JSON.parse(e.data);
        const event = rawEvent.payload || rawEvent;
        if (event.type === "message.part.updated" && event.properties.part.sessionID === sessionId) {
          yield event.properties;
        } else if (event.type === "session.idle" && event.properties.sessionID === sessionId) {
          break;
        }
      }
    } finally {
      es.close();
    }
  }

  async getSessionStatus(sessionId: string): Promise<string> {
    try {
      const statusResult = await this.client.session.status();
      if (!statusResult.error && statusResult.data && statusResult.data[sessionId]) {
        return statusResult.data[sessionId].type;
      }

      const sessionResult = await this.client.session.get({
        path: { id: sessionId }
      });

      if (sessionResult.error || !sessionResult.data) {
        return 'not_found';
      }

      return 'idle';
    } catch (err) {
      console.error('[ServerBridge] Failed to fetch session status:', err);
      return 'unknown';
    }
  }

  async getArtifacts(_sessionId: string): Promise<string[]> {
    try {
      const result = await this.client.file.list({
        path: '.'
      });

      if (result.error || !result.data) return [];

      return result.data
        .filter((item: any) => item.type === 'file' && !item.name.startsWith('.') && !item.name.endsWith('.py'))
        .map((item: any) => item.name);
    } catch (err) {
      console.error('[ServerBridge] Failed to list artifacts:', err);
      return [];
    }
  }

  async getFileContent(_sessionId: string, fileName: string): Promise<Buffer | null> {
    try {
      // Use raw fetch instead of SDK to avoid validation issues
      const headers: any = {};
      if (this.config.password) {
        const auth = Buffer.from(`opencode:${this.config.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      // Try reading via /api/files/read endpoint directly
      // Note: The OpenCode server API for reading might be /api/files/read?path=...
      const url = `${this.config.baseUrl}/api/files/read?path=${encodeURIComponent(fileName)}`;

      const response = await fetch(url, { headers });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }

      // Fallback to SDK if raw fetch fails (though SDK was failing too)
      console.warn(`[ServerBridge] Raw fetch failed for ${fileName} (${response.status}), trying SDK...`);

      const result = await this.client.file.read({
        path: fileName
      });

      if (result.error || !result.data) {
        console.error(`[ServerBridge] SDK read failed for ${fileName}:`, result.error);
        return null;
      }

      const rawData = result.data as any;
      if (rawData.content !== undefined) {
        return Buffer.from(rawData.content, 'base64');
      }

      if (typeof rawData === 'string') {
        return Buffer.from(rawData, 'base64');
      }

      return null;
    } catch (err) {
      console.error(`[ServerBridge] Error fetching file content for ${fileName}:`, err);
      return null;
    }
  }

  async getActiveSessionsCount(): Promise<number> {
    try {
      const result = await this.client.session.status();
      if (result.error || !result.data) return 0;

      const statuses = Object.values(result.data);
      return statuses.filter((s: any) => s.type === 'busy' || s.type === 'retry').length;
    } catch (err) {
      console.error('[ServerBridge] Failed to fetch active sessions count:', err);
      return 0;
    }
  }

  async getConfig(): Promise<any> {
    try {
      const headers: any = { 'Accept': 'application/json' };
      if (this.config.password) {
        const auth = Buffer.from(`opencode:${this.config.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      const response = await fetch(`${this.config.baseUrl}/config`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      console.error('[ServerBridge] Failed to get config:', err);
      throw err;
    }
  }

  async updateConfig(newConfig: any): Promise<any> {
    try {
      const headers: any = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
      if (this.config.password) {
        const auth = Buffer.from(`opencode:${this.config.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      const response = await fetch(`${this.config.baseUrl}/config`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(newConfig)
      });

      if (!response.ok) {
        throw new Error(`Failed to update config: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      console.error('[ServerBridge] Failed to update config:', err);
      throw err;
    }
  }

  /**
   * Send a chat message and get a response (FEAT-CHAT)
   * Uses OpenCode's session API to create a chat session and get responses
   */
  async sendChatMessage(
    messages: Array<{ role: string; content: string }>,
    options: {
      model?: string;
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<{
    content: string;
    tokens?: { prompt: number; completion: number };
    thinking?: string;
  }> {
    try {
      // Create a chat session
      const createResult = await this.client.session.create({
        body: {
          title: 'Chat Session'
        }
      });

      if (createResult.error) {
        throw new Error(`Failed to create chat session: ${JSON.stringify(createResult.error)}`);
      }

      const session = createResult.data;

      // Build the prompt from messages
      // Combine system prompt if provided
      let fullPrompt = '';

      if (options.systemPrompt) {
        fullPrompt += `${options.systemPrompt}\n\n`;
      }

      // Add conversation history
      for (const msg of messages) {
        if (msg.role === 'system') {
          fullPrompt += `${msg.content}\n\n`;
        } else if (msg.role === 'user') {
          fullPrompt += `User: ${msg.content}\n\n`;
        } else if (msg.role === 'assistant') {
          fullPrompt += `Assistant: ${msg.content}\n\n`;
        }
      }

      // Send the prompt
      const promptResult = await this.client.session.prompt({
        path: { id: session.id },
        body: {
          agent: 'general',
          parts: [{
            type: 'text',
            text: fullPrompt
          }]
        }
      });

      if (promptResult.error) {
        throw new Error(`Failed to send prompt: ${JSON.stringify(promptResult.error)}`);
      }

      // Wait for the response to complete
      // Poll for session idle status
      let attempts = 0;
      const maxAttempts = 120; // 2 minutes max wait

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;

        const status = await this.getSessionStatus(session.id);
        if (status === 'idle' || status === 'not_found') {
          break;
        }
      }

      // Get the response messages
      const messagesResult = await this.client.session.messages({
        path: { id: session.id }
      });

      if (messagesResult.error || !messagesResult.data) {
        throw new Error('Failed to get chat response');
      }

      // Find the last assistant message
      const responseMessages = messagesResult.data;
      const lastAssistantMessage = responseMessages
        .filter((m: any) => m.role === 'assistant')
        .pop();

      if (!lastAssistantMessage) {
        return {
          content: 'No response received from the AI model.',
        };
      }

      // Extract content from message parts
      let content = '';
      let thinking = '';

      for (const part of lastAssistantMessage.parts || []) {
        if (part.type === 'text') {
          content += part.text || '';
        } else if (part.type === 'thinking' || part.type === 'reasoning') {
          thinking += part.text || '';
        }
      }

      return {
        content: content || 'No response content.',
        thinking: thinking || undefined,
        // Note: Token counts are not directly available from OpenCode SDK
        // This would need to be obtained from the model response metadata if available
      };
    } catch (err: any) {
      console.error('[ServerBridge] sendChatMessage failed:', err);
      throw err;
    }
  }

  /**
   * Validates if the agent response matches expected format (e.g. JSON).
   * TASK-176
   */
  validateResponse(content: string, format: 'json' | 'text'): boolean {
    if (format === 'json') {
      try {
        const parsed = JSON.parse(content);
        return typeof parsed === 'object' && parsed !== null;
      } catch {
        return false;
      }
    }
    return true; // Text is always valid
  }

  // ===============================
  // OpenClaw Skill Execution (ADMN-02)
  // ===============================

  /**
   * Execute an OpenClaw skill in the runtime container
   * 
   * This method prepares a session with skill context, mounts the skill
   * directory read-only, and executes the skill entry point.
   */
  async executeSkill(
    skillName: string,
    inputs: Record<string, any>,
    options: {
      taskId?: string;
      sessionId?: string;
      environment?: Record<string, string>;
      workingDirectory?: string;
      timeout?: number;
    } = {}
  ): Promise<{
    sessionId: string;
    status: 'running' | 'completed' | 'failed';
    result?: any;
    error?: string;
  }> {
    const sessionId = options.sessionId || uuidv4();
    
    console.log(`[ServerBridge] Executing skill '${skillName}' in session ${sessionId}`);

    try {
      // Create session for skill execution
      const createResult = await this.client.session.create({
        body: {
          title: `Skill: ${skillName}${options.taskId ? ` (Task: ${options.taskId})` : ''}`
        }
      });

      if (createResult.error) {
        throw new Error(`Failed to create session: ${JSON.stringify(createResult.error)}`);
      }

      const session = createResult.data;
      const actualSessionId = session.id;

      // Map session to task
      if (options.taskId) {
        this.sessionTaskMap.set(actualSessionId, options.taskId);
      }

      // Build skill execution prompt
      const skillPrompt = this.buildSkillExecutionPrompt(skillName, inputs);

      // Add skill environment variables
      const envVars = {
        ...options.environment,
        SKILL_NAME: skillName,
        SKILL_SESSION_ID: actualSessionId,
        ...(options.workingDirectory && { WORKING_DIR: options.workingDirectory })
      };

      // Send the prompt to execute the skill
      this.client.session.prompt({
        path: { id: actualSessionId },
        body: {
          agent: 'general',
          parts: [{
            type: 'text',
            text: skillPrompt
          }],
          // Environment variables for the skill
          env: envVars
        }
      }).catch((err: any) => {
        console.error(`[ServerBridge] Skill execution failed for ${skillName}:`, err);
      });

      // Log to audit
      await this.auditLogger.logAction({
        agentId: 'server-bridge',
        taskId: options.taskId,
        action: 'skill_execution_start',
        details: {
          skillName,
          sessionId: actualSessionId,
          inputs: Object.keys(inputs)
        },
        result: 'pending'
      });

      return {
        sessionId: actualSessionId,
        status: 'running'
      };

    } catch (err: any) {
      console.error(`[ServerBridge] Failed to execute skill ${skillName}:`, err);
      
      // Log failure
      await this.auditLogger.logAction({
        agentId: 'server-bridge',
        taskId: options.taskId,
        action: 'skill_execution_failed',
        details: {
          skillName,
          error: err.message
        },
        result: 'failure'
      });

      return {
        sessionId,
        status: 'failed',
        error: err.message
      };
    }
  }

  /**
   * Cancel a skill execution
   */
  async cancelExecution(sessionId: string): Promise<boolean> {
    try {
      console.log(`[ServerBridge] Cancelling execution for session ${sessionId}`);

      // Get the session to check if it exists
      const sessionResult = await this.client.session.get({
        path: { id: sessionId }
      });

      if (sessionResult.error || !sessionResult.data) {
        console.warn(`[ServerBridge] Session ${sessionId} not found for cancellation`);
        return false;
      }

      // Delete the session to cancel execution
      const deleteResult = await this.client.session.delete({
        path: { id: sessionId }
      });

      if (deleteResult.error) {
        console.error(`[ServerBridge] Failed to cancel session ${sessionId}:`, deleteResult.error);
        return false;
      }

      // Clean up task mapping
      this.sessionTaskMap.delete(sessionId);

      // Log cancellation
      await this.auditLogger.logAction({
        agentId: 'server-bridge',
        action: 'skill_execution_cancelled',
        details: { sessionId },
        result: 'success'
      });

      console.log(`[ServerBridge] Session ${sessionId} cancelled successfully`);
      return true;

    } catch (err: any) {
      console.error(`[ServerBridge] Error cancelling session ${sessionId}:`, err);
      return false;
    }
  }

  /**
   * Build the execution prompt for a skill
   */
  private buildSkillExecutionPrompt(skillName: string, inputs: Record<string, any>): string {
    const inputsJson = JSON.stringify(inputs, null, 2);
    
    return `You are executing the OpenClaw skill: ${skillName}

Skill Inputs:
\`\`\`json
${inputsJson}
\`\`\`

Execute this skill according to its defined behavior. 
Process the inputs and produce the expected outputs.
Report your progress and any issues encountered.

When complete, summarize what was accomplished.`;
  }

  /**
   * Collect artifacts from a skill execution session
   */
  async collectArtifacts(sessionId: string): Promise<string[]> {
    try {
      const artifacts = await this.getArtifacts(sessionId);
      
      console.log(`[ServerBridge] Collected ${artifacts.length} artifacts from session ${sessionId}`);
      
      return artifacts;
    } catch (err: any) {
      console.error(`[ServerBridge] Failed to collect artifacts for ${sessionId}:`, err);
      return [];
    }
  }
}
