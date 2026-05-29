# ---- Stage 1: Build ----
FROM python:3.11-slim AS builder

# Install system deps and uv
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR="/usr/local/bin" sh

WORKDIR /app

# Copy everything (needed for editable install)
COPY . .

# Install the package and its dependencies into the system Python
RUN uv pip install --system .

# ---- Stage 2: Runtime ----
FROM python:3.11-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin/tradingview-mcp /usr/local/bin/tradingview-mcp

# Copy app source (needed for coinlist data files etc.)
COPY --from=builder /app /app

# Create non-root user for security
RUN useradd -m mcpuser && chown -R mcpuser:mcpuser /app
USER mcpuser

# Expose the HTTP port
EXPOSE 8000

# streamable-http transport: exposes /mcp endpoint for portfolio app backend
# The Manus MCP connector uses the same /mcp endpoint via streamable-http type
ENTRYPOINT ["tradingview-mcp"]
CMD ["streamable-http", "--host", "0.0.0.0"]
