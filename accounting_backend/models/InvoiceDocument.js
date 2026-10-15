const { pool } = require('../config/db');

class InvoiceDocument {
  static async create({ fileName, fileType, fileSize = 0, extractedData = {}, status = 'parsed', expenseId = null }) {
    const query = `
      INSERT INTO invoices (file_name, file_type, file_size, extracted_data, status, expense_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const res = await pool.query(query, [
      fileName,
      fileType,
      fileSize,
      JSON.stringify(extractedData),
      status,
      expenseId
    ]);
    return res.rows[0];
  }

  static async findAll() {
    const res = await pool.query(`
      SELECT i.*, e.payee, e.amount, e.date
      FROM invoices i
      LEFT JOIN expenses e ON e.id = i.expense_id
      ORDER BY i.created_at DESC;
    `);
    return res.rows;
  }

  static async findById(id) {
    const res = await pool.query('SELECT * FROM invoices WHERE id = $1 LIMIT 1;', [id]);
    return res.rows[0] || null;
  }

  static async linkToExpense(invoiceId, expenseId) {
    const query = `
      UPDATE invoices
      SET expense_id = $1, status = 'verified'
      WHERE id = $2
      RETURNING *;
    `;
    const res = await pool.query(query, [expenseId, invoiceId]);
    return res.rows[0] || null;
  }
}

module.exports = InvoiceDocument;
