#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

const server = new McpServer({ name: "mdz-noisy-fixture", version: "0.1.0" });

server.registerTool("noisy_tests", {
  description: "Return verbose test output with one actionable failure.",
  inputSchema: { lines: z.number().int().positive().optional() }
}, async ({ lines = 1000 }) => ({
  content: [{ type: "text", text: [
    ...Array.from({ length: lines }, (_, index) => `PASS fixture test ${index}`),
    "FAIL authentication integration",
    "AssertionError: Expected 401 Received 200"
  ].join("\n") }]
}));

server.registerTool("small_status", {
  description: "Return a short status that should not be reduced.",
  inputSchema: {}
}, async () => ({ content: [{ type: "text", text: "Status: ready" }] }));

server.registerTool("structured_status", {
  description: "Return structured content that MDZ must preserve.",
  inputSchema: {}
}, async () => ({
  content: [{ type: "text", text: "PASS detail\n".repeat(500) }],
  structuredContent: { status: "ready", count: 500 }
}));

await server.connect(new StdioServerTransport());
