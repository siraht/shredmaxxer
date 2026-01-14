#!/usr/bin/env bash
export AGENT_MAIL_PROJECT='/data/projects/shredmaxxer'
export AGENT_MAIL_AGENT='FuchsiaFalcon'
export AGENT_MAIL_URL='http://127.0.0.1:8765/mcp/'
export AGENT_MAIL_TOKEN='2da6fa096983f4a72f9d4ef1d9b4a41ed0d2db3bac74b8e6f019ea9f36312a75'
export AGENT_MAIL_INTERVAL='120'
exec '/data/projects/shredmaxxer/.codex/hooks/notify_inbox.sh' "$@"
