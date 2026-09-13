# AD Identity Management Portal

A production-ready **Active Directory Identity Management Portal** built with Next.js 16, TypeScript, Prisma ORM, SQLite, and shadcn/ui. Features role-based access control (RBAC) with 4 roles and 14 permissions, JWT authentication, complete audit logging, Civil ID verification for agents, QR code password delivery, and optional real LDAP/LDAPS integration.

---

## Features

- **RBAC** — 4 roles (Superadmin, Administrator, Supervisor, Password Reset Agent) with 14 granular permissions
- **JWT Authentication** — bcrypt password hashing, 5-failure account lockout (15 min), 8-hour session expiry
- **AD Operations** — Reset Password, Unlock Account, Enable/Disable Account, Force Password Change
- **QR Code Password** — Scannable QR code with temporary password, print-ready handout
- **Civil ID Verification** — Agents must verify a user's Civil ID before performing any operation
- **Audit Trail** — Every action logged with timestamp, agent, IP, and result
- **Dual Mode** — Demo mode (200 mock users) or Live AD/LDAP (zero code changes)
- **Excel Export** — Admin can export all Civil ID verification records to Excel
- **Responsive** — Mobile-first design with dark/light theme support

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI Components | shadcn/ui (New York style) + Lucide Icons |
| Styling | Tailwind CSS 4 |
| Database | SQLite via Prisma ORM |
| Authentication | JWT + bcryptjs |
| State Management | Zustand (persisted) |
| AD/LDAP | ldapjs |
| QR Code | qrcode (client-side) |
| Notifications | Sonner (toast) |
| Animations | Framer Motion |

---

## Prerequisites

