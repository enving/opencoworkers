import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class GrepServer {
    private server: Server;

    constructor() {
        this.server = new Server(
            {
                name: "grep-server",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupHandlers();
    }

    private setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "grep",
                        description: "Search for text patterns in files or directories.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                pattern: {
                                    type: "string",
                                    description: "The regex or text pattern to search for"
                                },
                                path: {
                                    type: "string",
                                    description: "File or directory path to search in"
                                },
                                flags: {
                                    type: "string",
                                    description: "Optional flags: -r (recursive), -i (case-insensitive), -n (line numbers)"
                                }
                            },
                            required: ["pattern", "path"]
                        }
                    }
                ]
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (request.params.name === "grep") {
                const { pattern, path, flags } = request.params.arguments as any;

                // Basic Security Sanitization for TASK-181 (Partially applied here)
                if (/[;&|`]/.test(pattern) || /[;&|`]/.test(path)) {
                    throw new Error("Invalid characters in arguments (Shell Injection Protection).");
                }

                const safeFlags = flags ? flags.replace(/[^a-zA-Z-]/g, "") : "-r";

                try {
                    const command = `grep ${safeFlags} "${pattern}" ${path}`;
                    const { stdout, stderr } = await execAsync(command); // Note: execAsync handles buffer limits
                    const output = stdout || stderr || "No matches found.";

                    // Limit output size for context management (TASK-176)
                    if (output.length > 5000) {
                        return {
                            content: [{ type: "text", text: output.substring(0, 5000) + "\n...[Output Truncated]" }]
                        };
                    }

                    return {
                        content: [{ type: "text", text: output }]
                    };
                } catch (err: any) {
                    // grep returns exit code 1 if no matches, which throws.
                    if (err.code === 1) {
                        return { content: [{ type: "text", text: "No matches found." }] };
                    }
                    return {
                        content: [{ type: "text", text: `Error: ${err.message}` }],
                        isError: true
                    };
                }
            }
            throw new Error("Tool not found");
        });
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("Grep MCP Server running on stdio");
    }
}
