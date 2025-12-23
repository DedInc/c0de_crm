# C0de CRM - Telegram-Powered Freelance Management System

A modern, full-featured CRM system designed specifically for programming studios and freelance development teams. Seamlessly connect with customers through Telegram while managing your entire order workflow in a beautiful web interface.

## 🎨 Need a Custom Version?

**I am available for hire!**  

This system is production-ready, but your business might need specific modifications:
- Custom integrations (payment gateways, external APIs, CRM systems)
- Additional features (invoicing, time tracking, project management)
- White-label customization and branding
- Installation, deployment, and support services
- Training and documentation for your team

[Contact me](https://t.me/maehdakvan_1)

---

## 🎯 Why C0de CRM?

**For Programming Studios & Freelancers:**
- Accept orders directly through Telegram - meet customers where they are
- Visual Kanban board for intuitive project tracking
- Competitive bidding system - programmers can propose prices for orders
- Automatic notifications keep everyone in sync
- Role-based access control for teams of any size

**For Customers:**
- Create orders in seconds via Telegram bot - no registration required
- Real-time status updates on your projects
- Direct chat with support team through familiar Telegram interface
- Track multiple orders with ease

## ✨ Key Features

### 📱 Telegram Bot Integration
- **Instant Order Creation** - Customers create detailed orders through a guided conversation flow
- **Real-time Notifications** - Automatic updates on order approval, assignment, and status changes
- **In-Bot Chat** - Customers communicate with support without leaving Telegram
- **Multi-language Support** - English and Russian out of the box (stored per user)
- **Order Limit Protection** - Customers limited to 2 open orders to prevent spam
- **Order Deletion** - Customers can delete pending/rejected orders directly from bot
- **Payment Notifications** - Customers receive payment details with formatted instructions

### 📊 Visual Kanban Board
- **Drag-and-Drop Interface** - Move orders through stages: Approved → In Progress → Testing → Completed
- **Permission-Aware** - Programmers can only move their assigned orders; managers have full control
- **Stack Markers** - Color-coded technology tags for quick visual identification
- **Real-time Updates** - Changes sync instantly across all users

### 👥 Team Management
- **Flexible Role System** - Create custom roles with granular permissions (10 available)
- **Skill Tracking** - Assign technology markers to team members (React, Python, Node.js, etc.)
- **Telegram Linking** - Staff receive notifications directly in Telegram with verification
- **Order Assignment** - Assign orders to the right developer based on skills and responses
- **User Management** - Create users, assign multiple roles, manage credentials

### 💼 Order Lifecycle Management
- **Moderation Queue** - Review and approve/reject incoming orders (staff with `moderate_orders` permission)
- **Competitive Responses** - Programmers submit price proposals for approved orders
- **Budget Validation** - Proposed prices validated against customer budgets (if specified)
- **Status Workflow** - Full lifecycle from creation to delivery with customer notifications
- **Order Deletion** - Customers can delete pending or rejected orders via Telegram
- **Response Management** - Staff review programmer proposals before assignment

### 💬 Real-time Customer Chat
- **Bidirectional Communication** - Staff messages appear in customer's Telegram
- **Order Context** - Chat is linked to specific orders for organized communication
- **Delegated Access** - Grant temporary chat permissions to assigned programmers
- **Server-Sent Events** - Real-time message updates without page refresh
- **Image Support** - Send and receive images in chat conversations
- **Chat State Tracking** - Active chat sessions tracked to prevent message loss

### 💳 Payment & Commission System
- **Payment Information Management** - Staff can send payment details to customers for active orders
- **Commission Settings** - Configurable commission rates (percentage + fixed amount) for calculating programmer payments
- **User Payment Details** - Programmers can save reusable payment details for different payment methods
- **Payment Tracking** - Full history of payment information sent for each order with timestamps
- **Secure Payment Flow** - Payment details only sent for orders in progress/testing/completed stages

## 🔐 Security & Permissions
- **10 Granular Permissions** - Control who can view, moderate, assign, respond, chat, and send payment info
  - `manage_users` - Create and manage user accounts
  - `manage_roles` - Create and manage roles
  - `manage_markers` - Create and manage stack markers
  - `moderate_orders` - Approve or reject orders
  - `assign_orders` - Assign orders to programmers
  - `view_orders` - View approved orders
  - `respond_orders` - Respond to orders with price proposals
  - `chat_customers` - Chat with customers
  - `update_order_status` - Update order status
  - `send_payment_info` - Send payment details to customers
- **Order-Level Permissions** - Temporary access grants for specific orders (e.g., chat access for assigned programmer)
- **Session Management** - Secure authentication with automatic expiration (7-day sessions)
- **Telegram Verification** - Verify Telegram ID linking with confirmation messages

## 🛠 Tech Stack

### Frontend (SvelteKit)
| Technology | Purpose |
|------------|---------|
| **SvelteKit** | Full-stack framework with SSR |
| **Tailwind CSS 4** | Utility-first styling |
| **shadcn-svelte** | Beautiful, accessible UI components |
| **tRPC** | End-to-end type-safe API |
| **TypeBox** | Runtime validation |
| **Drizzle ORM** | Type-safe database queries |

### Backend
| Technology | Purpose |
|------------|---------|
| **PostgreSQL 16** | Primary database |
| **Dragonfly/Redis** | High-performance caching |
| **Server-Sent Events** | Real-time chat updates |

### Telegram Bot (Python)
| Technology | Purpose |
|------------|---------|
| **aiogram 3.x** | Modern async Telegram framework |
| **aiohttp** | Async HTTP client |
| **Webhook Server** | Receives CRM notifications |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| **Docker Compose** | One-command deployment |
| **Dragonfly** | 25x faster than Redis, drop-in compatible |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- Python 3.11+
- Docker & Docker Compose

### 1. Start Infrastructure
```bash
# Copy environment file and update with your credentials
cp .env.example .env
# Edit .env and set POSTGRES_PASSWORD to a secure value

# Start PostgreSQL and Dragonfly cache
docker-compose up -d
```
This starts PostgreSQL (port 5432) and Dragonfly cache (port 6379).

### 2. Setup CRM
```bash
cd site
cp .env.example .env
# Edit site/.env with your database credentials
pnpm install

# Run database migrations
pnpm drizzle-kit push

# Start development server
pnpm dev
```
Open http://localhost:5173 and login:
- **Username:** `admin`
- **Password:** `admin123`

**⚠️ IMPORTANT:** Change the default admin password immediately after first login!

The first run automatically creates:
- Administrator, Support, and Programmer roles
- 10 default stack markers (Python, JavaScript, TypeScript, Java, React, Vue, Svelte, Node.js, PostgreSQL, MongoDB)
- All system permissions

### 3. Setup Telegram Bot
```bash
cd bot
cp .env.example .env
# Edit .env with your BOT_TOKEN from @BotFather and other settings

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start bot
python main.py
```

### 4. Production Deployment

For production deployment:

1. **Update all environment variables** with secure values
2. **Enable caching** in `site/.env`: `CACHE_ENABLED=true`
3. **Use a reverse proxy** (nginx) with SSL certificates
4. **Configure proper DATABASE_URL** with production database
5. **Set CRM_HOST** to your actual domain in `bot/.env`
6. **Change default passwords** for database and admin account

See deployment guides for specific platforms in the `/docs` folder (if available).
 Permissions |
|------|-------------|-------------|
| **Administrator** | Full system access - manage users, roles, markers, moderate and assign orders | All 10 permissions |
| **Support** | View orders, chat with customers, moderate orders, assign programmers, send payment info | `view_orders`, `chat_customers`, `moderate_orders`, `assign_orders`, `update_order_status`, `send_payment_info` |
| **Programmer** | View approved orders, submit price proposals, update status of assigned orders | `view_orders`, `respond_orders`
| **Administrator** | Full system access - manage users, roles, markers, moderate and assign orders |
| **Support** | View orders, chat with customers, moderate orders, assign to programmers |
| **Programmer** | View approved orders, submit price proposals, update status of assigned orders |

## 🔄 Order Workflow

```
Customer creates order (Telegram)
         ↓
   Pending Moderation (Staff notified)
         ↓
  ┌──────┴──────┐
  ↓             ↓
Approved     Rejected (Can be deleted by customer)
  ↓
Programmers respond with prices
  ↓
Staff assigns order → Programmer notified
  ↓
Payment info sent (optional) → Customer receives details
  ↓
In Progress ←→ Testing
         ↓
     Completed
         ↓
     Delivered
```

Each status change triggers a Telegram notification to the customer. Staff members with appropriate permissions are notified of new orders and responses.

## 🔔 Notification System

| Event | Recipients | Delivery Method |
|-------|-----------|-----------------|
| Order Created | Staff with `moderate_orders` permission | Telegram |
| Order Approved/Rejected | Customer | Telegram |
| Order Assigned | Customer + Assigned programmer | Telegram |
| New Response | Staff with `assign_orders` permission | Telegram |
| Status Change | Customer | Telegram |
| Chat Message (from CRM) | Customer | Telegram |
| C📊 Web Interface Pages

| Page | URL | Description |
|------|-----|-------------|
| **Dashboard** | `/dashboard` | Overview and analytics (requires authentication) |
| **Kanban Board** | `/kanban` | Drag-and-drop order management with status columns |
| **Orders List** | `/orders` | Tabular view of all orders with filtering |
| **Order Details** | `/orders/[id]` | Detailed order view with responses, chat, and actions |
| **Chat** | `/chat` | Real-time customer communication interface |
| **Users Management** | `/users` | Create/edit users, assign roles and tech markers |
| **Roles Management** | `/roles` | Configure roles and permissions |
| **Stack Markers** | `/markers` | Manage technology tags |
| **Payment Methods** | `/payment-methods` | Configure available payment options |
| **Profile** | `/profile` | User profile with Telegram linking |

## ⚡ Caching Strategy

| Data | TTL | Invalidation |
|------|-----|--------------|
| Users list | 5 min | On user CRUD |
| Roles list | 15 min | On role CRUD |
| User permissions | 15 min | On role/permission change |
| Permissions list | 1 hour | Static |
| Orders | 1 min | On order update |
| Markers | 15 min | On marker CRUD |

Configure in `site/.env`:
```env
CACHE_ENABLED=true
REDIS_URL=redis://localhost:6379
CACHE_TTL=300
```

Uses Dragonfly (Redis-compatible) for 25x faster performance.figure in `site/.env`:
```env
CACHE_ENABLED=true
REDIS_URL=redis://localhost:6379
CACHE_TTL=300
```

## 🌐 Localization

Both CRM and bot support English and Russian. Add new languages:

1. **CRM:** Create `site/src/lib/i18n/locales/{lang}.ts`
2. **Bot:** Create `bot/locales/{lang}.py`
3. Update imports in respective index files


## 🏗️ Architecture

### Communication Flow
```
Customer (Telegram) ←→ Bot (Python/aiogram) ←→ CRM (SvelteKit/tRPC) ←→ Database (PostgreSQL)
                                    ↑                         ↓
                              Webhook Server          SSE for real-time chat
                                    ↓                         ↑
                             Staff (Web Interface) ←→ Cache (Dragonfly)
```

### Bot Webhook Server
The bot includes a built-in webhook server (aiohttp) that receives notifications from the CRM:
- Order status changes
- Staff messages to customers
- Chat access grants
- Payment information

This allows bidirectional communication between the CRM and Telegram.

## 🔧 Environment Variables

### CRM (`site/.env`)
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/crm
CACHE_ENABLED=true
REDIS_URL=redis://localhost:6379
BOT_WEBHOOK_URL=http://localhost:8081
```

### Bot (`bot/.env`)
```env
BOT_TOKEN=your_telegram_bot_token
CRM_API_URL=http://localhost:5173/api/trpc
WEBHOOK_HOST=0.0.0.0
WEBHOOK_PORT=8081
```

## 🤝 Contributing

Contributions are welcome! This project is now open-source, and I encourage you to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code follows the existing style and includes appropriate tests.

## 📄 License

MIT License - feel free to use this for your own programming studio!

See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with modern tools: SvelteKit, tRPC, Drizzle ORM, aiogram
- Inspired by the need for better freelance order management
- Thanks to the open-source community for the amazing tools and libraries

---

**Built with ❤️ for programming studios who want to streamline their order management while keeping customers happy through Telegram.**
