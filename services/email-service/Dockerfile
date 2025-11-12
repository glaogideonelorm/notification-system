FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Copy package.json (and package-lock.json if it exists)
COPY package*.json ./
RUN npm install --omit=dev

# Install only production dependencies
RUN npm ci --omit=dev

# Expose port
EXPOSE 3001

# Start in production mode
CMD ["node", "dist/main"]

# Start in production mode
CMD ["node", "dist/main"]
