#!/usr/bin/env bash
# Ubuntu/Linux equivalent of start-langlsrw-server.bat.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PORT=8848

cd "$APP_DIR"

echo "langLSRW local server starting..."
echo "Serving folder:"
echo "$APP_DIR"
echo
echo "Checking port $PORT..."

PID=""
if command -v lsof >/dev/null 2>&1; then
  PID="$(lsof -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n1)"
elif command -v ss >/dev/null 2>&1; then
  PID="$(ss -ltnp "( sport = :$PORT )" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -n1)"
fi

if [ -n "$PID" ]; then
  CMD="$(ps -p "$PID" -o cmd= 2>/dev/null)"
  if echo "$CMD" | grep -q "python" && echo "$CMD" | grep -q "http.server"; then
    echo "Stopping old Python http.server on port $PORT, PID $PID..."
    kill "$PID"
    sleep 0.5
  else
    echo "Port $PORT is used by another process, PID $PID:"
    echo "${CMD:-Unknown process}"
    echo
    echo "Close that program or change the port in this script."
    exit 1
  fi
fi

echo
echo "Open this address in your browser:"
echo "http://localhost:$PORT/"
echo
echo "Keep this terminal open while using langLSRW."
echo "Press Ctrl+C to stop the server."
echo

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT" --directory "$APP_DIR"
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server "$PORT" --directory "$APP_DIR"
else
  echo "Neither python3 nor python was found. Install Python 3 to run the local server."
  exit 1
fi
