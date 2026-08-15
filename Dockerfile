FROM node:20-slim

# Install openssl for Prisma
RUN apt-get update && apt-get install -y openssl unzip fontconfig libnss3 libxss1 libasound2 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libnss3-dev libgdk-pixbuf2.0-dev libgtk-3-dev libxss-dev && rm -rf /var/lib/apt/lists/*

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
