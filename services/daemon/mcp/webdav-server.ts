
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient, WebDAVClient } from 'webdav';

export class WebDavMcpServer {
    private server: Server;
    private client: WebDAVClient | null = null;

    constructor() {
        this.server = new Server(
            {
                name: "webdav-server",
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
                        name: "webdav_list",
                        description: "List files and directories in a WebDAV folder.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                path: { type: "string", description: "Remote path to list" }
                            },
                            required: ["path"]
                        }
                    },
                    {
                        name: "webdav_read",
                        description: "Read a file from WebDAV.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                path: { type: "string", description: "Remote path to the file" }
                            },
                            required: ["path"]
                        }
                    },
                    {
                        name: "webdav_search",
                        description: "Search for files in WebDAV by name.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                query: { type: "string", description: "Filename or pattern to search for" },
                                path: { type: "string", description: "Directory to start search from" }
                            },
                            required: ["query"]
                        }
                    }
                ]
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            if (!this.client) {
                // Try to initialize from environment if not yet done
                const url = process.env.WEBDAV_URL;
                const user = process.env.WEBDAV_USER;
                const pass = process.env.WEBDAV_PASS;
                if (url) {
                    this.client = createClient(url, { username: user, password: pass });
                } else {
                    return {
                        content: [{ type: "text", text: "WebDAV client not configured. Set WEBDAV_URL env var." }],
                        isError: true
                    };
                }
            }

            try {
                switch (name) {
                    case "webdav_list": {
                        const { path } = args as any;
                        const contents = await this.client.getDirectoryContents(path || "/");
                        return {
                            content: [{ type: "text", text: JSON.stringify(contents, null, 2) }]
                        };
                    }
                    case "webdav_read": {
                        const { path } = args as any;
                        const content = await this.client.getFileContents(path);
                        const text = Buffer.from(content as ArrayBuffer).toString('utf-8');
                        return {
                            content: [{ type: "text", text: text.substring(0, 10000) }] // Truncate if too large
                        };
                    }
                    case "webdav_search": {
                        const { query, path: startPath } = args as any;
                        // Naive recursive search for prototype
                        const results: string[] = [];
                        const search = async (curr: string) => {
                            const items = await this.client!.getDirectoryContents(curr) as any[];
                            for (const item of items) {
                                if (item.basename.toLowerCase().includes(query.toLowerCase())) {
                                    results.push(item.filename);
                                }
                                if (item.type === 'directory') {
                                    await search(item.filename);
                                }
                            }
                        };
                        await search(startPath || "/");
                        return {
                            content: [{ type: "text", text: JSON.stringify(results, null, 2) }]
                        };
                    }
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            } catch (err: any) {
                return {
                    content: [{ type: "text", text: `Error: ${err.message}` }],
                    isError: true
                };
            }
        });
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
    }
}

// Auto-run if executed directly
if (import.meta.url.endsWith('webdav-server.ts') || process.argv[1]?.endsWith('webdav-server.ts')) {
    const server = new WebDavMcpServer();
    server.run().catch(console.error);
}
