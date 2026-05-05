# Production Deployment Checklist

## Pre-Deployment (Development)

### Environment Configuration
- [ ] Create `.env.production` file with production credentials
- [ ] Verify all required environment variables are set
- [ ] Test with production database credentials locally
- [ ] Validate S3 bucket and credentials

### Code Quality
- [ ] Run TypeScript compiler check: `npm run build`
- [ ] Test all API endpoints with Postman/curl
- [ ] Test frontend with dev tools (network, console errors)
- [ ] Verify error messages are user-friendly, not exposing internals
- [ ] Check for console.log statements (remove debug logs)

### Security
- [ ] Verify CORS allowed origins don't include wildcards
- [ ] Ensure sensitive data (passwords, keys) aren't logged
- [ ] Check SQL injection / NoSQL injection protections
- [ ] Verify file upload validates MIME types + sizes
- [ ] Test authentication on protected routes
- [ ] Ensure rate limiting is configured for public endpoints

### Database
- [ ] Run all migrations: `npx prisma db push`
- [ ] Verify seed data loads correctly: `npx prisma db seed`
- [ ] Test backup/restore procedures
- [ ] Check database user has minimal required permissions

### Document Management (Phase 4)
- [ ] S3 bucket created with proper permissions
- [ ] Bucket versioning enabled for accidental deletes
- [ ] Lifecycle policies set (delete old versions after 90 days)
- [ ] Presigned URL expiry set to 1 hour
- [ ] Test file upload/download with different file types
- [ ] Verify virus scanning configured (optional but recommended)

---

## cPanel Deployment Steps

### 1. DNS & Domain Setup
```
1. Point domain to cPanel server's IP
2. Set up nameservers
3. Wait for DNS propagation (24-48 hours)
4. Test DNS: nslookup yourdomain.com
```

### 2. cPanel Account Setup
```
1. Create cPanel account
2. Set up primary domain
3. Create subdomains if needed:
   - api.yourdomain.com (for backend)
   - app.yourdomain.com (for frontend)
```

### 3. Node.js Setup in cPanel
```
1. Go to Software > Node.js Selector
2. Create Node.js application for backend:
   - Document Root: /home/username/public_html/api
   - Application JS File: index.js
   - Node Version: 18.x (or latest LTS)
   - Application Mode: Production
```

### 4. Database Setup
```
1. Go to MySQL Databases
2. Create database: samha_crm_prod
3. Create user: samha_prod_user
4. Grant all privileges to user on database
5. Save credentials
```

### 5. Upload Code
```
Via Git (Preferred):
1. SSH into cPanel account
2. cd ~/public_html/api
3. git clone <repo-url> .
4. npm install --production
5. npm run build

Via FTP (Alternative):
1. Upload dist/ and node_modules/ via FTP
2. Exclude: .git, src/, node_modules (too large)
3. Run npm install after upload
```

### 6. Environment Configuration
```bash
# SSH into cPanel
cd ~/public_html/api

# Create production .env
cat > .env << 'EOF'
DATABASE_URL="mysql://samha_prod_user:PASSWORD@localhost:3306/samha_crm_prod"
NODE_ENV="production"
PORT=3000
CLERK_PUBLISHABLE_KEY="your-clerk-key"
CLERK_SECRET_KEY="your-clerk-secret"

# AWS S3
AWS_S3_BUCKET="your-prod-bucket"
AWS_S3_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
MAX_UPLOAD_SIZE=52428800

# CORS (set to your production domain)
ALLOWED_ORIGINS="https://app.yourdomain.com"
EOF
```

### 7. Run Database Migrations
```bash
npx prisma db push --skip-generate
npx prisma db seed
```

### 8. Configure Proxy
Create `.htaccess` in `/public_html/api`:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteRule ^(.*)$ http://localhost:3000/$1 [P,L]
</IfModule>
```

### 9. SSL Certificate
```
1. Go to SSL/TLS > Manage SSL Sites
2. AutoSSL should generate free cert automatically
3. Verify HTTPS works: https://yourdomain.com
```

### 10. Start Application
```
Via cPanel:
1. Go to Node.js Selector
2. Click "Start"
3. Monitor logs: tail -f /home/username/logs/nodejs-error.log

