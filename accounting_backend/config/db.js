require('dotenv').config();
const { Pool } = require('pg');

const databasePassword = process.env.DB_PASSWORD || process.env.PGPASSWORD;
if (!databasePassword) {
  throw new Error('Set DB_PASSWORD (or PGPASSWORD) before starting the accounting backend.');
}

const pool = new Pool({
  host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10),
  database: process.env.DB_NAME || process.env.PGDATABASE || 'finease_accounting',
  user: process.env.DB_USER || process.env.PGUSER || 'postgres',
  password: databasePassword,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error on idle client:', err);
});

// Seed data in Indian Rupees (₹)
const defaultSeedExpenses = [
  {
    id: "TX-1001",
    payee: "Nature's Basket Supermarket",
    amount: 2450.00,
    category: "Groceries",
    date: "2026-09-28",
    paymentMethod: "UPI / GPay",
    source: "OCR Receipt",
    notes: "Weekly organic vegetables, fruits, and dairy essentials",
    invoiceNo: "NB-INV-8419",
    tax: 120.00,
    items: ["Organic Vegetables (₹650)", "Almond Milk 2L (₹420)", "Greek Yogurt & Paneer (₹580)", "Fresh Fruits Basket (₹800)"],
    receiptName: "grocery_bill_sept28.jpg",
    confidence: 0.98,
    verified: true
  },
  {
    id: "TX-1002",
    payee: "Starbucks Coffee",
    amount: 480.00,
    category: "Dining",
    date: "2026-09-29",
    paymentMethod: "Credit Card",
    source: "Chatbot",
    notes: "2x Cappuccino and Almond Croissant with team",
    invoiceNo: "SBX-9941",
    tax: 24.00,
    items: ["Cappuccino Grande (₹280)", "Almond Croissant (₹200)"],
    receiptName: null,
    confidence: 0.95,
    verified: true
  },
  {
    id: "TX-1003",
    payee: "Amazon AWS Cloud Services",
    amount: 5200.00,
    category: "Software & SaaS",
    date: "2026-09-25",
    paymentMethod: "Corporate Card",
    source: "OCR Receipt",
    notes: "Monthly production cloud servers and database hosting",
    invoiceNo: "AWS-2026-4412",
    tax: 790.00,
    items: ["Amazon Elastic Compute Cloud (EC2)", "Amazon RDS Postgres Managed Instance", "CloudFront CDN"],
    receiptName: "aws_cloud_invoice.pdf",
    confidence: 0.99,
    verified: true
  },
  {
    id: "TX-1004",
    payee: "Stationery Depot",
    amount: 1150.00,
    category: "Office Supplies",
    date: "2026-09-24",
    paymentMethod: "Debit Card",
    source: "OCR Receipt",
    notes: "Printer paper boxes, markers, and file folders",
    invoiceNo: "SD-8921",
    tax: 60.00,
    items: ["A4 Executive Copier Paper (4 reams)", "Permanent Whiteboard Markers Pack", "Document Folders Set"],
    receiptName: "office_invoice.xml",
    confidence: 0.96,
    verified: true
  },
  {
    id: "TX-1005",
    payee: "Uber Technologies",
    amount: 450.00,
    category: "Travel & Commute",
    date: "2026-09-27",
    paymentMethod: "UPI",
    source: "Chatbot",
    notes: "Airport commute ride to terminal 2",
    invoiceNo: "UBER-7114",
    tax: 22.50,
    items: ["Uber Go Airport Ride - City Center to T2"],
    receiptName: null,
    confidence: 0.98,
    verified: true
  },
  {
    id: "TX-1006",
    payee: "Electricity Board (Adani / BESCOM)",
    amount: 3250.00,
    category: "Utilities",
    date: "2026-09-20",
    paymentMethod: "Net Banking",
    source: "Chatbot",
    notes: "September electricity and office utility bill",
    invoiceNo: "EB-SEP-2026",
    tax: 0.00,
    items: ["Commercial Tariff Electricity Consumption - 450 Units"],
    receiptName: null,
    confidence: 0.99,
    verified: true
  },
  {
    id: "TX-1007",
    payee: "Apollo Pharmacy",
    amount: 680.00,
    category: "Healthcare",
    date: "2026-09-22",
    paymentMethod: "UPI",
    source: "OCR Receipt",
    notes: "First aid supplies, multivitamins, and hand sanitizer",
    invoiceNo: "AP-5521",
    tax: 42.00,
    items: ["Multivitamin Capsules Bottle", "First Aid Adhesive Bandages Box", "Hand Sanitizer 500ml"],
    receiptName: "apollo_receipt.png",
    confidence: 0.98,
    verified: true
  },
  {
    id: "TX-1008",
    payee: "Slack Technologies",
    amount: 1250.00,
    category: "Software & SaaS",
    date: "2026-09-18",
    paymentMethod: "Corporate Card",
    source: "Chatbot",
    notes: "Monthly team collaboration Pro plan",
    invoiceNo: "SLK-8812",
    tax: 190.00,
    items: ["Slack Pro Plan - Monthly Active Seats"],
    receiptName: null,
    confidence: 0.97,
    verified: true
  }
];

