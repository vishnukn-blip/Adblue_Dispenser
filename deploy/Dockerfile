FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir paho-mqtt

# Create volume mount point for database persistence
RUN mkdir -p /data

# Copy worker script
COPY worker.py /app/worker.py

# Expose Web Panel & REST API
EXPOSE 8001

# Default environment configuration
ENV PYTHONUNBUFFERED=1 \
    DB_PATH=/data/adblue_dispense.db \
    MQTT_HOST=172.17.0.1 \
    MQTT_PORT=1883 \
    MQTT_USER=adblue_iot \
    MQTT_PASS=adblue@2026 \
    API_PORT=8001

CMD ["python", "worker.py"]

