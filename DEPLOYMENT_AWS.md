# ☁️ AWS Free Tier Deployment Guide — Amazon Linux 2023 + AWS RDS PostgreSQL

This guide walks you through deploying your 3-Tier Employee Leave Management System (**Next.js + FastAPI + AWS RDS PostgreSQL**) using an **AWS EC2 (Amazon Linux 2023)** instance and an **AWS RDS PostgreSQL Free Tier** database.

---

## 🏗️ 3-Tier Architecture with AWS RDS

```
Internet (Users)
      │
      ▼ Port 80 (HTTP)
┌─────────────────────────────────────────────────────────────┐
│ AWS EC2 (Amazon Linux 2023 - Free Tier)                     │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Nginx Reverse Proxy (Port 80)                       │   │
│   │   ├── /api/*   ──────► FastAPI Backend (Port 8000)  │   │
│   │   └── /*       ──────► Next.js Frontend (Port 3000) │   │
│   └─────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                ▼ Port 5432
┌─────────────────────────────────────────────────────────────┐
│ AWS RDS PostgreSQL (db.t3.micro / db.t4g.micro - Free Tier) │
│ Database: Leave_management                                  │
│ Endpoint: leave-management-db.xxxxxx.us-east-1.rds.amazonaws.com│
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Step A: Stop Local PostgreSQL on EC2 (Since using RDS)

Since you already initialized local PostgreSQL on EC2, turn it off so it doesn't consume memory:

```bash
sudo systemctl stop postgresql
sudo systemctl disable postgresql
```

---

## 🐘 Step B: Create your AWS RDS PostgreSQL Database (Free Tier)

1. In the AWS Management Console top search bar, type **RDS** and click **RDS**.
2. Click the orange **Create database** button.
3. Configure the database with these settings:
   - **Choose a database creation method**: **Standard create**.
   - **Engine options**: Select **PostgreSQL**.
   - **Templates**: Select **Free tier** (Important! This restricts settings to Free Tier eligible).
   - **Settings**:
     - **DB instance identifier**: `leave-management-db`
     - **Master username**: `postgres`
     - **Master password**: Enter a password (e.g. `postgres123` or your own choice) and remember it.
   - **Instance configuration**:
     - Keep default: `db.t3.micro` or `db.t4g.micro` (Free Tier eligible).
   - **Storage**:
     - Storage type: **General Purpose SSD (gp2 or gp3)**
     - Allocated storage: **20 GiB** (Free tier covers 20 GiB).
     - Storage autoscaling: Uncheck *Enable storage autoscaling* (to prevent exceeding free limits).
   - **Connectivity**:
     - **Compute resource**: Select **Connect to an EC2 compute resource**.
     - Choose your running EC2 instance (`leave-management-server`).
     *(AWS will automatically configure the Security Group so your EC2 can connect to RDS!)*
     - **Public access**: **No** (best security; only your EC2 needs access).
   - **Additional configuration** (click to expand):
     - **Initial database name**: Type **`Leave_management`** (Exact name!).
     - Backup: Keep default 1 day.
4. Scroll to the bottom and click **Create database**.
5. Wait ~5-8 minutes until the database **Status** changes from *Creating* to **Available**.
6. Click on `leave-management-db` and copy the **Endpoint** (e.g., `leave-management-db.c123456789.us-east-1.rds.amazonaws.com`).

---

## 🧪 Step C: Test RDS Connection from EC2

In your EC2 terminal, verify you can connect to RDS:

```bash
psql -h <YOUR_RDS_ENDPOINT> -U postgres -d Leave_management
```
*(Enter the RDS master password when prompted. Once connected, type `\q` to exit)*

---

## 📥 Step D: Clone your GitHub Repository on EC2

```bash
cd /home/ec2-user

# Clone the repository (production branch)
git clone -b production https://github.com/mr-rajesh857/Deploye_learning.git

# Move into project directory
cd /home/ec2-user/Deploye_learning
```

---

## ⚙️ Step E: Setup & Seed the FastAPI Backend with RDS

1. Create and activate Python virtual environment:
```bash
cd /home/ec2-user/Deploye_learning/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

2. Create the backend `.env` file pointing to **AWS RDS**:
*(Replace `<YOUR_RDS_ENDPOINT>` and `<YOUR_RDS_PASSWORD>` with your actual values)*

```bash
cat << 'EOF' > /home/ec2-user/Deploye_learning/backend/.env
DB_USER=postgres
DB_PASSWORD=<YOUR_RDS_PASSWORD>
DB_HOST=<YOUR_RDS_ENDPOINT>
DB_PORT=5432
DB_NAME=Leave_management
DATABASE_URL=postgresql://postgres:<YOUR_RDS_PASSWORD>@<YOUR_RDS_ENDPOINT>:5432/Leave_management

BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
CORS_ORIGINS=*
JWT_SECRET=supersecret-aws-rds-token-key-2026
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
EOF
```

3. Seed the PostgreSQL tables and default users inside RDS:
```bash
PYTHONPATH=. python3 app/seed.py
```
*(You will see: `Database successfully seeded with realistic sample data!`)*

---

## 🌐 Step F: Build the Next.js Frontend

1. Move to frontend directory:
```bash
cd /home/ec2-user/Deploye_learning/frontend
```

2. Create `.env.local` with your EC2 public IP:
```bash
cat << EOF > /home/ec2-user/Deploye_learning/frontend/.env.local
PORT=3000
NEXT_PUBLIC_API_URL=http://<YOUR_EC2_PUBLIC_IP>/api
EOF
```

3. Install packages and build:
```bash
npm install
npm run build
```

---

## 🚀 Step G: Run Both Services with PM2 (24/7 Autostart)

```bash
# 1. Start Backend
cd /home/ec2-user/Deploye_learning/backend
pm2 start "venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000" --name "leave-backend"

# 2. Start Frontend
cd /home/ec2-user/Deploye_learning/frontend
pm2 start "npm start" --name "leave-frontend"

# 3. Save PM2 list & enable reboot autostart
pm2 save
pm2 startup
# (Copy and run the sudo env PATH... command printed by PM2)
```

---

## 🔄 Step H: Configure Nginx Reverse Proxy (Port 80)

1. Create the reverse proxy config:
```bash
sudo tee /etc/nginx/conf.d/leave-management.conf << 'EOF'
server {
    listen 80;
    server_name _;

    # Route /api requests to FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Route all web traffic to Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
```

2. Test and restart Nginx:
```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

---

## 🎉 Step I: Access your Live Application!

Open your browser and visit:
👉 **`http://<YOUR_EC2_PUBLIC_IP>`** (or `http://<YOUR_EC2_PUBLIC_IP>/login`)

- **Interactive API Docs**: `http://<YOUR_EC2_PUBLIC_IP>/api/docs`

### Demo Login Accounts:
- **Employee**: `employee@company.com` / `employee123`
- **Manager**: `manager@company.com` / `manager123`
- **HR Admin**: `admin@company.com` / `admin123`
