# STACKZYRO CRM

A production-style CRM for **STACKZYRO — Turning Ideas Into Digital Solutions**, built for an
Admin and a Staff team to manage leads, calls, follow-ups, proposals, meetings, clients,
attendance and reports.

Light purple-and-white theme, Inter typography, Lucide icons, Recharts charts, responsive
layouts and a real FastAPI + SQLAlchemy backend. No dashboard value is hardcoded: every card,
chart, report and table is calculated from database records.

---

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, Lucide React, Recharts |
| Backend | FastAPI, SQLAlchemy 2, Pydantic v2, PyJWT, bcrypt |
| Database | PostgreSQL (configure `DATABASE_URL`); SQLite fallback for local development |

---

## Getting started

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows
./.venv/Scripts/python.exe -m pip install -r requirements.txt
# macOS / Linux
source .venv/bin/activate && pip install -r requirements.txt

./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

The API runs at `http://127.0.0.1:8000` (docs at `/docs`).

On first start the database tables are created and — if `SEED_SAMPLE_DATA=true` — a **sample
workspace** is generated. The UI shows a `Sample data` badge while those demo records exist.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to the backend on port 8000.

### Demo accounts

The seeded sample workspace contains:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@stackzyro.com` | `Admin@123` |
| Staff | `ayesha@stackzyro.com` | `Staff@123` |

The login screen has one-click fill buttons for both roles. Change these passwords before any
real use (Settings → Security).

---

## PostgreSQL

PostgreSQL is the intended production database. Install the driver and set `DATABASE_URL`:

```bash
pip install "psycopg[binary]"
```

`backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://stackzyro:stackzyro@localhost:5432/stackzyro
SECRET_KEY=<a long random string>
CORS_ORIGINS=http://localhost:5173
```

Create the database once:

```sql
CREATE DATABASE stackzyro;
```

Tables are created automatically with SQLAlchemy metadata on startup. For a local evaluation
without PostgreSQL, leave `DATABASE_URL` unset — the app falls back to `backend/stackzyro.db`
(SQLite). The Settings page shows which database is active.

To reset the sample data:

```bash
cd backend
./.venv/Scripts/python.exe -m app.seed --reset
```

---

## Feature map

| Area | What is implemented |
| --- | --- |
| Authentication | JWT bearer sessions, bcrypt password hashing, remember me, show/hide password, validation, clear API errors, role-aware redirect |
| Routing | Protected routes, admin-only Staff Management and Reports, staff scoped to their own records |
| Dashboards | Separate Admin and Staff dashboards; 9 admin / 7 staff metric cards; daily + weekly call activity chart; lead status overview; today's follow-ups; staff attendance; recent activity; check-in/check-out for staff |
| Leads | Full table with lead ID, business, contact, phone, category, services, owner, status and next follow-up; search, status/staff/service/date filters, sorting, pagination, CSV export; add/edit modal with all fields; detail view with call, follow-up and proposal history; lead deletion with confirmation; conversion to client |
| Calls | Dedicated call log and recording modal; 7 outcomes; multiple calls per lead with no duplicate lead creation; optional automatic follow-up; ranges and filters; admin deletion |
| Follow-ups | Today / Upcoming / Overdue / Completed / All views, month calendar with day selection, table with contact method and status badges, complete/cancel/reschedule actions, automatic overdue detection |
| Proposals | List with status workflow; 7 reusable service templates; create flow; editor for overview, requirements, scope, deliverables, timeline, pricing, tax/discount, payment terms, additional costs and terms; live A4 preview; standalone A4 preview with browser PDF export; mark sent; record acceptance/rejection |
| Meetings | Schedule Google Meet / on-site / phone meetings; link or location; assigned staff; statuses; join link; edit and delete |
| Clients | Confirmed clients only (created when a lead is converted); project status, services, start date and owner; admin editing |
| Attendance | Present / absent / on leave / total staff summary; date-range records; check-in and check-out; working hours; admin edit and mark-attendance modals |
| Staff Management | Staff IDs, profiles, login credentials, roles, joining dates, activation/deactivation, staff performance breakdown |
| Reports | Lead, call, proposal, attendance and follow-up reports for Today / Yesterday / This Week / This Month / Custom range; staff-wise performance table; lead-source split; CSV export; print-to-PDF |
| Settings | Company details and logo, user profile, password change, staff permissions, CRM preferences, active database and sample-data notice |
| UX | Toasts, skeleton loaders, empty states, confirmation dialogs, modal dialogs, keyboard command palette (`Ctrl/Cmd + K`), collapsible sidebar, mobile drawer, subtle page transitions and A4 print styles |

### Counting rules

* **Total leads** counts one row per unique business in `leads`.
* **Total calls** counts every record in `calls`. Calling the same business five times produces
  five calls and still one lead.
* Follow-ups, proposals and meetings attach to the existing lead by `lead_id`.
* Dashboard comparisons appear only where the backend supplies a real `last_30_days` value; no
  synthetic trends are generated.

---

## Project structure

```
backend/
  app/
    main.py            FastAPI app, CORS, startup seeding
    config.py          Environment configuration
    database.py        Engine/session + database label
    models.py          SQLAlchemy models
    schemas.py         Request validation
    security.py        bcrypt hashing + JWT
    deps.py            Auth / role dependencies
    serialize.py       API response shapes
    constants.py       Statuses and proposal templates
    seed.py            Clearly-labelled sample workspace
    routers/           auth, meta, dashboard, leads, calls, followups,
                       proposals, meetings, clients, attendance, staff,
                       reports, settings, activities
frontend/
  src/
    components/ui/     Reusable design system (buttons, cards, tables, modals …)
    components/layout/ Sidebar, topbar, command palette, shell
    components/leads/  Lead form modal
    components/calls/  Record-call modal
    components/proposals/ A4 proposal document
    context/           Auth, meta and toast providers
    pages/             One module per CRM area
    lib/               API client, types, formatting, navigation
```

---

## Notes and limitations

* **PDF export** uses the browser's print dialog (`Save as PDF`) against the dedicated A4
  stylesheet. The document is not generated server-side.
* The local evaluation environment did not have PostgreSQL installed, so the runtime here uses
  the SQLite fallback. All queries are written with SQLAlchemy and are PostgreSQL-compatible;
  verify against your PostgreSQL instance before production use.
* Sample records are demo data and are labelled as such in the UI. Replace or remove them before
  entering real business data.
* Staff permissions are stored as workspace policy and enforced in the UI; record scoping
  (staff can only access their assigned leads/calls/follow-ups) is enforced by the API.
