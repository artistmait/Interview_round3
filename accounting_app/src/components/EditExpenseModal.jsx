import React, { useState } from 'react';
import { CloseIcon, CheckCircleIcon, TrashIcon } from './Icons';

const CATEGORIES = [
  "Groceries",
  "Dining",
  "Travel & Commute",
  "Utilities",
  "Office Supplies",
  "Software & SaaS",
  "Healthcare",
  "Miscellaneous"
];

const PAYMENT_METHODS = [
  "UPI / GPay / PhonePe",
  "Credit Card",
  "Debit Card",
  "Corporate Card",
  "Net Banking",
  "Cash"
];

export default function EditExpenseModal({
  expense,
  currency = '₹',
  onClose,
  onSave,
  onDelete
}) {
  const [formData, setFormData] = useState({
    payee: expense.payee || '',
    amount: expense.amount || 0,
    category: expense.category || 'Miscellaneous',
    date: expense.date || '',
    paymentMethod: expense.paymentMethod || 'UPI / Card',
    notes: expense.notes || ''
  });

  const [error, setError] = useState('');

  const handleChange = (field, val) => {
    setFormData((prev) => ({
      ...prev,
      [field]: field === 'amount' ? (val === '' ? '' : parseFloat(val) || 0) : val
    }));
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.payee.trim()) {
      setError('Please provide a payee/vendor name');
      return;
    }
    if (formData.amount === '' || isNaN(formData.amount) || formData.amount < 0) {
      setError('Please provide a valid expense amount in Rupees');
      return;
    }

    onSave(expense.id, {
      ...formData,
      amount: parseFloat(formData.amount)
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3>Edit Expense Entry</h3>
            <span className="modal-record-id">{expense.id}</span>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose}>
            <CloseIcon size={18} />
          </button>
        </div>

        {error && <div className="modal-error-alert">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Payee / Vendor Name</label>
            <input
              type="text"
              className="form-input"
              value={formData.payee}
              onChange={(e) => handleChange('payee', e.target.value)}
              placeholder="e.g. Starbucks, DMart, IndiGo"
              required
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Amount ({currency} INR)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Category</label>
              <select
                className="form-input"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Transaction Date</label>
              <input
                type="date"
                className="form-input"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Payment Method</label>
              <select
                className="form-input"
                value={formData.paymentMethod}
                onChange={(e) => handleChange('paymentMethod', e.target.value)}
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Notes / Description</label>
            <textarea
              className="form-input form-textarea"
              rows={2}
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Add optional notes..."
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-modal-delete"
              onClick={() => {
                if (window.confirm(`Delete record ${expense.id} (${expense.payee})?`)) {
                  onDelete(expense.id);
                }
              }}
            >
              <TrashIcon size={14} />
              <span>Delete</span>
            </button>

            <div className="modal-right-buttons">
              <button type="button" className="btn-modal-cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-modal-save">
                <CheckCircleIcon size={15} />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
