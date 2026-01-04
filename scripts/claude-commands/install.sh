#!/bin/bash

# Install Orchestra CLI integration for Claude Code
# This creates symlinks so the files stay in sync with the repo

set -e

echo "Installing Orchestra CLI integration..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure ~/.claude directories exist
mkdir -p ~/.claude/commands
mkdir -p ~/.claude/scripts

# Create symlinks
ln -sf "$SCRIPT_DIR/orchestra-sync.md" ~/.claude/commands/orchestra-sync.md
ln -sf "$SCRIPT_DIR/show-orchestra-activity.sh" ~/.claude/scripts/show-orchestra-activity.sh

# Make the script executable
chmod +x "$SCRIPT_DIR/show-orchestra-activity.sh"

echo "✅ Installation complete!"
echo ""
echo "Usage:"
echo "  1. Resume a Claude Code session that was used with Orchestra"
echo "  2. Type: /orchestra-sync"
echo "  3. See what happened in the Orchestra web app"
echo ""
