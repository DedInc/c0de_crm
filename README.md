# C0de CRM

A CRM system built for freelance development teams. It splits the workflow into two interfaces: a SvelteKit web dashboard for staff (managers, developers) and a Telegram bot for customers. 

The core idea is that the Telegram bot is completely stateless. It doesn't have its own database or ORM; it acts as a thin UI layer that forwards all operations to the SvelteKit backend via internal tRPC calls.

If you need a white-label version of this system, custom payment gateway integration, or specific feature development, contact me on Telegram: [maehdakvan_1](https://t.me/maehdakvan_1)

## Architecture Overview

* **Web Dashboard (`site/`):** Built with SvelteKit and Svelte 5 (Runes). Uses tRPC for end-to-end type safety between the client and server. Styled with Tailwind CSS 4 and shadcn-svelte.
* **Telegram Bot (`bot/`):** Written in Python using `aiogram` 3.x. It communicates with the web dashboard via an internal API. 
* **Database:** PostgreSQL managed by Drizzle ORM.
* **Caching & Pub/Sub:** Dragonfly (Redis drop-in replacement). Used for cache-aside data (with promise deduping to prevent cache stampedes) and pub/sub routing for the chat.
* **Real-time Chat:** Uses Server-Sent Events (SSE) to push new messages from Telegram to the web dashboard without polling. Redis pub/sub syncs SSE connections across multiple Node.js instances.
* **File Storage:** Cloudflare R2 (S3-compatible). Handles chat attachments and images. Generates presigned URLs for temporary access. If R2 is not configured, the system falls back to proxying files through the Telegram API.
* **Auth & RBAC:** Session-based authentication stored in Postgres. Includes a granular RBAC system with 10 specific permissions (e.g., `moderate_orders`, `assign_orders`, `chat_customers`).

## Local Development

### Prerequisites
* Node.js 20+ and pnpm
* Python 3.11+
* Docker & Docker Compose

### 1. Infrastructure
Start the database and cache services.

```bash
cp .env.example .env
# Edit .env to set POSTGRES_PASSWORD

docker-compose up -d postgres dragonfly
```

### 2. Web Dashboard
The SvelteKit app handles the database schema and migrations.

```bash
cd site
cp .env.example .env
# Make sure DATABASE_URL matches your docker-compose setup
# Generate a random string for INTERNAL_API_KEY (e.g., openssl rand -hex 32)

pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

**Important note on first run:** When the web server starts with an empty database, it will automatically seed default roles, permissions, and markers. It will also create the `admin` user and print a randomly generated password to the console. **Watch the terminal output** — it only prints this password once. You will be forced to change it on your first login.

### 3. Telegram Bot
You need a bot token from BotFather.

```bash
cd bot
cp .env.example .env
# Add your BOT_TOKEN
# Make sure INTERNAL_API_KEY exactly matches the one set in the site/.env

python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

## Environment Variables Configuration

Both applications rely on `.env` files. Here are the critical variables you need to configure.

### Site (`site/.env`)
```ini
DATABASE_URL=postgresql://crm_user:your_password@localhost:5432/crm_bot
INTERNAL_API_KEY=your_shared_secret_string

CACHE_ENABLED=true
REDIS_URL=redis://localhost:6379

BOT_WEBHOOK_URL=http://localhost:8081
CRM_BASE_URL=http://localhost:5173
BOT_TOKEN=your_bot_token # Required for file proxying if R2 is disabled

# Optional: Cloudflare R2 setup. If omitted, the system falls back to Telegram's file API.
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

### Bot (`bot/.env`)
```ini
BOT_TOKEN=your_bot_token
INTERNAL_API_KEY=your_shared_secret_string

# Points to the SvelteKit app
CRM_HOST=localhost:5173

# Internal webhook server settings (receives pushes from SvelteKit)
WEBHOOK_HOST=0.0.0.0
WEBHOOK_PORT=8081

# Used for aiogram FSM state persistence
REDIS_URL=redis://localhost:6379 

# Optional: If provided, the bot uploads files directly to R2 instead of proxying through SvelteKit
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

## Deployment Notes

1. **Routing:** Set up a reverse proxy (Nginx/Caddy) to handle SSL termination and route traffic to the SvelteKit Node server (usually port 3000 in prod).
2. **Internal Communication:** The SvelteKit backend makes HTTP POST requests to the Python bot on the `WEBHOOK_PORT` (default 8081) to deliver messages and notifications. Ensure your Docker network or firewall allows this internal routing. Do not expose port 8081 to the public internet.
3. **Production Build:**
   ```bash
   cd site
   pnpm build
   node build
   ```

## License
MIT