const defaultCategories = [
  { name: "Groceries", icon: "🛒", description: "Food, supermarkets, daily essentials", budget_limit: 15000.00 },
  { name: "Dining", icon: "🍔", description: "Restaurants, cafes, food delivery", budget_limit: 8000.00 },
  { name: "Travel & Commute", icon: "🚕", description: "Cabs, flights, metro, fuel", budget_limit: 10000.00 },
  { name: "Utilities", icon: "⚡", description: "Electricity, water, gas, broadband", budget_limit: 6000.00 },
  { name: "Office Supplies", icon: "💼", description: "Stationery, paper, equipment", budget_limit: 5000.00 },
  { name: "Software & SaaS", icon: "☁️", description: "Cloud hosting, subscriptions, tools", budget_limit: 12000.00 },
  { name: "Healthcare", icon: "💊", description: "Pharmacy, doctor visits, wellness", budget_limit: 5000.00 },
  { name: "Miscellaneous", icon: "🛍️", description: "General or uncategorized items", budget_limit: 5000.00 }
];

// Initialize database schema and tables
async function initDb() {
  const client = await pool.connect();
  try {
    console.log('Connecting to PostgreSQL database:', process.env.DB_NAME || 'finease_accounting');

    // 1. Create Categories Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        icon VARCHAR(50),
        description TEXT,
        budget_limit NUMERIC(12, 2) DEFAULT 10000.00,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create Expenses Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR(50) PRIMARY KEY,
        payee VARCHAR(255) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        category VARCHAR(100) NOT NULL,
        date DATE NOT NULL,
        payment_method VARCHAR(100) DEFAULT 'UPI / Card',
        source VARCHAR(50) DEFAULT 'Chatbot',
        notes TEXT,
        invoice_no VARCHAR(100),
        tax NUMERIC(12, 2) DEFAULT 0.00,
        items JSONB DEFAULT '[]'::jsonb,
        receipt_name VARCHAR(255),
        preview_url TEXT,
        confidence NUMERIC(4, 2) DEFAULT 0.98,
        verified BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Indexes for efficient querying
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
      CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
      CREATE INDEX IF NOT EXISTS idx_expenses_source ON expenses(source);
    `);

    // 3. Create Invoices Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(50),
        file_size INTEGER,
        extracted_data JSONB,
        status VARCHAR(50) DEFAULT 'parsed',
        expense_id VARCHAR(50) REFERENCES expenses(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS shared_statements (
        id BIGSERIAL PRIMARY KEY,
        token_hash CHAR(64) UNIQUE NOT NULL,
        snapshot JSONB NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_shared_statements_expiry
        ON shared_statements(expires_at);
    `);

    // Seed Categories if table is empty
    const catCountRes = await client.query('SELECT COUNT(*) FROM categories');
    if (parseInt(catCountRes.rows[0].count, 10) === 0) {
      console.log('Seeding initial categories in PostgreSQL...');
      for (const cat of defaultCategories) {
        await client.query(
          `INSERT INTO categories (name, icon, description, budget_limit)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (name) DO NOTHING`,
          [cat.name, cat.icon, cat.description, cat.budget_limit]
        );
      }
    }

    // Seed Expenses if table is empty
    const expCountRes = await client.query('SELECT COUNT(*) FROM expenses');
    if (parseInt(expCountRes.rows[0].count, 10) === 0) {
      console.log('Seeding initial expenses in PostgreSQL...');
      for (const exp of defaultSeedExpenses) {
        await client.query(
          `INSERT INTO expenses (
            id, payee, amount, category, date, payment_method, source,
            notes, invoice_no, tax, items, receipt_name, confidence, verified
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (id) DO NOTHING`,
          [
            exp.id,
            exp.payee,
            exp.amount,
            exp.category,
            exp.date,
            exp.paymentMethod,
            exp.source,
            exp.notes,
            exp.invoiceNo,
            exp.tax,
            JSON.stringify(exp.items || []),
            exp.receiptName,
            exp.confidence,
            exp.verified
          ]
        );
      }
    }

    console.log('PostgreSQL schema initialized and ready.');
    return true;
  } catch (err) {
    console.error('Error during PostgreSQL initialization:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDb,
  defaultSeedExpenses
};
