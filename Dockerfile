# syntax=docker/dockerfile:1

FROM node:20-slim

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./

# Install all deps (including devDeps for tsc build)
RUN npm ci --ignore-scripts

COPY . .

# Build TypeScript
RUN ./node_modules/.bin/tsc

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/index.js"]
