# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/api/package*.json ./packages/api/
COPY packages/worker/package*.json ./packages/worker/

RUN npm install

COPY tsconfig.json ./
COPY packages/shared/src ./packages/shared/src
COPY packages/api/src ./packages/api/src
COPY packages/worker/src ./packages/worker/src

RUN npx tsc
RUN npm run bundle

# Runtime Stage
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/api/package*.json ./packages/api/
COPY packages/worker/package*.json ./packages/worker/

RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist