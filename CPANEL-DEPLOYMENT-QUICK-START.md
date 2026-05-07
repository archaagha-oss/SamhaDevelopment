# cPanel Deployment - Quick Start Guide

**Time Required:** 30-45 minutes  
**Prerequisites:** cPanel account, domain name, Node.js 18.x enabled

---

## 1️⃣ Prepare Local Code (5 minutes)

```bash
# Verify build works locally
cd C:\laragon\www\SamhaDevelopment\apps\api
npm run build
npx tsc --noEmit

cd C:\laragon\www\SamhaDevelopment\apps\web
npm run build
npx tsc --noEmit
```

If no errors, code is ready for deployment.

---

## 2️⃣ SSH into cPanel (2 minutes)

```bash
# Mac/Linux
ssh username@yourdomain.com

# Windows: Use PuTTY or Windows Terminal with SSH
ssh username@yourdomain.com
# Enter password when prompted
```

Navigate to home:
```bash
cd ~
pwd  # Should show /home/username
```

---

## 3️⃣ Create Directory Structure (3 minutes)

```bash
# Create directories
mkdir -p public_html/api
mkdir -p public_html/web
mkdir -p logs

# Clone or upload code
cd public_html/api
git clone https://github.com/yourusername/samha-crm.git .
# Or upload via FTP if git not available
```

---

## 4️⃣ Create MySQL Database (5 minutes)

Via cPanel Web Interface:
1. Go to **cPanel > MySQL Databases**
2. Create database: `samha_crm_prod`
3. Create user: `samha_user`
4. Set password: (use strong random password)
5. Grant ALL privileges
6. Click "Make Changes"

Record credentials:
```
Database: samha_crm_prod
User: samha_user
Password: (saved password)
Host: localhost
```

---

## 5️⃣ Configure Environment (5 minutes)

SSH into cPanel:

```bash
cd ~/public_html/api

# Create .env file with production settings
cat > .env << 'EOF'
DATABASE_URL="mysql://samha_user:YOUR_PASSWORD@localhost:3306/samha_crm_prod"
NODE_ENV="production"
PORT=3000
JWT_SECRET="GENERATED_WITH_OPENSSL_RAND_BASE64_64"
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL_DAYS=30
PASSWORD_RESET_URL_BASE="https://app.yourdomain.com/reset-password"
AWS_S3_BUCKET="samha-prod-bucket"
AWS_S3_REGION="us-east-1"
AWS_ACCESS_KEY_ID="YOUR_AWS_KEY"
AWS_SECRET_ACCESS_KEY="YOUR_AWS_SECRET"
MAX_UPLOAD_SIZE=52428800
ALLOWED_ORIGINS="https://app.yourdomain.com"
EOF

# Secure permissions
chmod 600 .env
```

Replace placeholders with your actual values.

---

## 6️⃣ Install Dependencies & Build (10 minutes)

```bash
cd ~/public_html/api

# Install production dependencies only
npm install --production

# Run database migrations
npx prisma db push --skip-generate

# Seed initial data (optional)
npx prisma db seed
```

Expected output:
```
✅ Database synced
✅ Seeded data (if running seed)
```

---

## 7️⃣ Start Node.js Application (2 minutes)

### Option A: Via cPanel Node.js Selector

1. Go to **cPanel > Software > Node.js Selector**
2. Click **Create Application**
3. Set:
   - **Document Root**: `/home/username/public_html/api`
   - **Application JS File**: `dist/index.js`
   - **Node Version**: `18.x`
   - **Application Mode**: `Production`
4. Click **Create**
5. Click **Start Application**

### Option B: Via SSH (if cPanel selector not available)

```bash
cd ~/public_html/api

# Start in background with logs
nohup npm start > ~/logs/app.log 2>&1 &

# Verify running
ps aux | grep node
```

---

## 8️⃣ Deploy Frontend (5 minutes)

