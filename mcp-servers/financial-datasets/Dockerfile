FROM python:3.12-slim

WORKDIR /app
COPY pyproject.toml server.py ./
RUN pip install --no-cache-dir "mcp>=1.9.0" "httpx>=0.27.0"

# PORT wird von Railway gesetzt; Default 8000.
CMD ["python", "server.py"]
