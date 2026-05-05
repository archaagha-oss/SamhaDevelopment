const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔧 Samha CRM Database Setup\n');

// Step 1: Check if PostgreSQL is accessible
console.log('1️⃣  Checking PostgreSQL in Laragon...');

const laragonPaths = [
  'C:\\laragon\\bin\\postgresql\\bin\\psql.exe',
  'C:\\laragon\\bin\\postgresql\\postgres\\bin\\psql.exe',
  'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe',
  'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
];

let psqlPath = null;
for (const p of laragonPaths) {
  if (fs.existsSync(p)) {
    psqlPath = p;
    console.log(`   ✓ Found PostgreSQL at: ${p}\n`);
    break;
  }
}

if (!psqlPath) {
  console.error('❌ PostgreSQL not found in Laragon!');
  console.error('Please make sure PostgreSQL is installed and running in Laragon.');
  console.error('\nManual steps:');
  console.error('1. Open Laragon');
  console.error('2. Start PostgreSQL service');
  console.error('3. Open pgAdmin and create database "samha_crm"');
  console.error('4. Run: npm run db:push');
  process.exit(1);
}

// Step 2: Create database
console.log('2️⃣  Creating database "samha_crm"...');
try {
  execSync(`"${psqlPath}" -U postgres -c "CREATE DATABASE samha_crm;"`, {
    stdio: 'pipe',
    windowsHide: true,
  });
  console.log('   ✓ Database created (or already exists)\n');
} catch (err) {
  if (err.toString().includes('already exists')) {
    console.log('   ✓ Database "samha_crm" already exists\n');
  } else {
    console.error('   ❌ Error creating database:');
    console.error(err.message);
    process.exit(1);
  }
}

// Step 3: Verify connection
console.log('3️⃣  Verifying connection...');
try {
  execSync(`"${psqlPath}" -U postgres -d samha_crm -c "SELECT 1;"`, {
    stdio: 'pipe',
    windowsHide: true,
  });
  console.log('   ✓ Connection successful\n');
} catch (err) {
  console.error('   ❌ Cannot connect to PostgreSQL');
  console.error('   Make sure PostgreSQL is running in Laragon');
  process.exit(1);
}

// Step 4: Create .env if missing
console.log('4️⃣  Creating .env file...');
const envPath = path.join(__dirname, 'apps', 'api', '.env');
const envContent = `DATABASE_URL="postgresql://postgres:@localhost:5432/samha_crm"
NODE_ENV="development"
PORT=3000
`;

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envContent);
  console.log('   ✓ .env file created\n');
} else {
  console.log('   ✓ .env file already exists\n');
}

console.log('✅ Database setup complete!\n');
console.log('📋 Next steps:');
console.log('   1. npm run db:push     (create tables)');
console.log('   2. npm run db:seed     (load sample data)');
console.log('   3. npm run dev         (start servers)\n');
console.log('🌐 Then open: http://localhost:5173\n');
