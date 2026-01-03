# Claude Session Manager

A locally-hosted web application for managing Claude Code projects. Create orchestras to organize your repositories and manage Claude sessions across multiple projects from a single interface.

## Features

- **Orchestra Management**: Create and manage multiple project orchestras
- **Repository Organization**: Point orchestras at your git repositories
- **Clean Interface**: Mobile-friendly UI with responsive design
- **PostgreSQL Backend**: Persistent storage for orchestras and metadata

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL (local installation)
- [Claude Code](https://code.claude.com/) installed and configured

## Architecture

```
Next.js Web App (React 19)
        ↓
  API Routes
  - Orchestra CRUD operations
  - PostgreSQL via Prisma
        ↓
  PostgreSQL Database
  - Orchestras
  - Project metadata
```

## Setup

### 1. Install PostgreSQL

**macOS:**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Create Database

```bash
psql -U postgres
CREATE DATABASE orchestra_db;
\q
```

### 3. Configure Environment

Create a `.env` file:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/orchestra_db?schema=public"
PORT=3000
HOST=0.0.0.0
```

### 4. Install Dependencies & Run Migrations

```bash
npm install
npx prisma generate
npx prisma migrate dev
```

### 5. Run the App

```bash
npm run dev
```

The app will be available at:
- Local: http://localhost:3000
- Network: http://YOUR_LOCAL_IP:3000

## Usage

### 1. Create an Orchestra

1. Click "New Orchestra" on the home page
2. Provide:
   - **Name**: A descriptive name (e.g., "My App")
   - **Repository Path**: Absolute path to your git repository
   - **GitHub Remote** (optional): For future PR creation
   - **WIP Limit** (optional): Max concurrent work items

### 2. Manage Orchestras

- View all orchestras on the home page
- Click an orchestra card to view details
- Hover over a card to reveal the delete button
- Delete orchestras with confirmation prompt

## Project Structure

```
orchestra-app/
├── app/
│   ├── api/
│   │   ├── orchestras/      # Orchestra CRUD endpoints
│   │   ├── agents/          # Agent operations
│   │   └── backlog/         # Backlog management
│   ├── orchestra/[id]/      # Orchestra detail view
│   └── page.tsx             # Home page
├── lib/
│   ├── prisma.ts            # Database client
│   └── api-response.ts      # Response helpers
├── prisma/
│   └── schema.prisma        # Database schema
└── __tests__/               # Jest tests
```

## API Reference

### Orchestra Management
- `GET /api/orchestras` - List all orchestras
- `POST /api/orchestras` - Create orchestra
- `GET /api/orchestras/:id` - Get orchestra details
- `PATCH /api/orchestras/:id` - Update orchestra
- `DELETE /api/orchestras/:id` - Delete orchestra

## Database Schema

```prisma
model Orchestra {
  id             String          @id @default(uuid())
  name           String
  repositoryPath String
  githubRemote   String?
  wipLimit       Int             @default(2)
  status         OrchestraStatus @default(ACTIVE)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
}

enum OrchestraStatus {
  ACTIVE
  PAUSED
}
```

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Troubleshooting

### Database Connection Issues

1. Ensure PostgreSQL is running: `brew services list` or `sudo systemctl status postgresql`
2. Check your DATABASE_URL in `.env`
3. Verify database exists: `psql -U postgres -l`

### Port Already in Use

If port 3000 is taken, update `PORT` in `.env` or specify when running:

```bash
PORT=3001 npm run dev
```

## License

MIT
