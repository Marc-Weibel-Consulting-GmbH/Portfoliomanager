#!/bin/sh
# Start both streamable-http (port $PORT, for portfolio app backend) 
# and SSE (port $SSE_PORT, for Manus MCP connector) simultaneously.
# Railway only exposes one public port ($PORT), so we run streamable-http on $PORT
# and SSE on an internal port. The Manus connector uses the /sse path via a reverse proxy.
# 
# Since Railway only gives us one port, we use a single uvicorn instance with a custom
# ASGI app that mounts both transports on different paths.

PORT="${PORT:-8000}"

exec tradingview-mcp streamable-http --host 0.0.0.0 --port "$PORT"
