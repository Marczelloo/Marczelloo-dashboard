# Runner service Dockerfile
FROM node:20-alpine

# Install Docker CLI for container management
RUN apk add --no-cache docker-cli git

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Create data directory for persistent config
RUN mkdir -p /app/data
ENV RUNNER_DATA_DIR=/app/data

# Expose port
EXPOSE 8787

# Run the service
CMD ["npx", "tsx", "index.ts"]