```bash
cd ~/public_html/web

# Install and build
npm install --production
npm run build

# Copy built files to public
cp -r dist/* ../

# Create .htaccess for SPA routing
cat > ../.htaccess << 'EOF'
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
EOF
```

---

## 9️⃣ Set Up Reverse Proxy (3 minutes)

Create `.htaccess` in `/public_html/api`:

```bash
cat > ~/public_html/api/.htaccess << 'EOF'
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ http://localhost:3000/$1 [P,L]
</IfModule>
EOF
```

This forwards requests from `api.yourdomain.com/*` to `localhost:3000/*`

---

## 🔟 Verify Deployment (5 minutes)

```bash
# From cPanel SSH
# Check API is responding
curl http://localhost:3000/health

# Check database connection
curl http://localhost:3000/api/projects
```

Expected responses:
- `/health` → `{"status":"ok","timestamp":"..."}`
- `/api/projects` → JSON array of projects (or empty array if fresh)

---

## 🔒 Enable SSL (1 minute)

1. Go to **cPanel > SSL/TLS**
2. Click **Manage SSL Sites**
3. Select your domain
4. AutoSSL should auto-generate certificate
5. Verify HTTPS works: `https://yourdomain.com`

---

## 📊 Monitor & Troubleshoot

### Check if App is Running
```bash
ps aux | grep node
```

Should show Node.js process running.

### View Error Logs
```bash
# Via cPanel Node.js Selector: View Logs button
# Or via SSH:
tail -f ~/logs/nodejs-error.log
tail -f ~/logs/nodejs-access.log
```

### Restart Application
```bash
# Via cPanel Node.js Selector: Click Restart
# Or via SSH:
pkill -f "node.*dist/index.js"
npm start &
```

### Check Disk Space
```bash
df -h ~
```

Should have > 2GB free.

### Monitor Memory
```bash
free -h
top -b -n 1 | head -10
```

Node.js typically uses 100-300MB.

---

## ✅ Deployment Complete!

Your Samha CRM is now live:
- **API**: `https://api.yourdomain.com` or `https://yourdomain.com/api`
- **Frontend**: `https://app.yourdomain.com` or `https://yourdomain.com`
- **Documents**: Uploaded to S3 bucket `samha-prod-bucket`

---

## 🔧 Common Issues & Fixes

### 502 Bad Gateway
```
Cause: Node.js not running or port 3000 unreachable
Fix: Restart app via cPanel or SSH
ps aux | grep node
npm start &
```

### Database Connection Failed
```
Cause: Wrong credentials or database not created
Fix: 
1. Verify credentials in .env match cPanel MySQL
2. Test connection: mysql -h localhost -u samha_user -p samha_crm_prod
3. Run migrations: npx prisma db push
```

### File Upload Fails
```
Cause: S3 credentials invalid or bucket doesn't exist
Fix:
1. Verify AWS_S3_BUCKET in .env is correct
2. Test S3 credentials: aws s3 ls --profile default
3. Check bucket policy allows PutObject
```

### High Memory Usage
```
Cause: Connection pool too large or memory leak
Fix:
1. Reduce DB_POOL_MAX from 20 to 10
2. Restart application
3. Monitor with: watch -n 1 'ps aux | grep node'
```

---

## 📞 Need Help?

1. Check **PRODUCTION-DEPLOYMENT.md** for detailed troubleshooting
2. Check **PRODUCTION-READINESS.md** for verification steps
3. Review error logs: `tail -f ~/logs/nodejs-error.log`
4. Contact hosting support for cPanel/MySQL issues
5. Contact AWS support for S3 issues

---

## 🎉 Next Steps

After deployment:
- [ ] Test all features in production
- [ ] Set up daily database backups
- [ ] Configure monitoring/alerts
- [ ] Document any custom changes
- [ ] Share production URL with users
- [ ] Monitor error logs daily for first week

Deployment successful! 🚀
