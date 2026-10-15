const { pool } = require('../config/db');

class SharedStatement {
  static async create(tokenHash, snapshot, expiresAt) {
    const result = await pool.query(
      `INSERT INTO shared_statements (token_hash, snapshot, expires_at)
       VALUES ($1, $2, $3)
       RETURNING expires_at;`,
      [tokenHash, JSON.stringify(snapshot), expiresAt]
    );
    return result.rows[0];
  }

  static async findActive(tokenHash) {
    const result = await pool.query(
      `SELECT snapshot, expires_at
       FROM shared_statements
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
       LIMIT 1;`,
      [tokenHash]
    );
    return result.rows[0] || null;
  }

  static async revoke(tokenHash) {
    const result = await pool.query(
      `UPDATE shared_statements
       SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL
       RETURNING id;`,
      [tokenHash]
    );
    return result.rowCount > 0;
  }
}

module.exports = SharedStatement;
