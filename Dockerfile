# Multi-stage build for optimized production image
FROM node:18-alpine AS base

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development
RUN npm ci
COPY . .
EXPOSE 3000
USER node
CMD ["dumb-init", "npm", "run", "dev"]

# Build stage
FROM base AS build
RUN npm ci --only=production && npm cache clean --force
COPY . .
RUN npm run build

# Production stage
FROM base AS production
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application
COPY --from=build --chown=nodejs:nodejs /usr/src/app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /usr/src/app/package*.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Start the application
CMD ["dumb-init", "node", "dist/app.js"]