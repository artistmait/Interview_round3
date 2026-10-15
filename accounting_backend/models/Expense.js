const { pool } = require('../config/db');

// Helper to format database row to frontend camelCase object
function formatExpenseRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    payee: row.payee,
    amount: parseFloat(row.amount) || 0,
    category: row.category,
    date: row.date ? (row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date)) : null,
    paymentMethod: row.payment_method || 'UPI / Card',
    source: row.source || 'Chatbot',
    notes: row.notes || '',
    invoiceNo: row.invoice_no || null,
    tax: row.tax !== null ? parseFloat(row.tax) : 0,
    items: Array.isArray(row.items) ? row.items : (typeof row.items === 'string' ? JSON.parse(row.items || '[]') : (row.items || [])),
    receiptName: row.receipt_name || null,
    previewUrl: row.preview_url || null,
    confidence: row.confidence !== null ? parseFloat(row.confidence) : null,
    verified: Boolean(row.verified),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

class Expense {
  // Find all expenses with flexible filtering, search, and sorting
  static async findAll(filters = {}) {
    const { category, search, startDate, endDate, source, sortBy = 'date', sortOrder = 'DESC', limit, offset } = filters;
    const conditions = [];
    const values = [];
    let idx = 1;

    if (category && category !== 'All') {
      conditions.push(`LOWER(category) = LOWER($${idx++})`);
      values.push(category);
    }

    if (source && source !== 'All') {
      conditions.push(`LOWER(source) = LOWER($${idx++})`);
      values.push(source);
    }

    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push(`(
        LOWER(payee) LIKE $${idx} OR 
        LOWER(id) LIKE $${idx} OR 
        LOWER(COALESCE(notes, '')) LIKE $${idx} OR 
        LOWER(COALESCE(invoice_no, '')) LIKE $${idx} OR 
        LOWER(category) LIKE $${idx}
      )`);
      values.push(q);
      idx++;
    }

    if (startDate) {
      conditions.push(`date >= $${idx++}`);
      values.push(startDate);
    }

