FROM node:20.20.0-bookworm

ARG NPM_VERSION=11.11.0
RUN npm install -g npm@${NPM_VERSION}

# Corporate TLS trust (eprism)
COPY certs/eprism.crt /usr/local/share/ca-certificates/eprism.crt
RUN update-ca-certificates

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
