# Stage 1: Builder
FROM node:18 AS builder

# Set working directory
WORKDIR /app

# Copy package.json & package-lock.json first for caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the NestJS app
RUN npm run build

# Stage 2: Production
FROM node:18 AS production

# Set working directory
WORKDIR /app

# Copy package.json & package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Expose the port
EXPOSE 3002

# Start the app
CMD ["node", "dist/main"]
