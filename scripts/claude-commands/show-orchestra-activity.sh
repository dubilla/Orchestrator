#!/bin/bash

# Find the current session's .jsonl file
# Try to get it from environment or find most recent
if [ -n "$CLAUDE_SESSION_FILE" ]; then
  SESSION_FILE="$CLAUDE_SESSION_FILE"
else
  # Find most recently modified session file
  SESSION_FILE=$(ls -t ~/.claude/projects/-Users-danubilla-Projects-*/[a-f0-9]*.jsonl 2>/dev/null | head -1)
fi

if [ -z "$SESSION_FILE" ] || [ ! -f "$SESSION_FILE" ]; then
  echo "❌ No session file found"
  exit 0
fi

echo ""
echo "📱 Orchestra Activity"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Count Orchestra messages
COUNT=$(grep -c "orchestraSource" "$SESSION_FILE" 2>/dev/null || echo "0")

if [ "$COUNT" -eq 0 ]; then
  echo "No Orchestra activity found in this session."
  echo ""
  exit 0
fi

# Display Orchestra messages
grep "orchestraSource" "$SESSION_FILE" | while IFS= read -r line; do
  TYPE=$(echo "$line" | jq -r '.type')
  TIMESTAMP=$(echo "$line" | jq -r '.timestamp // "unknown"' | cut -d'T' -f2 | cut -d'.' -f1)

  if [ "$TYPE" = "user" ]; then
    # Check if this is a tool result (skip it) or actual user message
    IS_TOOL_RESULT=$(echo "$line" | jq -r '.message.content[0].type // empty')
    if [ "$IS_TOOL_RESULT" != "tool_result" ]; then
      CONTENT=$(echo "$line" | jq -r '.message.content // empty')
      # Skip if content starts with [ (JSON arrays from tool results)
      if [[ ! "$CONTENT" =~ ^\[ ]]; then
        echo "🙋 YOU ($TIMESTAMP):"
        echo "$CONTENT" | fold -w 70 -s | sed 's/^/   /'
        echo ""
      fi
    fi
  elif [ "$TYPE" = "assistant" ]; then
    # Only show text responses, not tool uses
    HAS_TEXT=$(echo "$line" | jq -r '.message.content[] | select(.type == "text") | .text // empty' | head -c 1)
    if [ -n "$HAS_TEXT" ]; then
      CONTENT=$(echo "$line" | jq -r '[.message.content[] | select(.type == "text") | .text] | join("\n")')
      echo "🤖 CLAUDE ($TIMESTAMP):"
      echo "$CONTENT" | fold -w 70 -s | sed 's/^/   /'
      echo ""
    fi
  fi
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
