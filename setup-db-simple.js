const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  console.log('🔧 Samha CRM Database Setup\n');

  // Step 1: Connect to PostgreSQL (default postgres database)
  console.log('1️⃣  Connecting to PostgreSQL...');
  const adminClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '', // Laragon usually has empty password
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    console.log('   ✓ Connected to PostgreSQL\n');
  } catch (err) {
    console.error('   ❌ Cannot connect to PostgreSQL');
    console.error('   Error:', err.message);
    console.error('\n   Make sure:');
    console.error('   1. Laragon is open');
    console.error('   2. PostgreSQL is running (green status in Laragon)');
    console.error('   3. Port 5432 is correct\n');
    process.exit(1);
  }

  // Step 2: Create database
  console.log('2️⃣  Creating database "samha_crm"...');
  try {
    await adminClient.query('CREATE DATABASE samha_crm;');
    console.log('   ✓ Database "samha_crm" created\n');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('   ✓ Database "samha_crm" already exists\n');
    } else {
      console.error('   ❌ Error:', err.message);
      process.exit(1);
    }
  }

  await adminClient.end();

  // Step 3: Test connection to new database
  console.log('3️⃣  Verifying connection to samha_crm...');
  const appClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '',
    database: 'samha_crm',
  });

  try {
    await appClient.connect();
    await appClient.query('SELECT 1');
    await appClient.end();
    console.log('   ✓ Connection verified\n');
  } catch (err) {
    console.error('   ❌ Error:', err.message);
    process.exit(1);
  }

  // Step 4: Create .env file
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
}

setupDatabase().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
