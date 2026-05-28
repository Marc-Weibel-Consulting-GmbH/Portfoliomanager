FROM python:3.11-slim

WORKDIR /app

# Install uv for fast dependency management
RUN pip install uv --no-cache-dir

# Copy project files
COPY pyproject.toml .
COPY main.py .

# Install dependencies via uv
RUN uv pip install --system --no-cache -r pyproject.toml 2>/dev/null || \
    uv pip install --system --no-cache \
        "fastapi>=0.115.0" \
        "uvicorn[standard]>=0.32.0" \
        "tradingview-mcp-server>=0.7.0" \
        "pydantic>=2.0.0"

# Expose port (Railway sets PORT env var automatically)
EXPOSE 8001

# Start the FastAPI server
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}"]
