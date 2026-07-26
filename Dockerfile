FROM node:20-alpine

# Install openssl for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Remove local .env file so it doesn't override Docker ENV
RUN rm -f .env

# Expose port
EXPOSE 3000

# Start command: push schema to database, seed default data, then start server
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node src/seed.js && npm start"]
