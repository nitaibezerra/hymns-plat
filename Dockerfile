# Dockerfile for Hinaria — Railway deploy
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV POETRY_VERSION=1.8.4
ENV POETRY_VIRTUALENVS_CREATE=false
ENV POETRY_NO_INTERACTION=1

WORKDIR /app

# System deps:
#  - build-essential, libpq-dev: psycopg2 build
#  - libmagic1: python-magic (upload validation)
#  - ffmpeg: audio waveform generation (apps/hymns/services/audio.py)
#  - tesseract-ocr + por: PDF OCR via hymn-ocr lib
#  - poppler-utils: pdf2image (hymn-ocr dep)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libmagic1 \
    ffmpeg \
    tesseract-ocr \
    tesseract-ocr-por \
    poppler-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install "poetry==${POETRY_VERSION}"

# Install Python deps (production only)
COPY pyproject.toml poetry.lock ./
RUN poetry install --without dev --no-root

# Copy project
COPY . .

# Collectstatic (needs minimal env at build time)
ARG DJANGO_SECRET_KEY="build-time-secret-key-not-for-production"
ARG DATABASE_URL="postgres://placeholder:placeholder@localhost/placeholder"
ARG DJANGO_ALLOWED_HOSTS=".up.railway.app"
ENV DJANGO_SECRET_KEY=${DJANGO_SECRET_KEY}
ENV DATABASE_URL=${DATABASE_URL}
ENV DJANGO_ALLOWED_HOSTS=${DJANGO_ALLOWED_HOSTS}
ENV DJANGO_DEBUG=False
ENV SECURE_SSL_REDIRECT=False
ENV DJANGO_SETTINGS_MODULE=config.settings.production
RUN python manage.py collectstatic --noinput

# Non-root user
RUN adduser --disabled-password --gecos '' appuser \
    && chown -R appuser:appuser /app
RUN chmod +x /app/docker-entrypoint.sh

USER appuser

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
