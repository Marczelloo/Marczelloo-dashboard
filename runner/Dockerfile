# Runner service Dockerfile
FROM node:20-alpine

# Install Docker CLI for container management, SSH client for host access
RUN apk add --no-cache docker-cli git openssh-client

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Create directories for persistent config and SSH
RUN mkdir -p /app/data /root/.ssh
ENV RUNNER_DATA_DIR=/app/data

# Expose port
EXPOSE 8787

# Run the service
CMD ["npx", "tsx", "index.ts"]
