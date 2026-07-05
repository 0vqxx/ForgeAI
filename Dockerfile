FROM python:3.12-slim

WORKDIR /app/backend

COPY backend/requirements.txt /tmp/requirements.txt
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir -r /tmp/requirements.txt

COPY backend/ /app/backend/
COPY neon/schema.sql /app/neon/schema.sql

RUN mkdir -p /app/workspace /app/public/downloads

EXPOSE 8080

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
