# notification-system

HNG Task 4 - Distributed Notification System with Microservices

## Services

- **API Gateway** (NodeJS/Fastify) - Port 3000
- **Email Service** (NestJS) - Port 3001
- **User Service** (NestJS) - Port 3002
- **Push Service** (Python/FastAPI) - Port 3003
- **Template Service** (Python/FastAPI) - Port 3004

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+
- Python 3.11+

### Setup

```bash

# Clone and setup

git clone <repo-url>
cd notification-system
npm run setup

# Update .env with your credentials

cp .env.example .env

# Start all services

npm run dev
```

### Access Points

- API Gateway: http://localhost:3000
- RabbitMQ Management: http://localhost:15672 (guest/guest)
- All services health: http://localhost:300X/health

## Development

### Start individual service

```bash
npm run gateway # API Gateway
npm run email # Email Service
npm run user # User Service
npm run push # Push Service
npm run template # Template Service
```

### View logs

```bash
npm run logs
```

### Stop services

```bash
npm run down
```

## Project Structure

```
notification-system/
├── services/ # Microservices
├── shared/ # Shared code
├── infrastructure/ # Docker & scripts
├── docs/ # Documentation
└── docker-compose.yml
```

## Team

- NodeJS Developer: API Gateway
- NestJS Developer: Email & User Services
- Python Developer: Push & Template Services
