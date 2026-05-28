#!/bin/sh
exec tradingview-mcp streamable-http --host 0.0.0.0 --port "${PORT:-8000}"
