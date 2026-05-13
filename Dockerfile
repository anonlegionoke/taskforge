FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/api/package*.json ./packages/api/
COPY packages/worker/package*.json ./packages/worker/

RUN npm install

COPY . .