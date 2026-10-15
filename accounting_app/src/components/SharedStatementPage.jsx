import { useEffect, useState } from 'react';
import { api } from '../services/api';
import '../App.css';

export default function SharedStatementPage({ token }) {
  const [statement, setStatement] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let isCurrent = true;
    api.getSharedStatement(token)
      .then((data) => { if (isCurrent) setStatement(data); })
      .catch((requestError) => { if (isCurrent) setError(requestError.message); });
    return () => { isCurrent = false; };
  }, [token]);

  const formatMoney = (amount) => `${statement.currency}${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

  return (
    <main className="shared-statement-page">
      {error ? (
        <section className="shared-statement-card shared-statement-message">
          <p className="shared-statement-brand">FinEase AI</p>
          <h1>Statement unavailable</h1>
          <p>{error}</p>
        </section>
      ) : !statement ? (
        <section className="shared-statement-card shared-statement-message">
          <p className="shared-statement-brand">FinEase AI</p>
          <h1>Loading statement…</h1>
        </section>
      ) : (
        <article className="shared-statement-card">
          <header className="shared-statement-public-header">
            <div>
              <p className="shared-statement-brand">FinEase AI</p>
              <h1>Expense statement</h1>
              <p>Period: {statement.period}</p>
            </div>
            <button type="button" className="share-statement-link-copy" onClick={() => window.print()}>
              Print / Save as PDF
            </button>
          </header>

          <section className="shared-statement-summary-total" aria-label="Statement total">
            <div>
              <span>Total expenses</span>
              <strong>{formatMoney(statement.total)}</strong>
            </div>
            <span>{statement.transactions.length} transactions</span>
          </section>

          <div className="shared-statement-table-wrap">
            <table className="shared-statement-table">
              <thead>
                <tr><th>Date</th><th>Payee</th><th>Category</th><th className="amount">Amount</th></tr>
              </thead>
              <tbody>
                {statement.transactions.map((transaction, index) => (
                  <tr key={`${transaction.date}-${transaction.payee}-${index}`}>
                    <td>{transaction.date || '—'}</td>
                    <td>{transaction.payee}</td>
                    <td>{transaction.category}</td>
                    <td className="amount">{formatMoney(transaction.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan="3">Total</td><td className="amount">{formatMoney(statement.total)}</td></tr>
              </tfoot>
            </table>
          </div>

          <footer className="shared-statement-public-footer">
            Snapshot created {new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(new Date(statement.createdAt))}.
            This read-only link expires {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(statement.expiresAt))}.
          </footer>
        </article>
      )}
    </main>
  );
}
