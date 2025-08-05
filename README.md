# Bug Bounty Admin API

This is a sample backend project designed to showcase clean architecture, TypeScript best practices, and practical engineering judgment in the context of a bug bounty platform's admin system.

The core idea: simulate how a small internal API might handle bug report submissions, triage, and security workflows — the kind of system you'd find powering the admin side of a modern cybersecurity product.

---

## Tech Stack

- **Node.js + Express** for API routing
- **TypeScript** with strict type safety
- **PostgreSQL + TypeORM** for data persistence
- **Redis** for caching and rate limiting
- **Zod** for input validation
- **JWT** for authentication
- **Jest** for testing (unit + integration)
- **Docker** for containerization
- **Helmet + CORS** for security
- **ESLint + Prettier** for code consistency

---

## Features

- Submit vulnerability reports (`POST /reports`)
- Filter & paginate report listings (`GET /reports`)
- Assign triage owners to reports (`PUT /reports/:id/assign`)
- Update report status (`PUT /reports/:id/status`)
- Basic token-based auth (middleware)
- Schema validation for all input payloads
- Centralized error handling with custom exceptions
- Python script (`scanner.py`) to simulate automated vulnerability reporting

---

## Project Structure

```bash
src/
├── controllers/     # Request handling logic
├── services/        # Core business logic
├── database/        # Database layer (TypeORM)
│   ├── entities/    # Database entities
│   ├── migrations/  # Schema migrations
│   ├── repositories/ # Data access layer
│   └── seeders/     # Sample data
├── dtos/            # Type-safe request validation
├── middleware/      # Auth, error handling, etc.
├── utils/           # Reusable helpers
├── config/          # App configuration
├── types/           # Shared TypeScript types
```

---

## Engineering Focus

This project was intentionally scoped small to focus on **quality over quantity**. It reflects how I approach:

- Designing APIs with future maintainability in mind
- Separating concerns cleanly (no controller bloat)
- Validating inputs early and consistently
- Writing testable, type-safe code
- Keeping things readable for future developers

No frameworks like NestJS are used here — just plain Express with structure — to demonstrate manual control over architectural decisions.

---

## Testing

```bash
npm test            # Run all tests
npm run test:coverage
```

---

## Quickstart

### Quick Start (Docker - Recommended)
```bash
# Clone and setup
git clone <repo-url>
cd bug-bounty-admin-api

# Start with Docker (includes PostgreSQL + Redis)
docker-compose -f docker-compose.dev.yml up

# The API will be available at http://localhost:3000
# Swagger docs at http://localhost:3000/api-docs
```

### Manual Setup
```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database credentials

# Run migrations and seed data
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

### Database Commands
```bash
npm run db:migrate       # Run pending migrations
npm run db:migrate:revert # Revert last migration
npm run db:seed          # Seed sample data
npm run db:reset         # Reset and reseed database
```

**🎯 Demo the API with Swagger UI:**
1. Open http://localhost:3000/api-docs/ in your browser
2. Click "Authorize" and enter: `test-api-token-123`
3. Try any endpoint directly from the interactive documentation
4. Generate sample data: `cd scripts && python3 scanner.py`

---

## Interactive API Documentation

This project includes **comprehensive Swagger/OpenAPI 3.0 documentation** for easy demonstration and testing:

### 📖 **Access Documentation**
- **Swagger UI**: http://localhost:3000/api-docs/
- **OpenAPI JSON**: http://localhost:3000/api-docs.json

### 🔐 **Authentication for Testing**
Use this token in the Swagger "Authorize" button:
```
test-api-token-123
```

### 🚀 **Demo Features**
- **Interactive Testing** - Execute API calls directly from the documentation
- **Request/Response Examples** - See real data structures and validation
- **Schema Validation** - Test input validation and error handling
- **Authentication Flow** - Demonstrate token-based security
- **Professional Documentation** - Enterprise-ready API specification

### 📊 **Sample Data Generation**
Run the Python scanner to create sample vulnerability reports:
```bash
cd scripts
python3 scanner.py
```

This generates 3 sample reports with different severities for demonstration purposes.

---

## Example Endpoint

**Submit a Report** (also available in Swagger UI)

```
POST /api/v1/reports

{
  "title": "SQL Injection in login",
  "severity": "high",
  "category": "SQL Injection",
  "submittedBy": "researcher@example.com",
  "description": "Full description...",
  "reproductionSteps": ["Step 1", "Step 2"],
  "impact": "Leaked sensitive data"
}
```

**💡 Pro Tip**: Instead of manually crafting requests, use the Swagger UI at `/api-docs/` for interactive testing with built-in validation and examples.

---

## Why This Project?

I built this to demonstrate more than just syntax. It’s about:
- How I think about backend systems
- How I design interfaces for humans and machines
- How I balance structure, security, and pragmatism

It’s a snapshot of how I lead and review code — which is ultimately what this role is about.