Via SSH:
npm start  # Runs dist/index.js in production mode
```

### 11. Frontend Setup
```bash
cd ~/public_html/app

# Build React app
npm install --production
npm run build

# Copy dist to public_html
cp -r dist/* ~/public_html/public/

# Configure .htaccess for SPA routing
cat > ~/public_html/public/.htaccess << 'EOF'
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

### 12. Update API Endpoint in Frontend
Edit `apps/web/src/main.tsx` or axios config:
```tsx
// For production, axios should call /api relative to same domain
// or use: VITE_API_URL=https://api.yourdomain.com in .env
```

### 13. Health Checks
```bash
# Test API health
curl https://yourdomain.com/health

# Test frontend loads
curl https://app.yourdomain.com

# Check error logs
tail -f /home/username/logs/nodejs-error.log
tail -f /home/username/logs/nodejs-access.log
```

---

## Post-Deployment Monitoring

### Critical Checks
- [ ] Database connection works
- [ ] S3 upload/download works
- [ ] Authentication works (Clerk)
- [ ] API responds in < 500ms
- [ ] No 5xx errors in logs
- [ ] Disk space adequate (>5GB free)
- [ ] Memory usage stable (< 80%)

### Ongoing Monitoring
```bash
# Monitor error logs daily
tail -f /home/username/logs/nodejs-error.log | grep -i error

# Monitor disk usage
df -h /home/username

# Monitor process
ps aux | grep node
```

### Backups
- [ ] Enable daily database backups via cPanel
- [ ] Test backup restore procedure monthly
- [ ] Keep 30 days of backups
- [ ] Store backup in separate location (S3/offsite)

---

## Rollback Plan

If production breaks:

```bash
# 1. Check error logs
tail -f /home/username/logs/nodejs-error.log

# 2. Revert code to last stable commit
git revert <bad-commit>
git push

# 3. Restart application
pm2 restart samha-api

# 4. Check database is accessible
npx prisma db execute --stdin < test-query.sql

# 5. Monitor logs for 5 minutes
```

---

## Security Hardening

### Before Going Live
- [ ] Remove console.log debug statements
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS only (no HTTP)
- [ ] Set secure CORS origins (not wildcard)
- [ ] Disable /api-docs in production
- [ ] Set rate limiting on login/signup
- [ ] Validate all inputs (Zod schemas)
- [ ] Add request logging for audit trail
- [ ] Configure WAF (Web Application Firewall) if available
- [ ] Set up SSL/TLS with strong ciphers

### Production Environment Variables
```env
# Never commit these to git
NODE_ENV=production
DEBUG=false
LOG_LEVEL=warn
CORS_ORIGIN=https://app.yourdomain.com

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Timeouts
DB_POOL_MAX=10
DB_POOL_TIMEOUT_MS=30000
```

---

## Performance Optimization

### API Optimization
- [ ] Enable gzip compression
- [ ] Add caching headers (ETag, Cache-Control)
- [ ] Index frequently queried database columns
- [ ] Configure connection pooling (10-20 connections)
- [ ] Monitor slow queries (log queries > 1s)

### Frontend Optimization
- [ ] Minify and gzip assets
- [ ] Configure CDN for static files
- [ ] Enable browser caching
- [ ] Lazy load components
- [ ] Monitor Core Web Vitals

---

## Support & Escalation

### Common Issues

**502 Bad Gateway**
```
Check: Is Node.js process running?
ps aux | grep node

Restart: pm2 restart samha-api
```

**Database Connection Failed**
```
Check: Is MySQL running?
Check: .env DATABASE_URL correct?
Check: User permissions?
```

**S3 Upload Fails**
```
Check: AWS credentials in .env
Check: S3 bucket exists
Check: Bucket policy allows PutObject
```

---

## Maintenance Schedule

- **Daily**: Check error logs, disk space, memory
- **Weekly**: Review performance metrics, backup status
- **Monthly**: Test backup restore, review security logs
- **Quarterly**: Update dependencies, review and optimize slow queries
- **Annually**: Security audit, disaster recovery drill
