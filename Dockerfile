FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm ci

COPY . .

RUN npm run build --workspace=client && npm prune --omit=dev

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV STORAGE_BACKEND=sqlite
ENV DATA_DIR=/app/server/data
ENV SQLITE_DB_PATH=/app/server/data/simplelink.db
ENV UPLOADS_DIR=/app/server/data/uploads

COPY --chown=node:node package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/server ./server
COPY --chown=node:node --from=builder /app/client/dist ./client/dist

RUN mkdir -p /app/server/data/uploads /app/server/data/backups && chown -R node:node /app/server/data

USER node

EXPOSE 3000

CMD ["node", "server/src/index.js"]
