# DeepForge Backend - Railway Deployment (minimal, crash-proof)
FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for better caching
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/app ./app

# Create required directories
RUN mkdir -p uploads temp reports

# Copy start script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose port (Railway sets $PORT)
EXPOSE $PORT

# Run the application
CMD ["/app/start.sh"]