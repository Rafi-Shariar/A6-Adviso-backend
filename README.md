# Backend Setup & Starter Guide With Ts | Postgress | Prisma

## 1. Overview

PH Healthcare System Backend is a production-ready, full-stack REST API built with **Express (v5)**, **TypeScript**, and **Prisma ORM** over PostgreSQL. The application is structured around modular domain design and includes pre-configured tools for authentication, caching, file storage, email dispatching, and linting.

This document outlines the step-by-step procedure required to configure your environment, initialize the database, understand pre-installed dependencies, and run the server locally.

---

## 2. Pre-Installed Tech Stack & Packages

The template comes pre-configured with the following core modules and packages:

| Category | Tools & Libraries | Purpose |
| :--- | :--- | :--- |
| **Runtime & Framework** | `express` (v5.x), `typescript` (v7.x), `tsx` | High-performance API server with native ESM support and live reload |
| **Database & ORM** | `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg` | PostgreSQL multi-file schema management and typed query building |
| **Authentication & Security** | `jsonwebtoken`, `bcryptjs`, `google-auth-library`, `cookie-parser`, `cors` | Token-based auth, Google OAuth, password hashing, and cookie handling |
| **Validation & Error Handling**| `zod`, `http-status` | Schema validation for payloads and centralized HTTP status constants |
| **Caching & In-Memory** | `redis` | Session storage, caching, and rate limiting support |
| **File Handling & Cloud** | `multer`, `cloudinary` | Multipart form parsing and cloud media upload management |
| **Email & Notifications** | `nodemailer`, `ejs` | Transactional email delivery with HTML template rendering |
| **Linting & Code Style** | `@biomejs/biome` | Ultra-fast TypeScript code formatting and static analysis |

---

## 3. Environment Variables Configuration (`.env`)

Before running the server, duplicate `.env.example` to create `.env`:

```bash
cp .env.example .env
```

Review and update the variables according to your local/cloud setup:

| Variable | Required Action / Description |
| :--- | :--- |
| `NODE_ENV` | Set to `development` or `production`. |
| `PORT` | Local server port (Default: `5000`). |
| `DATABASE_URL` | **Mandatory:** Replace with your actual PostgreSQL connection string: `postgresql://<user>:<password>@<host>:<port>/<database>?schema=public`. |
| `JWT_ACCESS_SECRET` | 256-bit secret string for short-lived access tokens. |
| `JWT_REFRESH_SECRET` | 256-bit secret string for long-lived refresh tokens. |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifespan (e.g., `1d`, `15m`). |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifespan (e.g., `7d`, `30d`). |
| `BCRYPT_SALT_ROUNDS` | Cost factor for hashing (Default: `10`). |
| `BACKEND_URL` | Base API URL (e.g., `http://localhost:5000`). |
| `FRONTEND_URL` | Allowed client origin for CORS policy (e.g., `http://localhost:3000`). |
| `GOOGLE_CLIENT_ID` | OAuth Client ID from Google Cloud Console for Google Sign-In. |
| `SUPER_ADMIN_NAME` | Default display name for the root administrator. |
| `SUPER_ADMIN_EMAIL` | Default administrator email address. |
| `SUPER_ADMIN_PASSWORD` | Default administrator login password. |
| `REDIS_USER` | Redis instance username (`default` for standard setups). |
| `REDIS_PASSWORD` | Redis connection password. |
| `REDIS_HOST` | Redis hostname or cloud URI. |
| `REDIS_PORT` | Redis server port (Default: `6379` or cloud port). |
| `SMTP_USER` | Email address configured for Nodemailer. |
| `EMAIL_SENDER` | Display email address for outbound emails. |
| `SMTP_PASSWORD` | App-specific password generated from Google Account Security. |
| `CLOUDINARY_CLOUD_NAME`| Cloud name from Cloudinary Dashboard. |
| `CLOUDINARY_API_KEY` | API key from Cloudinary Dashboard. |
| `CLOUDINARY_API_SECRET` | API secret key from Cloudinary Dashboard. |

---

## 4. Step-by-Step Setup & Execution

### Step 1: Install Dependencies
Download and link all project dependencies:
```bash
npm install
```

### Step 2: Configure Environment
Copy and populate the required environment variables:
```bash
cp .env.example .env
```

### Step 3: Database Synchronization & Client Generation
Synchronize the Prisma models located in `prisma/schema/` with your PostgreSQL database and generate the Prisma Client:
```bash
# Push schema changes directly to the database
npx prisma db push

# Generate client definitions into src/generated/prisma
npx prisma generate
```

### Step 4: Launch Development Server
Start the application in watch mode using `tsx`:
```bash
npm run dev
```
The server will boot up at `http://localhost:5000` (or your configured `PORT`).

---

## 5. NPM Scripts Reference

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `tsx watch src/server.ts` | Runs the server in hot-reload watch mode. |
| `npm run build` | `tsc` | Compiles TypeScript source files into `dist/`. |
| `npm run start` | `node dist/src/server.js` | Runs the compiled production code. |
| `npm run format:check` | `npx @biomejs/biome format ./src` | Checks codebase formatting according to Biome standards. |
| `npm run format:fix` | `npx @biomejs/biome format --write ./src` | Automatically formats codebase files. |
| `npm run lint:check` | `npx @biomejs/biome lint ./src` | Inspects code for potential linting errors. |
| `npm run lint:fix` | `npx @biomejs/biome lint --write ./src` | Automatically fixes autofixable lint errors. |

---

## 6. Directory Structure

```text
.
├── prisma/
│   ├── schema/
│   │   ├── enums.prisma           # Global database enums
│   │   ├── patient.prisma         # Patient model and relations
│   │   ├── schema.prisma          # Datasource & Client configuration
│   │   └── user.prisma            # User and authentication models
│   └── migrations/                # Database migration history
├── src/
│   ├── app/
│   │   ├── config/                # Environment configuration loader
│   │   ├── lib/                   # Third-party integrations (Prisma, Redis, Cloudinary)
│   │   ├── middleware/            # Auth guards, request validator, error handler
│   │   ├── module/                # Domain-driven features (routes, controllers, services)
│   │   └── templates/             # EJS templates for transactional emails
│   ├── generated/
│   │   └── prisma/                # Generated Prisma client output
│   ├── utils/                     # Error helpers, async wrapper, response formats
│   ├── app.ts                     # Express app setup and middleware pipeline
│   └── server.ts                  # Server entry point and database connection logic
├── .env.example                   # Sample environment configuration
├── biome.json                     # Biome formatter & linter configuration
├── package.json                   # Project dependencies and script runner
└── tsconfig.json                  # TypeScript compiler settings