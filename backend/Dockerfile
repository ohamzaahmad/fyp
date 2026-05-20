FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Copy requirements from build context (assumes build context is `backend/`)
COPY requirements.txt ./requirements.txt

RUN apt-get update \
    && apt-get install -y build-essential libpq-dev gcc \
    && pip install --upgrade pip setuptools wheel \
    && pip install -r requirements.txt \
    && apt-get remove -y build-essential gcc \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* /root/.cache/pip

# Copy application files from build context
COPY . /app/

ENV PORT=8000
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# At container start: run migrations, collectstatic, then start Gunicorn
CMD ["/app/start.sh"]