- **[Node.js](https://nodejs.org/)** v18+ (LTS recommended) — OR **[Bun](https://bun.sh/)** v1.0+
- **[npm](https://www.npmjs.com/)** (comes with Node.js) — OR **[bun](https://bun.sh/)**
- **Git** — to clone the repository

---

## Quick Start (Windows)

### 1. Install Node.js

Download and install **Node.js v18+ (LTS)** from [https://nodejs.org](https://nodejs.org/).

> Bun also works on Windows. If you prefer Bun, install it from [https://bun.sh](https://bun.sh) and replace every `npx` / `npm` command below with `bunx` / `bun`.

### 2. Clone the Project

Open **PowerShell** or **Command Prompt** and run:

```powershell
git clone <your-repo-url> ad-identity-portal
cd ad-identity-portal
```

### 3. Install Dependencies

```powershell
npm install
```

### 4. Create the Environment File

Open **Notepad** (or any text editor) and create a file named `.env` in the project root with this content:

```env
DATABASE_URL=file:./db/custom.db
JWT_SECRET=your-secure-secret-key-here
```

> **Demo Mode**: Leave `AD_BIND_DN` and `AD_BIND_PASSWORD` empty (or omit them). The app will auto-generate 200 mock AD users — no real AD server needed.

### 5. Create the Database Directory and Initialize

```powershell
# Create db folder (if it doesn't exist)
New-Item -ItemType Directory -Force -Path db

# Push schema to SQLite
npx prisma db push --accept-data-loss

# Generate Prisma client
npx prisma generate
```

### 6. Seed the Database

```powershell
npx tsx prisma/seed.ts
```

This creates:
- 3 roles with 13 permissions
- 5 portal users (admin, 1 supervisor, 3 agents)
- Sample audit logs and AD operation records

### 7. Start the Development Server

```powershell
npm run dev
```

The app starts on **http://localhost:3000**. Open it in your browser.

> **Tip**: You can also double-click `dev.bat` in File Explorer to start the server.

### 8. (Optional) Switch to Live AD

Edit `.env` and add your AD credentials:

```env
AD_HOST=10.177.19.9
AD_PORT=389
AD_USE_SSL=false
AD_BASE_DN=DC=ministry,DC=housing,DC=gov,DC=om
AD_BIND_DN=CN=svc-adportal,OU=Service Accounts,DC=ministry,DC=housing,DC=gov,DC=om
AD_BIND_PASSWORD=YourServiceAccountPassword
AD_DOMAIN=ministry.housing.gov.om
```

Then restart the server with `Ctrl+C` and `npm run dev`.

---

## Quick Start (Linux / macOS)

### 1. Clone the Project

```bash
git clone <your-repo-url> ad-identity-portal
cd ad-identity-portal
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Create the Environment File

```bash
cat > .env << 'EOF'
DATABASE_URL=file:./db/custom.db
JWT_SECRET=your-secure-secret-key-here
EOF
```

> **Demo Mode**: Leave `AD_BIND_DN` and `AD_BIND_PASSWORD` empty (or omit them). The app will auto-generate 200 mock AD users — no real AD server needed.

### 4. Initialize the Database

```bash
mkdir -p db
bun run db:push
bun run db:generate
```

### 5. Seed the Database

```bash
bunx tsx prisma/seed.ts
```

This creates:
- 3 roles with 13 permissions
- 5 portal users (admin, 1 supervisor, 3 agents)
- Sample audit logs and AD operation records

### 6. Start the Development Server

```bash
bun run dev
```

The app starts on **http://localhost:3000**.

---

## Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Superadmin | `superadmin` | `SuperAdmin@123` |
| Administrator | `admin` | `Admin@123` |
| Supervisor | `supervisor1` | `Super@123` |
| Password Reset Agent | `agent1` | `Agent1@123` |
| Password Reset Agent | `agent2` | `Agent2@123` |
| Password Reset Agent | `agent3` | `Agent3@123` |

---

## Environment Variables

### Required

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database file path | `file:./db/custom.db` |
| `JWT_SECRET` | Secret key for JWT token signing | (built-in fallback — change in production) |

### Optional — Active Directory / LDAP

| Variable | Description | Default |
|----------|-------------|---------|
| `AD_HOST` | AD/LDAP server hostname or IP | `10.177.19.9` |
| `AD_PORT` | LDAP port | `389` (LDAP) / `636` (LDAPS) |
| `AD_USE_SSL` | Enable LDAPS (TLS) | `false` |
| `AD_BASE_DN` | Active Directory base DN | `DC=ministry,DC=housing,DC=gov,DC=om` |
| `AD_BIND_DN` | Service account DN for binding | _(empty = Demo Mode)_ |
| `AD_BIND_PASSWORD` | Service account password | _(empty = Demo Mode)_ |
| `AD_DOMAIN` | AD domain name | `ministry.housing.gov.om` |
| `AD_SEARCH_BASE` | Search base for user queries | _(falls back to `AD_BASE_DN`)_ |
| `AD_USER_FILTER` | LDAP filter for user search | `(objectClass=user)` |
| `AD_PAGE_SIZE` | LDAP paged search size | `100` |

> When `AD_BIND_DN` and `AD_BIND_PASSWORD` are empty, the app runs in **Demo Mode** with 200 mock users. No real AD server is required for testing or demos.

---

## Project Structure

```
ad-identity-portal/
├── .env                          # Environment configuration
├── prisma/
│   ├── schema.prisma             # 7 DB models
│   └── seed.ts                   # Initial data (roles, users, audit logs)
├── db/
│   └── custom.db                 # SQLite database (auto-created)
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout with providers
│   │   ├── page.tsx              # Main entry (renders app shell)
│   │   ├── globals.css           # Tailwind styles
│   │   └── api/[...path]/
│   │       └── route.ts          # Catch-all API dispatcher
│   ├── components/
│   │   ├── layout/
│   │   │   └── app-shell.tsx     # Navigation, sidebar, header, footer
│   │   ├── pages/
│   │   │   ├── login-page.tsx        # Login with lockout
│   │   │   ├── dashboard-page.tsx    # Stats, activity feed
│   │   │   ├── user-search-page.tsx  # AD user search + operations
│   │   │   ├── agent-management-page.tsx  # Agent CRUD
│   │   │   └── audit-page.tsx        # Audit log viewer + CSV export
│   │   ├── password-qr-dialog.tsx # QR code password display
│   │   └── ui/                   # shadcn/ui components
│   ├── lib/
│   │   ├── api-handler.ts       # All 15+ API route handlers
│   │   ├── api-client.ts        # Frontend fetch wrapper
│   │   ├── ad-service.ts        # LDAP/LDAP connection service
│   │   ├── auth.ts              # JWT + bcrypt authentication
│   │   ├── db.ts                # Prisma client instance
│   │   ├── permissions.ts       # 13 RBAC permissions + role mapping
│   │   ├── prisma.ts            # Lazy Prisma client (Turbopack compat)
│   │   └── utils.ts             # Utility functions
│   └── stores/
│       └── auth-store.ts        # Zustand auth state (persisted)
├── public/
│   └── logo.svg                 # Application logo
├── dev.sh                       # Dev server startup script (Linux/macOS)
├── dev.bat                      # Dev server startup script (Windows)
├── next.config.ts               # Next.js configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Dependencies and scripts
```

---

## Database Schema

| Table | Description |
|-------|-------------|
| `roles` | 4 portal roles (Superadmin, Administrator, Supervisor, Password Reset Agent) |
| `permissions` | 13 granular permissions |
| `role_permissions` | Many-to-many role-permission mapping |
| `users` | Portal users (login accounts with role assignment) |
| `audit_logs` | Complete audit trail of every action |
| `ad_operations` | Detailed AD operation records |
| `civil_id_verifications` | Civil ID verification records for agent operations |

---

## RBAC Permissions

| Permission | Superadmin | Administrator | Supervisor | Agent |
|-----------|:---:|:---:|:---:|:---:|
| `search_users` | ✅ | ✅ | ✅ | ✅ |
| `view_user_details` | ✅ | ✅ | ✅ | ❌ |
| `reset_passwords` | ✅ | ✅ | ✅ | ✅ |
| `unlock_accounts` | ✅ | ✅ | ✅ | ✅ |
| `enable_ad_accounts` | ✅ | ✅ | ✅ | ✅ |
| `disable_ad_accounts` | ✅ | ✅ | ❌ | ✅ |
| `force_password_change` | ✅ | ✅ | ✅ | ❌ |
| `view_reports` | ✅ | ✅ | ✅ | ❌ |
| `view_all_audit_logs` | ✅ | ✅ | ❌ | ❌ |
| `export_audit_logs` | ✅ | ✅ | ❌ | ❌ |
| `create_agents` | ✅ | ✅ | ❌ | ❌ |
| `manage_roles` | ✅ | ✅ | ❌ | ❌ |
| `view_own_audit_logs` | ✅ | ✅ | ✅ | ✅ |
| `create_ad_accounts` | ✅ | ❌ | ❌ | ❌ |

---

## Key Workflows

### Password Reset (Agent Flow)

1. Agent searches for an AD user
2. **Civil ID Verification** — Agent enters the user's Civil ID number and expiry date (YYYY-MM-DD)
3. **Confirmation** — Agent reviews the operation details with a green "Civil ID Verified" badge
4. **Execution** — Password is reset, QR code dialog shows the new temporary password
5. **Delivery** — Agent prints the QR code handout or the user scans it with their phone

### Password Reset (Admin/Supervisor Flow)

1. Admin/Supervisor searches for an AD user
2. **Confirmation** — No Civil ID required, goes straight to confirmation
3. **Execution** — Same QR code password delivery

### Civil ID Export (Admin Only)

1. Admin clicks **"Export Civil IDs"** on the User Search page
2. Backend generates an Excel file with all verification records
3. File downloads automatically

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | No | Login with username/password |
| GET | `/api/auth/me` | Yes | Get current user info |
| GET | `/api/dashboard/stats` | Yes | Dashboard statistics |
| GET | `/api/users/search?q=` | Yes | Search AD users |
| GET | `/api/users/:username` | Yes | Get user details |
| POST | `/api/users/reset-password` | Yes | Reset user password |
| POST | `/api/users/unlock-account` | Yes | Unlock user account |
| POST | `/api/users/enable-account` | Yes | Enable user account |
| POST | `/api/users/disable-account` | Yes | Disable user account |
| POST | `/api/users/force-password-change` | Yes | Force password change on next login |
| GET | `/api/agents` | Yes | List portal agents |
| POST | `/api/agents` | Yes | Create new agent |
| PUT | `/api/agents/:id` | Yes | Update agent |
| DELETE | `/api/agents/:id` | Yes | Delete agent |
| GET | `/api/audit/logs` | Yes | Get audit logs (paginated) |
| GET | `/api/audit/export` | Yes | Export audit logs as CSV |
| GET | `/api/civil-id/export` | Yes | Export Civil ID records as Excel (Admin) |
| GET | `/api/ad/status` | No | AD connection status |
| POST | `/api/ad/test` | Yes | Test AD connection (Admin) |

---

## Production Deployment

### Build

```bash
# Linux / macOS
bun run build

# Windows
npm run build
```

### Run

```bash
# Linux / macOS
bun run start

# Windows
npm run start
```

### Deploying to a New Server

#### Linux / macOS

1. Copy the entire project directory to the server
2. Install Bun: `curl -fsSL https://bun.sh/install | bash`
3. Run: `bun install`
4. Create `.env` with your settings (see Environment Variables above)
5. Run: `mkdir -p db && bun run db:push && bun run db:generate && bunx tsx prisma/seed.ts`
6. Run: `bun run build && bun run start`

#### Windows Server

1. Copy the entire project directory (e.g. `C:\inetpub\ad-identity-portal`)
2. Install [Node.js LTS](https://nodejs.org/) if not already installed
3. Open PowerShell as Administrator in the project folder
4. Run: `npm install`
5. Create `.env` with your settings (see Environment Variables above)
6. Run:
   ```powershell
   New-Item -ItemType Directory -Force -Path db
   npx prisma db push --accept-data-loss
   npx prisma generate
   npx tsx prisma/seed.ts
   ```
7. Run: `npm run build && npm run start`

> **Windows Tip**: To run as a background service, use [PM2](https://pm2.keymetrics.io/): `npm install -g pm2 && pm2 start npm --name "ad-portal" -- start`

### Switching from Demo to Live AD

No code changes needed. Simply update `.env`:

```env
AD_BIND_DN=CN=svc-adportal,OU=Service Accounts,DC=ministry,DC=housing,DC=gov,DC=om
AD_BIND_PASSWORD=YourServiceAccountPassword
```

Then restart the server. The app will automatically detect the credentials and connect to the real AD server.

---

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` / `bun run dev` | Start development server (port 3000) |
| `npm run build` / `bun run build` | Production build |
| `npm run start` / `bun run start` | Start production server |
| `npm run lint` / `bun run lint` | Run ESLint |
| `npx prisma db push` / `bun run db:push` | Push Prisma schema to database |
| `npx prisma generate` / `bun run db:generate` | Generate Prisma client |
| `npx prisma migrate dev` / `bun run db:migrate` | Run Prisma migrations |
| `npx prisma migrate reset` / `bun run db:reset` | Reset database |
| `npx tsx prisma/seed.ts` / `bunx tsx prisma/seed.ts` | Seed demo data |

> On Windows, use `npm` / `npx`. On Linux/macOS, you can use either `npm` or `bun`.

### Windows Shortcut

Double-click **`dev.bat`** in File Explorer to start the dev server without opening a terminal.

---

## Security Notes

- **JWT_SECRET**: Always set a strong, unique secret in production. The built-in fallback is for development only.
- **Account Lockout**: After 5 failed login attempts, the account is locked for 15 minutes.
- **Session Expiry**: JWT tokens expire after 8 hours.
- **Civil ID Validation**: Backend enforces minimum 5 characters, YYYY-MM-DD date format, and rejects expired IDs.
- **RBAC Enforcement**: All API endpoints verify permissions server-side. Frontend hiding is cosmetic — backend is the authority.
- **Audit Trail**: Every AD operation and login attempt is permanently logged.

---

## License

Internal use — Ministry of Housing, Sultanate of Oman.
