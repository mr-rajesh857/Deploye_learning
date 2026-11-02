# Employee Leave Management System (3-Tier Architecture)

A 3-tier Employee Leave Management System built with:
- **Frontend**: Next.js (Port `3000`)
- **Backend**: FastAPI + SQLAlchemy + Pydantic (Port `8000`)
- **Database**: PostgreSQL (Port `5433`, Database: `Leave_management`)
- **Database Web Admin (Adminer)**: [http://localhost:8080/?pgsql=postgres&username=postgres&db=Leave_management&ns=public](http://localhost:8080/?pgsql=postgres&username=postgres&db=Leave_management&ns=public)

---

## 🚀 How to Run the Application

Run the backend and frontend in two separate terminal windows.

### Terminal 1: Run Backend (FastAPI)

```bash
cd /home/rajeshkumarpanda/Documents/Deploy_learning/backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **Interactive API Docs (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)

*(To deactivate the virtual environment later, simply run `deactivate`)*

---

### Terminal 2: Run Frontend (Next.js)

```bash
cd /home/rajeshkumarpanda/Documents/Deploy_learning/frontend
npm run dev -- -p 3000
```

- **Frontend Web Dashboard**: [http://localhost:3000](http://localhost:3000)

---

## 🗄️ Database & Adminer UI

Your PostgreSQL database is connected to `Leave_management`, and Adminer is accessible at:

```
http://localhost:8080/?pgsql=postgres&username=postgres&db=Leave_management&ns=public
```

Tables created in PostgreSQL:
1. `users` — Employees, Managers, HR Admins
2. `leave_types` — Annual Leave, Sick Leave, Casual Leave, Parental Leave, Unpaid Leave
3. `leave_balances` — Quotas and balances per user/year
4. `leave_requests` — Submitted leave applications
5. `audit_logs` — Approvals, rejections, and status change audit trails

---

## 🔐 User Login Page

Access the dedicated Login page at: **[http://localhost:3000/login](http://localhost:3000/login)**

### Pre-Seeded Demo Login Credentials:
| Persona | Email | Password | Role |
| :--- | :--- | :--- | :--- |
| **John Doe** | `employee@company.com` | `employee123` | Employee |
| **Sarah Connor** | `manager@company.com` | `manager123` | Engineering Manager |
| **Alex Rivera** | `admin@company.com` | `admin123` | HR Admin |
| **Emma Watson** | `designer@company.com` | `designer123` | UI/UX Designer |

*(The login page also has 1-click quick login buttons to sign in instantly as any role)*

---

## ⚙️ Environment Files (.env)

- Root Config: [`.env`](file:///home/rajeshkumarpanda/Documents/Deploy_learning/.env)
- Backend Config: [`backend/.env`](file:///home/rajeshkumarpanda/Documents/Deploy_learning/backend/.env)
- Frontend Config: [`frontend/.env.local`](file:///home/rajeshkumarpanda/Documents/Deploy_learning/frontend/.env.local)