    if (endDate) {
      conditions.push(`date <= $${idx++}`);
      values.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Allowed sort columns
    const allowedSortColumns = {
      date: 'date',
      amount: 'amount',
      payee: 'payee',
      category: 'category',
      created_at: 'created_at',
      id: 'id'
    };
    const sortCol = allowedSortColumns[sortBy.toLowerCase()] || 'date';
    const sortDir = (sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let paginationClause = '';
    if (limit && parseInt(limit, 10) > 0) {
      paginationClause += ` LIMIT $${idx++}`;
      values.push(parseInt(limit, 10));
    }
    if (offset && parseInt(offset, 10) > 0) {
      paginationClause += ` OFFSET $${idx++}`;
      values.push(parseInt(offset, 10));
    }

    const query = `
      SELECT * FROM expenses
      ${whereClause}
      ORDER BY ${sortCol} ${sortDir}, id DESC
      ${paginationClause};
    `;

    const res = await pool.query(query, values);
    return res.rows.map(formatExpenseRow);
  }

  // Find single expense by ID
  static async findById(id) {
    const query = 'SELECT * FROM expenses WHERE id = $1 LIMIT 1;';
    const res = await pool.query(query, [id]);
    return formatExpenseRow(res.rows[0]);
  }

  // Generate unique ID like TX-1009
  static async generateId() {
    const res = await pool.query(`
      SELECT id FROM expenses 
      WHERE id LIKE 'TX-%' 
      ORDER BY id DESC 
      LIMIT 1;
    `);

    let nextNum = 1001;
    if (res.rows.length > 0 && res.rows[0].id) {
      const match = res.rows[0].id.match(/TX-(\d+)/);
      if (match && match[1]) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    return `TX-${nextNum}`;
  }

  // Create a new expense in PostgreSQL
  static async create(data) {
    const id = data.id || await this.generateId();
    const payee = String(data.payee || 'Merchant').trim();
    const amount = parseFloat(data.amount) || 0;
    const category = String(data.category || 'Miscellaneous').trim();
    const date = data.date || new Date().toISOString().split('T')[0];
    const paymentMethod = data.paymentMethod || data.payment_method || 'UPI / Card';
    const source = data.source || 'Chatbot';
    const notes = data.notes || '';
    const invoiceNo = data.invoiceNo || data.invoice_no || null;
    const tax = data.tax !== undefined && data.tax !== null ? parseFloat(data.tax) : 0.00;
    const items = JSON.stringify(data.items || []);
    const receiptName = data.receiptName || data.receipt_name || null;
    const previewUrl = data.previewUrl || data.preview_url || null;
    const confidence = data.confidence !== undefined && data.confidence !== null ? parseFloat(data.confidence) : null;
    const verified = data.verified !== undefined ? Boolean(data.verified) : true;

    const query = `
      INSERT INTO expenses (
        id, payee, amount, category, date, payment_method, source,
        notes, invoice_no, tax, items, receipt_name, preview_url, confidence, verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *;
    `;

    const values = [
      id,
      payee,
      amount,
      category,
      date,
      paymentMethod,
      source,
      notes,
      invoiceNo,
      tax,
      items,
      receiptName,
      previewUrl,
      confidence,
      verified
    ];

    const res = await pool.query(query, values);
    return formatExpenseRow(res.rows[0]);
  }

  // Update an existing expense by ID
  static async update(id, updates) {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const fieldMap = {
      payee: 'payee',
      amount: 'amount',
      category: 'category',
      date: 'date',
      paymentMethod: 'payment_method',
      payment_method: 'payment_method',
      source: 'source',
      notes: 'notes',
      invoiceNo: 'invoice_no',
      invoice_no: 'invoice_no',
      tax: 'tax',
      items: 'items',
      receiptName: 'receipt_name',
      receipt_name: 'receipt_name',
      previewUrl: 'preview_url',
      preview_url: 'preview_url',
      confidence: 'confidence',
      verified: 'verified'
    };

    const setClauses = [];
    const values = [];
    let idx = 1;

    for (const [key, val] of Object.entries(updates)) {
      const dbCol = fieldMap[key];
      if (dbCol && val !== undefined) {
        setClauses.push(`${dbCol} = $${idx++}`);
        if (dbCol === 'items') {
          values.push(JSON.stringify(val));
        } else if (dbCol === 'confidence' && val === null) {
          values.push(null);
        } else if (dbCol === 'amount' || dbCol === 'tax' || dbCol === 'confidence') {
          values.push(parseFloat(val) || 0);
        } else {
          values.push(val);
        }
      }
    }

    if (setClauses.length === 0) {
      return existing;
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE expenses
      SET ${setClauses.join(', ')}
      WHERE id = $${idx}
      RETURNING *;
    `;

    const res = await pool.query(query, values);
    return formatExpenseRow(res.rows[0]);
  }

  // Delete an expense by ID
  static async delete(id) {
    const query = 'DELETE FROM expenses WHERE id = $1 RETURNING *;';
    const res = await pool.query(query, [id]);
    return formatExpenseRow(res.rows[0]);
  }

  // Aggregate Statistics directly from PostgreSQL
  static async getStats() {
    const summaryQuery = `
      SELECT 
        COUNT(*)::int AS count,
        COALESCE(SUM(amount), 0)::numeric(12,2) AS total,
        COALESCE(AVG(amount), 0)::numeric(12,2) AS average,
        COALESCE(MIN(amount), 0)::numeric(12,2) AS min_amount,
        COALESCE(MAX(amount), 0)::numeric(12,2) AS max_amount
      FROM expenses;
    `;

    const catQuery = `
      SELECT category, COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::numeric(12,2) AS total
      FROM expenses
      GROUP BY category
      ORDER BY total DESC;
    `;

    const sourceQuery = `
      SELECT source, COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::numeric(12,2) AS total
      FROM expenses
      GROUP BY source
      ORDER BY count DESC;
    `;

    const [summaryRes, catRes, sourceRes] = await Promise.all([
      pool.query(summaryQuery),
      pool.query(catQuery),
      pool.query(sourceQuery)
    ]);

    return {
      summary: summaryRes.rows[0],
      categories: catRes.rows,
      sources: sourceRes.rows
    };
  }
}

module.exports = Expense;
