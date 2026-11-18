# Multi-stage Dockerfile for SAMT Esports & Campus Events Platform
# Stage 1: Build client and server
FROM node:22-alpine AS builder
WORKDIR /app

# Install build dependencies
COPY package*.json .npmrc ./
RUN npm ci

# Copy full source and build both frontend and server bundle
COPY . .
RUN npm run build

# Stage 2: Production runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production runtime dependencies only
COPY package*.json .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled frontend and bundled server from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./

# Ensure non-root node user permissions
RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["node", "build/server.js"]
