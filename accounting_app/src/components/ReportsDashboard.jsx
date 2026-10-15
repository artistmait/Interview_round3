import { useState, useMemo } from 'react';
import { 
  SearchIcon, 
  EditIcon, 
  TrashIcon, 
  DownloadIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  ReceiptIcon, 
  BotIcon, 
  CheckCircleIcon,
  ChartIcon,
  ShareIcon
} from './Icons';
import EditExpenseModal from './EditExpenseModal';
import FinancialStoryboard from './FinancialStoryboard';
import ShareStatementModal from './ShareStatementModal';
import ScanVerifyModal from './ScanVerifyModal';
import { api } from '../services/api';

const CATEGORIES = [
  "All",
  "Groceries",
  "Dining",
  "Travel & Commute",
  "Utilities",
  "Office Supplies",
  "Software & SaaS",
  "Healthcare",
  "Miscellaneous"
];

export default function ReportsDashboard({
  expenses = [],
  currency = '₹',
  onUpdateExpense,
  onDeleteExpense,
  onNavigateToChat,
  onAddExpense
}) {
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [timeRange, setTimeRange] = useState('All Time');
  const [sourceFilter, setSourceFilter] = useState('All');

  // Strict Pagination: 5 to 10 rows max per page
  const [pageSize, setPageSize] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

  // Edit & Share & Scan Modals State
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteConfirmExpense, setDeleteConfirmExpense] = useState(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches =
          item.payee.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          (item.notes && item.notes.toLowerCase().includes(q)) ||
          item.category.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }

      if (sourceFilter !== 'All') {
        if (sourceFilter === 'Chatbot' && item.source !== 'Chatbot') return false;
        if (sourceFilter === 'OCR Receipt' && item.source !== 'OCR Receipt') return false;
      }

      if (timeRange === 'This Month') {
        const itemDate = new Date(item.date);
        const now = new Date();
        if (itemDate.getMonth() !== now.getMonth() || itemDate.getFullYear() !== now.getFullYear()) {
          return false;
        }
      } else if (timeRange === 'This Week') {
        const itemDate = new Date(item.date);
        const now = new Date();
        const diffDays = (now - itemDate) / (1000 * 60 * 60 * 24);
        if (diffDays > 7 || diffDays < 0) return false;
      }

      return true;
    });
  }, [expenses, searchTerm, selectedCategory, timeRange, sourceFilter]);

  // Overall Statistics for Analytics (displayed below the table)
  const stats = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const count = filteredExpenses.length;
    const avg = count > 0 ? total / count : 0;

    const catMap = {};
    filteredExpenses.forEach((e) => {
      catMap[e.category] = (catMap[e.category] || 0) + (parseFloat(e.amount) || 0);
    });

    let topCategory = 'None';
    let topCatAmount = 0;
    Object.entries(catMap).forEach(([cat, amt]) => {
      if (amt > topCatAmount) {
        topCatAmount = amt;
        topCategory = cat;
      }
    });

    const topShare = total > 0 ? Math.round((topCatAmount / total) * 100) : 0;

    return { total, count, avg, topCategory, topShare, catMap };
  }, [filteredExpenses]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  
  const paginatedExpenses = useMemo(() => {
    const startIdx = (validCurrentPage - 1) * pageSize;
    return filteredExpenses.slice(startIdx, startIdx + pageSize);
  }, [filteredExpenses, validCurrentPage, pageSize]);

  // Export CSV in Rupees
  const handleExportCSV = () => {
    const headers = ["ID", "Payee", "Amount (INR)", "Category", "Date", "PaymentMethod", "Source", "Notes"];
    const rows = filteredExpenses.map(e => [
      e.id,
      `"${e.payee.replace(/"/g, '""')}"`,
      e.amount,
      `"${e.category}"`,
      e.date,
      `"${e.paymentMethod || ''}"`,
      `"${e.source || ''}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `expenses_report_inr_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export JSON
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredExpenses, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `expenses_report_inr_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="reports-dashboard-container">
      {/* 1. Header & Actions */}
      <div className="reports-header">
        <div>
          <div className="reports-title-row">
            <h1 className="reports-main-heading">Expense Reports & Transactions</h1>
            <span className="live-status-pill">
              <CheckCircleIcon size={14} />
              <span>Verified Records</span>
            </span>
          </div>
          <p className="reports-subheading">
            Review, edit, or search through all verified expense records populated via the Chatbot and OCR receipt scanner.
          </p>
        </div>

        <div className="reports-header-btns">
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => setIsShareModalOpen(true)}
            title="Share plain statement via WhatsApp, link, or print PDF"
          >
            <ShareIcon size={14} />
            <span>Share Statement</span>
          </button>
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => setIsScanModalOpen(true)}
            title="Inspect receipt and verify fields side-by-side"
          >
            <ReceiptIcon size={14} />
            <span>Scan & Verify Side-by-Side</span>
          </button>
          <button type="button" className="btn-secondary" onClick={handleExportCSV}>
            <DownloadIcon size={14} />
            <span>Export CSV</span>
          </button>
          <button type="button" className="btn-secondary" onClick={handleExportJSON}>
            <DownloadIcon size={14} />
            <span>Export JSON</span>
          </button>
          <button type="button" className="btn-primary" onClick={onNavigateToChat}>
            <BotIcon size={15} />
            <span>+ Record Expense</span>
          </button>
        </div>
      </div>

      {/* Feature 1: Plain-Language Financial Storyboard (Executive Digest) */}
      <FinancialStoryboard
        expenses={expenses}
        currency={currency}
        monthlyBudget={50000}
        onOpenScan={() => setIsScanModalOpen(true)}
        onOpenShare={() => setIsShareModalOpen(true)}
      />

      {/* 2. FIRST: Filter & Search Controls */}
      <div className="table-controls-bar">
        {/* Search */}
        <div className="search-input-wrap">
          <SearchIcon size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by Payee, Notes, or ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchTerm && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchTerm('')}
            >
              ×
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="filters-group">
          <div className="filter-select-wrap">
            <span className="filter-label">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="filter-select"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-select-wrap">
            <span className="filter-label">Period:</span>
            <select
              value={timeRange}
              onChange={(e) => {
                setTimeRange(e.target.value);
                setCurrentPage(1);
              }}
              className="filter-select"
            >
              <option value="All Time">All Time</option>
              <option value="This Month">This Month</option>
              <option value="This Week">This Week</option>
            </select>
          </div>

          <div className="filter-select-wrap">
            <span className="filter-label">Source:</span>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="filter-select"
            >
              <option value="All">All Sources</option>
              <option value="Chatbot">Chatbot</option>
              <option value="OCR Receipt">OCR Receipt</option>
            </select>
          </div>

          {/* Strict Page Size Control: 5 to 10 rows max */}
          <div className="filter-select-wrap page-size-wrap">
            <span className="filter-label">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="filter-select"
            >
              <option value={5}>5 rows (Recommended)</option>
              <option value={8}>8 rows</option>
              <option value={10}>10 rows (Max)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. FIRST: Primary Transaction Table */}
      <div className="table-card">
        <div className="table-responsive">
          <table className="expenses-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Payee / Vendor</th>
                <th>Category</th>
                <th>Payment Method</th>
                <th>Source</th>
                <th className="text-right">Amount ({currency})</th>
                <th>Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-empty-cell">
                    <div className="table-empty-wrap">
                      <ReceiptIcon size={32} />
                      <p>No matching expenses found.</p>
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => {
                          setSearchTerm('');
                          setSelectedCategory('All');
                          setTimeRange('All Time');
                          setSourceFilter('All');
                        }}
                      >
                        Reset filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((expense) => {
                  const isNewChat = expense.source === 'Chatbot';

                  return (
                    <tr key={expense.id} className="expense-row">
                      <td className="id-cell">
                        <span className="record-id-chip">{expense.id}</span>
                      </td>

                      <td className="date-cell">
                        <span>{expense.date}</span>
                      </td>

                      <td className="payee-cell">
                        <div className="payee-name">{expense.payee}</div>
                        {expense.notes && (
                          <div className="payee-notes" title={expense.notes}>
                            {expense.notes}
                          </div>
                        )}
                        {expense.receiptName && (
                          <div className="receipt-attachment-chip" title={`Attachment: ${expense.receiptName}`}>
                            <ReceiptIcon size={12} />
                            <span>{expense.receiptName}</span>
                          </div>
                        )}
                      </td>

                      <td>
                        <span className="table-category-pill">
                          {expense.category}
                        </span>
                      </td>

                      <td className="text-muted">
                        {expense.paymentMethod || 'UPI / Card'}
                      </td>

                      <td>
                        <span className={`source-pill ${isNewChat ? 'source-chat' : 'source-ocr'}`}>
                          {isNewChat ? <BotIcon size={12} /> : <ReceiptIcon size={12} />}
                          <span>{expense.source || 'Manual'}</span>
                        </span>
                      </td>

                      <td className="text-right amount-cell">
                        <span className="amount-value">
                          {currency}{parseFloat(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      <td>
                        <span className="verified-status-tag">
                          <CheckCircleIcon size={13} />
                          <span>Verified</span>
                        </span>
                      </td>

                      <td className="text-center actions-cell">
                        <div className="action-buttons-wrap">
                          <button
                            type="button"
                            className="btn-row-action btn-edit"
                            title="Edit transaction"
                            onClick={() => setEditingExpense(expense)}
                          >
                            <EditIcon size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-row-action btn-delete"
                            title="Delete transaction"
                            onClick={() => setDeleteConfirmExpense(expense)}
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Strict Pagination Footer */}
        <div className="table-pagination-footer">
          <div className="pagination-info">
            Showing{' '}
            <strong>
              {filteredExpenses.length === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1}
            </strong>{' '}
            to{' '}
            <strong>
              {Math.min(validCurrentPage * pageSize, filteredExpenses.length)}
            </strong>{' '}
            of <strong>{filteredExpenses.length}</strong> entries (Max {pageSize} per page)
          </div>

          <div className="pagination-controls">
            <button
              type="button"
              className="btn-pagination-nav"
              disabled={validCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeftIcon size={16} />
              <span>Previous</span>
            </button>

            <div className="pagination-pages">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  className={`page-num-btn ${pageNum === validCurrentPage ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn-pagination-nav"
              disabled={validCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <span>Next</span>
              <ChevronRightIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. BELOW TABLE: Analytics Overview & Visual Breakdown */}
      <div className="analytics-section-below">
        <div className="analytics-section-header">
          <h2 className="analytics-main-title">
            <ChartIcon size={20} />
            <span>Expense Analytics & Summary Overview</span>
          </h2>
          <p className="analytics-main-sub">
            Calculated summary and distribution across all verified expenses.
          </p>
        </div>

        {/* KPI Summary Cards */}
        <div className="kpi-grid">
          <div className="kpi-card highlight-card">
            <div className="kpi-header">
              <span className="kpi-label">Total Verified Expenditure</span>
              <span className="kpi-tag-cream">Reconciled</span>
            </div>
            <div className="kpi-value">
              {currency}{stats.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="kpi-footer">
              <span>Total calculated across {stats.count} filtered records</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-label">Total Records</span>
            </div>
            <div className="kpi-value">{stats.count}</div>
            <div className="kpi-footer">
              <span>{expenses.length} total entries in database</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-label">Average per Expense</span>
            </div>
            <div className="kpi-value">
              {currency}{stats.avg.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="kpi-footer">
              <span>Average amount spent per transaction</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-label">Top Expense Category</span>
            </div>
            <div className="kpi-value text-navy">{stats.topCategory}</div>
            <div className="kpi-footer">
              <span>{stats.topShare}% of total expense budget</span>
            </div>
          </div>
        </div>

        {/* Visual Category Breakdown & Trend Velocity */}
        <div className="analytics-split">
          <div className="analytics-card">
            <h3 className="card-section-title">Expense Category Breakdown</h3>
            <p className="card-section-sub">Spending distribution by category in Rupees</p>
            
            <div className="category-bars-list">
              {Object.keys(stats.catMap).length === 0 ? (
                <div className="empty-sub">No category records in this view</div>
              ) : (
                Object.entries(stats.catMap)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amt]) => {
                    const pct = stats.total > 0 ? (amt / stats.total) * 100 : 0;
                    return (
                      <div key={cat} className="category-bar-row">
                        <div className="cat-bar-header">
                          <span className="cat-name">{cat}</span>
                          <span className="cat-amt">
                            {currency}{amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({pct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="cat-bar-track">
                          <div
                            className="cat-bar-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          <div className="analytics-card">
            <h3 className="card-section-title">Recent Spending Overview</h3>
            <p className="card-section-sub">Expenditure distribution across recent verified items</p>
            
            <div className="trend-visual-container">
              {expenses.slice(0, 8).map((exp, idx) => {
                const maxAmt = Math.max(...expenses.map(e => e.amount), 5000);
                const heightPct = Math.min(100, Math.max(12, (exp.amount / maxAmt) * 100));

                return (
                  <div key={exp.id || idx} className="chart-bar-col" title={`${exp.payee}: ${currency}${exp.amount}`}>
                    <div className="bar-tooltip">
                      {currency}{Math.round(exp.amount)}
                    </div>
                    <div className="chart-bar-wrapper">
                      <div
                        className="chart-bar-pillar"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="bar-label">{exp.payee.slice(0, 8)}..</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          currency={currency}
          onClose={() => setEditingExpense(null)}
          onSave={(id, updates) => {
            onUpdateExpense(id, updates);
            setEditingExpense(null);
          }}
          onDelete={(id) => {
            onDeleteExpense(id);
            setEditingExpense(null);
          }}
        />
      )}

      {/* In-App Delete Confirmation Modal */}
      {deleteConfirmExpense && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirmExpense(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Transaction</h3>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setDeleteConfirmExpense(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body" style={{ padding: '16px 20px' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>
                Are you sure you want to permanently delete record <strong>{deleteConfirmExpense.id}</strong> ({deleteConfirmExpense.payee} • {currency}{parseFloat(deleteConfirmExpense.amount).toFixed(2)}) from the PostgreSQL database?
              </p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setDeleteConfirmExpense(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-delete"
                onClick={() => {
                  onDeleteExpense(deleteConfirmExpense.id);
                  setDeleteConfirmExpense(null);
                }}
              >
                <TrashIcon size={14} />
                <span>Yes, Delete from PostgreSQL</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 2: Side-by-Side Scan & Verify Split Modal */}
      <ScanVerifyModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onSaveExpense={async (newExp) => {
          const result = await api.addExpense(newExp);
          if (result.success) {
            if (onAddExpense) onAddExpense(result.data);
            setIsScanModalOpen(false);
          } else {
            throw new Error(result.message || 'Could not save this expense.');
          }
        }}
        existingExpenses={expenses}
        currency={currency}
      />

      {/* Feature 3: One-Click Shareable Expense Statement Modal */}
      <ShareStatementModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        expenses={filteredExpenses}
        currency={currency}
        timeRange={timeRange}
      />
    </div>
  );
}
