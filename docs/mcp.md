# `siteforge mcp`

Serve the toolkit to AI agents over the Model Context Protocol (stdio).

```bash
siteforge mcp
```

Tools: `add_section`, `add_effect`, `add_3d_scene`, `audit_page`,
`install_skills`, `check_env`. Results return as JSON text (truncated at
20KB). Human logs go to stderr so stdout stays a clean JSON-RPC channel.

## Claude Code

```json
// .claude/settings.json (project) or ~/.claude.json
{ "mcpServers": { "siteforge": { "command": "siteforge", "args": ["mcp"] } } }
```

## Cursor / OpenCode / Codex

Point your MCP config at the same command + `["mcp"]` args. The agent can
then scaffold sections, audit pages, and install skills without shell access.
