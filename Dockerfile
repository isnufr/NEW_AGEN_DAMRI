FROM node:20-alpine

# Install SQLite dependencies and openssl for Prisma
RUN apk add --no-cache sqlite sqlite-dev openssl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Set database URL to the persistent data folder
ENV DATABASE_URL="file:/app/data/database.sqlite"

# Expose port
EXPOSE 3000

# Start command: copy database if missing in volume, then start server
CMD ["sh", "-c", "mkdir -p /app/data && [ ! -f /app/data/database.sqlite ] && cp prisma/database.sqlite /app/data/database.sqlite || true && npm start"]
