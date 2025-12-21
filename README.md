# Orchestra - Claude Agent Orchestration Platform

Orchestra is a locally-hosted web application that enables you to orchestrate Claude coding agents to work collaboratively on software development projects. Manage multiple "orchestras" (one per repository), assign backlog items to agents, and interact with them through a mobile-friendly interface.

## Features

- **Multi-Orchestra Management**: Manage multiple repositories with separate orchestras
- **Agent Orchestration**: Spawn, pause, resume, and kill Claude agents
- **Backlog Management**: Parse markdown files for tasks and assign them to agents
- **Interactive Conversations**: Full CLI-like chat interface with streaming responses
- **Git Integration**: Automatic branch creation per backlog item
- **Mobile-Friendly**: Access from your phone on the local network
- **Revision Workflow**: Request revisions and approve completed work

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL (local installation)
- Claude API key from [Anthropic Console](https://console.anthropic.com/)
- Git installed and configured

## Setup

### 1. Install PostgreSQL

If you don't have PostgreSQL installed:

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

**Windows:**
Download and install from [PostgreSQL official website](https://www.postgresql.org/download/windows/)

### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE orchestra_db;

# Exit
\q
```

### 3. Configure Environment

Update the `.env` file with your settings:

```env
# Database Configuration
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/orchestra_db?schema=public"

# Claude API Configuration
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx  # Your actual API key

# Server Configuration
PORT=3000
HOST=0.0.0.0  # Allows access from local network
```

### 4. Install Dependencies & Setup Database

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init
```

## Running the Application

### Development Mode

```bash
npm run dev
```

The app will be available at:
- Local: http://localhost:3000
- Network: http://YOUR_LOCAL_IP:3000 (for mobile access)

To find your local IP:
- macOS/Linux: `ifconfig | grep "inet "`
- Windows: `ipconfig`

### Production Mode

```bash
npm run build
npm start
```

## Usage Guide

### 1. Prepare Your Repository

Create two markdown files in your repository root:

**PRD.md** - Your Product Requirements Document
**backlog.md** - Your task backlog with checkboxes or emojis

Example backlog.md:

```markdown
# Project Backlog

## Sprint 1
- [ ] Implement user authentication
- [ ] Create database schema for user profiles
- [ ] Add password reset functionality
- [ ] Write tests for auth endpoints

## Sprint 2
- [ ] Build dashboard UI
- [ ] Implement real-time notifications
- [ ] Add user settings page
```

### 2. Create an Orchestra

1. Click "New Orchestra" on the dashboard
2. Provide:
   - **Name**: A descriptive name for your orchestra
   - **Repository Path**: Absolute path to your git repository (e.g., `/Users/username/projects/myapp`)
3. The app will automatically look for `PRD.md` and `backlog.md` in the repository root

### 3. Spawn Agents

1. Navigate to your orchestra
2. Click "Spawn Agent"
3. Give your agent a name (e.g., "Agent-Frontend", "Agent-Backend")

### 4. Assign Tasks

1. Select a TODO item from the backlog
2. Choose an idle agent from the dropdown
3. The agent will:
   - Create a new git branch
   - Start working on the task
   - Update status to "IN_PROGRESS"

### 5. Monitor & Interact

- Click on an agent to view its conversation
- Send messages to guide the agent
- View real-time streaming responses
- Monitor task progress

### 6. Review & Approve

When an agent completes a task:
1. Review the changes in the conversation
2. Either:
   - **Approve**: Commits changes to the branch and marks task as done
   - **Request Revision**: Provide feedback for the agent to iterate

### 7. Mobile Access

Access Orchestra from your phone:
1. Ensure your phone is on the same Wi-Fi network
2. Navigate to `http://YOUR_COMPUTER_IP:3000`
3. All features work on mobile with responsive design

## Project Structure

```
orchestra-app/
├── app/
│   ├── api/                 # API endpoints
│   │   ├── orchestras/      # Orchestra management
│   │   ├── agents/          # Agent operations
│   │   └── backlog/         # Backlog management
│   ├── orchestra/
│   │   └── [id]/            # Orchestra detail view
│   └── page.tsx             # Dashboard
├── lib/
│   └── prisma.ts            # Database client
├── prisma/
│   └── schema.prisma        # Database schema
└── public/                  # Static assets
```

## API Reference

### Orchestra Management
- `GET /api/orchestras` - List all orchestras
- `POST /api/orchestras` - Create new orchestra
- `GET /api/orchestras/:id` - Get orchestra details
- `PATCH /api/orchestras/:id` - Update orchestra
- `DELETE /api/orchestras/:id` - Delete orchestra

### Agent Management
- `POST /api/orchestras/:id/agents` - Spawn new agent
- `GET /api/orchestras/:id/agents` - List agents
- `PATCH /api/agents/:id` - Update agent status
- `DELETE /api/agents/:id` - Kill agent
- `GET /api/agents/:id/messages` - Get conversation
- `POST /api/agents/:id/messages` - Send message (SSE streaming)

### Backlog Management
- `GET /api/orchestras/:id/backlog` - Parse and get backlog items
- `POST /api/backlog/:itemId/assign` - Assign item to agent
- `PATCH /api/backlog/:itemId` - Update item status
- `POST /api/backlog/:itemId/approve` - Approve completed work
- `POST /api/backlog/:itemId/revise` - Request revision

## Troubleshooting

### Database Connection Issues

If you get connection errors:
1. Ensure PostgreSQL is running
2. Check your DATABASE_URL in `.env`
3. Verify the database exists: `psql -U postgres -d orchestra_db`

### API Key Issues

If agents aren't responding:
1. Verify your ANTHROPIC_API_KEY in `.env`
2. Check API key validity at [Anthropic Console](https://console.anthropic.com/)

### Mobile Access Issues

If you can't access from mobile:
1. Ensure both devices are on the same network
2. Check firewall settings
3. Use the correct IP address (not localhost)
4. Try accessing with port explicitly: `http://192.168.x.x:3000`

## Future Enhancements (v1+)

- Auto-assignment of backlog items
- Agent collaboration on complex tasks
- Dependency management between items
- External access with authentication
- Asana integration for backlog
- GitHub PR creation
- Auto-merge approved changes
- Custom slash commands
- Skill definitions
- MCP server integration

## Contributing

This is currently a personal project, but suggestions and feedback are welcome!

## License

MIT
