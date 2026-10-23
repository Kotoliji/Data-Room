# One image serves the React SPA and the Flask API from the same origin.
# Works on any container host that sets $PORT (Render, Railway, Fly, ...).

FROM node:20-alpine AS frontend
WORKDIR /web
COPY apps/frontend/package.json apps/frontend/package-lock.json ./
RUN npm ci
COPY apps/frontend/ ./
# Empty API base = same origin, so the bundle works on whatever domain the host assigns
ENV VITE_API_URL=""
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    FRONTEND_DIST=/app/static \
    STORAGE_DIR=/data/storage \
    DATABASE_URL=sqlite:////data/dataroom.db
COPY apps/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/backend/ .
COPY --from=frontend /web/dist /app/static
RUN mkdir -p /data/storage

EXPOSE 8080
# One worker keeps the in-memory rate limiter and SQLite consistent; threads handle concurrency
CMD ["sh", "-c", "exec gunicorn run:app --bind 0.0.0.0:${PORT:-8080} --workers 1 --threads 4 --timeout 120"]
