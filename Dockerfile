FROM node:22-alpine AS builder

WORKDIR /app

# Copy package definitions
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm install --prefix server && npm install --prefix client

# Copy application code
COPY . .

# Build frontend client
RUN npm run build --prefix client

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 3000

CMD ["node", "server/src/index.js"]
