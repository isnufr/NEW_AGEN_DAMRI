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

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "start"]
