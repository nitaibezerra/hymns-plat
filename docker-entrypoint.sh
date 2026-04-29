#!/bin/bash
set -e

echo "Running migrations..."
python manage.py migrate --noinput

echo "Creating cache table (idempotent)..."
python manage.py createcachetable 2>/dev/null || echo "Cache table already exists"

echo "Starting gunicorn on port ${PORT:-8000}..."
exec gunicorn config.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers 2 \
    --threads 4 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
