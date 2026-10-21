#!/bin/bash
set -euo pipefail

# Cloud sessions only: local machines manage their own REA installation.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Install the REA CLI from npm once; the container is cached after this hook.
if ! command -v rea > /dev/null 2>&1; then
  npm install --global --no-audit --no-fund rea-agents
fi

# Additive and idempotent: registers the REA MCP server in ~/.claude.json
# (with a backup) and installs the REA skill for Claude Code. Native analysis
# engines (Ghidra, IDA, Hopper) are bring-your-own and are not installed here.
rea setup --client claude_code --yes --json > /dev/null
