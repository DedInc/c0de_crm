FROM python:3.11-alpine AS base

RUN apk add --no-cache gcc musl-dev

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1
EXPOSE 8081

CMD ["python", "main.py"]
