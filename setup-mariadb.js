const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  console.log('🔧 Samha CRM - MariaDB Setup\n');

  // Step 1: Connect to MariaDB
  console.log('1️⃣  Connecting to MariaDB...');
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'mysql',
    });
    console.log('   ✓ Connected to MariaDB\n');
  } catch (err) {
    console.error('   ❌ Cannot connect to MariaDB');
    console.error('   Error:', err.message);
    console.error('\n   Make sure:');
    console.error('   1. Laragon is open');
    console.error('   2. MariaDB is running (green status in Laragon)');
    console.error('   3. Port 3306 is correct\n');
    process.exit(1);
  }

  // Step 2: Create database
  console.log('2️⃣  Creating database "samha_crm"...');
  try {
    await connection.query('CREATE DATABASE IF NOT EXISTS samha_crm;');
    console.log('   ✓ Database "samha_crm" created/verified\n');
  } catch (err) {
    console.error('   ❌ Error:', err.message);
    await connection.end();
    process.exit(1);
  }

  // Step 3: Test connection to new database
  console.log('3️⃣  Verifying connection to samha_crm...');
  try {
    await connection.query('USE samha_crm;');
    await connection.query('SELECT 1;');
    console.log('   ✓ Connection verified\n');
  } catch (err) {
    console.error('   ❌ Error:', err.message);
    await connection.end();
    process.exit(1);
  }

  await connection.end();

  // Step 4: Create .env file
  console.log('4️⃣  Creating .env file...');
  const envPath = path.join(__dirname, 'apps', 'api', '.env');
  const envContent = `DATABASE_URL="mysql://root:@localhost:3306/samha_crm"
NODE_ENV="development"
PORT=3000
`;

  fs.writeFileSync(envPath, envContent);
  console.log('   ✓ .env file created\n');

  console.log('✅ MariaDB setup complete!\n');
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
