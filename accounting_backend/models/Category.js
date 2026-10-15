const { pool } = require('../config/db');

class Category {
  static async findAll() {
    const res = await pool.query(`
      SELECT 
        c.*, 
        COUNT(e.id)::int AS expense_count,
        COALESCE(SUM(e.amount), 0)::numeric(12,2) AS total_spent
      FROM categories c
      LEFT JOIN expenses e ON LOWER(e.category) = LOWER(c.name)
      GROUP BY c.id
      ORDER BY total_spent DESC, c.name ASC;
    `);
    return res.rows;
  }

  static async findByName(name) {
    const res = await pool.query('SELECT * FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1;', [name]);
    return res.rows[0] || null;
  }

  static async create({ name, icon = '📁', description = '', budgetLimit = 10000.00 }) {
    const query = `
      INSERT INTO categories (name, icon, description, budget_limit)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const res = await pool.query(query, [name, icon, description, budgetLimit]);
    return res.rows[0];
  }

  static async update(id, updates) {
    const setClauses = [];
    const values = [];
    let idx = 1;

    if (updates.name) {
      setClauses.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.icon) {
      setClauses.push(`icon = $${idx++}`);
      values.push(updates.icon);
    }
    if (updates.description) {
      setClauses.push(`description = $${idx++}`);
      values.push(updates.description);
    }
    if (updates.budgetLimit !== undefined) {
      setClauses.push(`budget_limit = $${idx++}`);
      values.push(parseFloat(updates.budgetLimit) || 0);
    }

    if (setClauses.length === 0) return null;

    values.push(id);
    const query = `
      UPDATE categories
      SET ${setClauses.join(', ')}
      WHERE id = $${idx}
      RETURNING *;
    `;
    const res = await pool.query(query, values);
    return res.rows[0] || null;
  }

  static async delete(id) {
    const res = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *;', [id]);
    return res.rows[0] || null;
  }
}

module.exports = Category;
