# 🚀 AWS Free Tier Complete Deployment Guide
### 3-Tier Employee Leave Management System
**Next.js (Frontend) + FastAPI (Backend) + AWS RDS PostgreSQL (Database)**  
**OS: Amazon Linux 2023 (AL2023) | Cloud: AWS Free Tier**

---

## 🏗️ 3-Tier Architecture Overview

```
 Internet (Browser / Users)
             │
             ▼ Port 80 (HTTP)
┌─────────────────────────────────────────────────────────────┐
│ AWS EC2 (Amazon Linux 2023 — t2.micro / t3.micro)          │
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
│ AWS RDS PostgreSQL (db.t3.micro / db.t4g.micro — Free Tier) │
│ Database Name: Leave_management                             │
│ Master User:   postgres                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Phase 1: AWS Console Setup (EC2 & RDS)

### Step 1.1: Launch Amazon Linux 2023 EC2 Instance
1. Go to the **[AWS EC2 Console](https://console.aws.amazon.com/ec2/)**.
2. Click **Launch instance**.
3. Configure the following:
   - **Name**: `leave-management-server`
   - **Application and OS Images (AMI)**: Choose **Amazon Linux** -> **Amazon Linux 2023 AMI** *(Free tier eligible)*.
   - **Instance type**: Select **`t2.micro`** (or `t3.micro`, marked *Free tier eligible*).
   - **Key pair (login)**:
     - Click **Create new key pair**.
     - Name: `leave-key`, format: `.pem`.
     - Download and save `leave-key.pem` on your local computer.
   - **Network settings**:
     - Check **Allow SSH traffic from Anywhere**.
     - Check **Allow HTTP traffic from the internet** (Port 80).
     - Check **Allow HTTPS traffic from the internet** (Port 443).
   - **Storage**: Set to **20 GiB gp3** (Free tier covers up to 30 GiB).
4. Click **Launch instance**.
5. Once in **Running** state, note down your **Public IPv4 address** (e.g., `15.206.84.214`).

---

### Step 1.2: Create AWS RDS PostgreSQL Database
1. Go to the **[AWS RDS Console](https://console.aws.amazon.com/rds/)**.
2. Click **Create database**.
3. Configure with these settings:
   - **Method**: **Standard create**.
   - **Engine**: **PostgreSQL**.
   - **Templates**: **Free tier** *(Important: ensures no unexpected charges)*.
   - **DB instance identifier**: `leave-management-db`.
   - **Master username**: `postgres`.
   - **Master password**: Enter a password (e.g., `postgres123`) and save it.
   - **Instance configuration**: `db.t3.micro` or `db.t4g.micro`.
   - **Storage**: **20 GiB** (gp2 or gp3). Uncheck *Enable storage autoscaling*.
   - **Connectivity**:
     - Under **Compute resource**, choose **Connect to an EC2 compute resource**.
     - Select your EC2 instance (`leave-management-server`). *(AWS will automatically link their security groups)*.
     - **Public access**: **No** *(recommended for security; only your EC2 needs access)*.
   - **Additional configuration** (click to expand):
     - **Initial database name**: Type **`Leave_management`** *(case-sensitive)*.
4. Click **Create database** at the bottom.
5. Wait 5–8 minutes until status becomes **Available**.
6. Click `leave-management-db` and copy the **Endpoint** (e.g., `leave-management-db.c123456789.us-east-1.rds.amazonaws.com`).

---

## 💻 Phase 2: Connect and Prepare the EC2 Server

Open your local terminal in the folder where your `leave-key.pem` is saved:

```bash
# 1. Set key permission
chmod 400 leave-key.pem

# 2. Connect to EC2
ssh -i leave-key.pem ec2-user@<YOUR_EC2_PUBLIC_IP>
```

Once connected inside the EC2 prompt (`[ec2-user@... ~]$`), install the required system packages:

```bash
# 1. Update system packages
sudo dnf update -y

# 2. Install Git, development tools, and Nginx
sudo dnf install -y git gcc gcc-c++ make nginx

# 3. Install Python 3, pip, and development headers
sudo dnf install -y python3 python3-pip python3-devel

# 4. Install Node.js 18, npm, and PM2 process manager
sudo dnf install -y nodejs npm
sudo npm install -g pm2

# 5. Install PostgreSQL client tools (to test RDS connection)
sudo dnf install -y postgresql15

# 6. Enable SELinux network connections (Crucial: prevents 502 Bad Gateway)
sudo setsebool -P httpd_can_network_connect 1
```

---

## 🧪 Phase 3: Test Connection to AWS RDS

Verify your EC2 instance can talk to your RDS database:

```bash
psql -h <YOUR_RDS_ENDPOINT> -U postgres -d Leave_management
```
*(Enter your RDS password. Once connected, type `\q` to exit)*.

---

## 📥 Phase 4: Clone the Project Repository

```bash
cd /home/ec2-user

