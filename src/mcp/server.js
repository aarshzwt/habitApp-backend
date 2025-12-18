const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { registerHabitTools } = require("./tools");

function createMcpServer() {
  const server = new McpServer({
    name: "Habit Analytics MCP",
    version: "1.0.0"
  });

  registerHabitTools(server);

  return server;
}

module.exports = { createMcpServer };
