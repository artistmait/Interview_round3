const { pool, initDb } = require('../config/db');
const Expense = require('./Expense');
const Category = require('./Category');
const InvoiceDocument = require('./InvoiceDocument');
const SharedStatement = require('./SharedStatement');

module.exports = {
  pool,
  initDb,
  Expense,
  Category,
  InvoiceDocument,
  SharedStatement
};
