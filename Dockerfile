FROM node:20.20.0-bookworm

ARG NPM_VERSION=11.11.0
RUN npm install -g npm@${NPM_VERSION}

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

