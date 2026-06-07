# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM node:18-alpine
WORKDIR /app/backend

# Install docker-cli so portScanner can run 'docker ps'
RUN apk add --no-cache docker-cli

COPY backend/package*.json ./
RUN npm install
COPY backend/ ./

# Copy built frontend so Express can serve it
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Set environment variable for routing
ENV RUNNING_IN_DOCKER=true

EXPOSE 3001
CMD ["node", "server.js"]
