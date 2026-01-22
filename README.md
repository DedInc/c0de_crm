# C0de CRM

A CRM for freelance development teams that bridges a SvelteKit web dashboard with a Telegram bot. Customers manage orders and chat via Telegram; developers and managers handle the workflow, Kanban board, and billing via the web interface.

If you need a white-label version of this system, custom payment gateway integration, or specific feature development, contact me here: https://t.me/maehdakvan_1

## Overview

The system consists of three parts:
1.  **Web Dashboard (SvelteKit):** For administration, order management, Kanban tracking, and team configuration.
2.  **Telegram Bot (Python/aiogram):** The customer-facing interface for creating orders, receiving status updates, and chatting with support.
3.  **Infrastructure:** PostgreSQL for data and Dragonfly (Redis-compatible) for caching and session management.

## Tech Stack

**Frontend/Web:**
*   SvelteKit (SSR)
*   Tailwind CSS 4
*   shadcn-svelte components
*   tRPC (Type-safe API)
*   Drizzle ORM
*   TypeBox (Validation)

**Bot:**
*   Python 3.11+
*   aiogram 3.x
*   aiohttp (Webhook server)

**Backend/Infra:**
*   PostgreSQL 16
*   Dragonfly (Redis drop-in replacement)
*   Docker Compose

## Features

*   **Telegram Integration:** Customers create orders, receive real-time status updates, and chat with support without leaving Telegram.
*   **Role-Based Access:** 10 granular permissions (e.g., `moderate_orders`, `assign_orders`, `view_finance`).
*   **Kanban Workflow:** Drag-and-drop board for order stages (Approved -> In Progress -> Testing -> Completed).
*   **Bidding System:** Developers can propose prices/estimates for orders; managers approve and assign.
*   **Real-time Chat:** Bidirectional communication between the web dashboard and Telegram user. detailed context is preserved per order.
*   **Localization:** Support for English and Russian (stored per user).

## Local Development

### Prerequisites
*   Node.js 18+ & pnpm
*   Python 3.11+
*   Docker & Docker Compose

### 1. Infrastructure Setup
Start the database and cache services.

```bash
# Copy env example
cp .env.example .env
# Set POSTGRES_PASSWORD in .env

docker-compose up -d
```

### 2. CRM (Web) Setup
The web app handles the database migrations.

```bash
cd site
cp .env.example .env
# Update .env with your DB credentials (from step 1)

pnpm install
pnpm drizzle-kit push
pnpm dev
```
Access at `http://localhost:5173`.
**Default Login:** `admin` / `admin123` (Change this immediately).

*Note: The first run seeds default roles, permissions, and stack markers.*

### 3. Bot Setup
The bot requires a token from BotFather.

```bash
cd bot
cp .env.example .env
# Add your BOT_TOKEN and set CRM_API_URL

python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

## Configuration

### Environment Variables

**Site (`site/.env`):**
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/crm
# Caching is optional in dev, recommended for prod
CACHE_ENABLED=true
REDIS_URL=redis://localhost:6379
# URL where the python bot listens for webhooks
BOT_WEBHOOK_URL=http://localhost:8081
```

**Bot (`bot/.env`):**
```env
BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
# URL of the SvelteKit API
CRM_API_URL=http://localhost:5173/api/trpc
# Webhook server settings (internal)
WEBHOOK_HOST=0.0.0.0
WEBHOOK_PORT=8081
```

### Caching
The system is configured to use Dragonfly (or Redis). Caching strategies:
*   **Static Data (Roles, Permissions):** High TTL (15m - 1h)
*   **Dynamic Data (Orders, Users):** Low TTL (1m - 5m) or invalidated on mutation.

## Deployment Notes

1.  **Reverse Proxy:** Use Nginx or Caddy to handle SSL and proxy requests to the SvelteKit app (port 3000/5173) and the Bot webhook (if exposed).
2.  **Webhook:** The bot runs an aiohttp server to receive updates from the CRM. Ensure the CRM container/process can reach the Bot container/process on `WEBHOOK_PORT`.
3.  **Production Build:**
    ```bash
    cd site
    pnpm build
    node build
    ```
