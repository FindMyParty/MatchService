#!/bin/bash
set -e

echo "Waiting for PostgreSQL..."
until pg_isready -h localhost -p 5434 -d match; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done
echo "PostgreSQL is up"

echo "Waiting for RabbitMQ..."
until nc -z localhost 5672; do
  echo "RabbitMQ is unavailable - sleeping"
  sleep 2
done
echo "RabbitMQ is up"

echo "Running migrations..."
npm run migrate

echo "Starting match-service..."
npm start
