# Use Node.js 20.x LTS
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy package files from backend directory
COPY backend/package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy the entire backend directory content
COPY backend/ ./

# Remove dev dependencies, tests, and unnecessary files (but NOT node_modules!)
RUN rm -rf tests _deprecated docs *.js *.json *.txt *.md .env .env* jest-results.json && \
    find . -name ".git*" -type f -delete

# Ensure required directories exist
RUN mkdir -p data

# Change ownership to node user
RUN chown -R node:node /app
USER node

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Health check - validates server is running
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application with proper signal handling and initialization
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
