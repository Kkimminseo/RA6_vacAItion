# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV DJANGO_SETTINGS_MODULE vacation.settings

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update --fix-missing \
    && apt-get install -y --no-install-recommends \
        postgresql-client \
        build-essential \
        python3-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip \
    && pip install -r requirements.txt \
    && pip install daphne

# Copy project
COPY . /app/

# Daphne 실행
CMD ["daphne", "vacation.asgi:application", "--port", "8000", "--bind", "0.0.0.0", "-v2"] 