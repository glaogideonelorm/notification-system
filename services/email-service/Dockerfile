# FROM node:20-alpine AS development
FROM node:20-alpine

# WORKDIR /app

# # Copy package files
# COPY package*.json ./

# # Install dependencies
# RUN npm install

# # Copy source code
# COPY . .

# # Expose port
# EXPOSE 3001

# # Start in development mode
# CMD ["npm", "run", "start:dev"]

# # Production stage
# FROM node:20-alpine AS production

# WORKDIR /app

# # Copy package files
# COPY package*.json ./

# # Install production dependencies only
# RUN npm ci --only=production

# # Copy built application from development stage
# COPY --from=development /app/dist ./dist

# # Expose port
# EXPOSE 3001

# # Start in production mode
# CMD ["node", "dist/main"]


# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build the app
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app

# Copy package.json (and package-lock.json if it exists)
COPY package*.json ./
RUN npm ci --only=production || npm install --only=production

# Copy built app from builder
COPY --from=builder /app/dist ./dist

# Set environment variable
ENV NODE_ENV=production
EXPOSE 3001

# Run the app
CMD ["node", "dist/main.js"]
# Start in production mode
CMD ["node", "dist/main"]

