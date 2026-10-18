# AegisAI Real ML Scoring Microservice Container
# Multi-stage lightweight CPU inference build (< 120MB image)
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY ml/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.11-slim

WORKDIR /app

# Non-root unprivileged execution user for container security
RUN groupadd -r aegis && useradd -r -g aegis -s /bin/false aegis

COPY --from=builder /install /usr/local
COPY ml/ /app/ml/
COPY supabase/model_service.py /app/supabase/model_service.py
COPY supabase/__init__.py /app/supabase/__init__.py

RUN chown -R aegis:aegis /app

USER aegis

ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["sh", "-c", "uvicorn supabase.model_service:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