# Clone production branch
git clone -b production https://github.com/mr-rajesh857/Deploye_learning.git

# Move into project directory
cd /home/ec2-user/Deploye_learning
```

---

## ⚙️ Phase 5: Set Up the FastAPI Backend

1. Create and activate the Python virtual environment:
```bash
cd /home/ec2-user/Deploye_learning/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

2. Create the Backend `.env` file pointing to **AWS RDS**:
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

3. Initialize the RDS tables and seed demo accounts:
```bash
PYTHONPATH=. python3 app/seed.py
```
*(Output will say: `Database successfully seeded with realistic sample data!`)*

---

## 🌐 Phase 6: Build the Next.js Frontend

1. Move to the frontend directory:
```bash
cd /home/ec2-user/Deploye_learning/frontend
```

2. Create `.env.local` configured with your EC2 public IP:
*(Replace `<YOUR_EC2_PUBLIC_IP>` with your instance's public IP)*
```bash
cat << EOF > /home/ec2-user/Deploye_learning/frontend/.env.local
PORT=3000
NEXT_PUBLIC_API_URL=http://<YOUR_EC2_PUBLIC_IP>/api
EOF
```

3. Ensure `package.json` and `next.config.mjs` are configured for Node 18:
```bash
cat << 'EOF' > /home/ec2-user/Deploye_learning/frontend/package.json
{
  "name": "frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "lucide-react": "^0.469.0",
    "next": "14.2.24",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "eslint": "^8",
    "eslint-config-next": "14.2.24"
  }
}
EOF

cat << 'EOF' > /home/ec2-user/Deploye_learning/frontend/next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
EOF
```

4. Install dependencies and build:
```bash
npm install
npm run build
```

---

## 🚀 Phase 7: Run Both Services with PM2 (24/7 Autostart)

PM2 keeps your application running 24/7 in the background:

```bash
# 1. Start FastAPI Backend
cd /home/ec2-user/Deploye_learning/backend
pm2 start "venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000" --name "leave-backend"

# 2. Start Next.js Frontend
cd /home/ec2-user/Deploye_learning/frontend
pm2 start "npm start -- -p 3000" --name "leave-frontend"

# 3. Check status (Both should show "online")
pm2 status

# 4. Save and enable reboot autostart
pm2 save
pm2 startup
# (Copy and paste the sudo env PATH... command that PM2 outputs)
```

---

## 🔄 Phase 8: Configure Nginx as Reverse Proxy (Port 80)

1. Create a clean main `/etc/nginx/nginx.conf`:
```bash
sudo tee /etc/nginx/nginx.conf << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile        on;
    tcp_nopush      on;
    keepalive_timeout  65;
    gzip  on;

    # Load custom configurations from conf.d
    include /etc/nginx/conf.d/*.conf;
}
EOF
```

2. Create the site configuration in `/etc/nginx/conf.d/leave-management.conf`:
```bash
sudo tee /etc/nginx/conf.d/leave-management.conf << 'EOF'
server {
    listen 80 default_server;
    server_name _;

    # Route /api/ to FastAPI Backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Route all web pages to Next.js Frontend
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

3. Test and restart Nginx:
```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

---

## 🎉 Phase 9: Access your Live Application!

Open your browser and navigate to:
👉 **`http://<YOUR_EC2_PUBLIC_IP>`** (or `http://<YOUR_EC2_PUBLIC_IP>/login`)

- **Interactive API Swagger Docs**: `http://<YOUR_EC2_PUBLIC_IP>/api/docs`

### 🔑 Demo Login Accounts:
| Persona | Email | Password | Role |
| :--- | :--- | :--- | :--- |
| **John Doe** | `employee@company.com` | `employee123` | Employee |
| **Sarah Connor** | `manager@company.com` | `manager123` | Engineering Manager |
| **Alex Rivera** | `admin@company.com` | `admin123` | HR Admin |

---

## 🔍 Phase 10: Helpful Commands & Viewing Data

### 1. View live data in RDS directly from EC2 terminal:
```bash
psql -h <YOUR_RDS_ENDPOINT> -U postgres -d Leave_management
```
Useful SQL queries inside `psql`:
```sql
\dt                                      -- List all tables
SELECT * FROM users;                     -- View users
SELECT * FROM leave_balances;            -- View leave quotas
SELECT * FROM leave_requests;            -- View applications
\q                                       -- Exit
```

### 2. Check service status and logs:
```bash
pm2 status                               -- Check background apps
pm2 logs leave-frontend --lines 30       -- Check frontend logs
pm2 logs leave-backend --lines 30        -- Check backend logs
sudo tail -n 30 /var/log/nginx/error.log -- Check Nginx error logs
```
