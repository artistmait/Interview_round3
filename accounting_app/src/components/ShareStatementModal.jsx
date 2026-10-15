import { useState } from 'react';
import { api } from '../services/api';
import { 
  CloseIcon, 
  ShareIcon, 
  CopyIcon, 
  PrinterIcon, 
  CheckCircleIcon,
  ReceiptIcon 
} from './Icons';

export default function ShareStatementModal({
  isOpen,
  onClose,
  expenses = [],
  currency = '₹',
  timeRange = 'All Time'
}) {
  const [activeTab, setActiveTab] = useState('whatsapp'); // 'whatsapp' | 'preview' | 'link'
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [linkError, setLinkError] = useState('');

  if (!isOpen) return null;

  const totalAmount = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const totalCount = expenses.length;
  const statementExpenses = [...expenses].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const generatedDate = new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(new Date());

  // Find top category
  const catMap = {};
  expenses.forEach((e) => {
    catMap[e.category] = (catMap[e.category] || 0) + (parseFloat(e.amount) || 0);
  });
  let topCategory = 'General';
  let topAmount = 0;
  Object.entries(catMap).forEach(([cat, amt]) => {
    if (amt > topAmount) {
      topAmount = amt;
      topCategory = cat;
    }
  });

  // Plain WhatsApp Summary Text
  const summaryText = `📊 *FinEase AI - Financial Expense Summary*
📅 Period: ${timeRange}
💰 Total Outgoing: ${currency}${totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${totalCount} transactions)
🏆 Top Category: ${topCategory} (${currency}${topAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })})
🔒 Status: Verified & Reconciled

Recent Highlights:
${statementExpenses.slice(0, 4).map((e) => `• ${e.date}: ${e.payee} - ${currency}${parseFloat(e.amount).toFixed(0)} [${e.category}]`).join('\n')}

_Generated securely via FinEase AI Bookkeeping_`;

  const handleCopyText = () => {
    navigator.clipboard.writeText(summaryText)
      .then(() => {
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2000);
      })
      .catch(() => setLinkError('Clipboard access is unavailable. Select and copy the summary manually.'));
  };

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;

  const handleCreateShareLink = async () => {
    setIsCreatingLink(true);
    setLinkError('');
    try {
      const created = await api.createSharedStatement({
        expenses: statementExpenses,
        currency,
        period: timeRange
      });
      setShareLink({
        ...created,
        url: `${(import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '')}/shared/${created.token}`
      });
    } catch (error) {
      setLinkError(error.message || 'Could not create a share link. Check that the backend is running.');
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink.url);
      setCopiedLink(true);
      setLinkError('');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setLinkError('Clipboard access is unavailable. Select and copy the link manually.');
    }
  };

  const handleRevokeLink = async () => {
    if (!shareLink) return;
    try {
      await api.revokeSharedStatement(shareLink.token);
      setShareLink(null);
      setCopiedLink(false);
      setLinkError('This share link has been revoked.');
    } catch (error) {
      setLinkError(error.message || 'Could not revoke this share link.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="share-statement-overlay fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-blue-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Top Header - Blue Theme */}
        <div className="share-statement-header px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="share-statement-icon w-9 h-9 rounded-lg flex items-center justify-center">
              <ShareIcon size={18} />
            </div>
            <div>
              <h3 className="share-statement-title">
                Share Expense Statement
              </h3>
              <p className="share-statement-subtitle">
                Send plain summaries to clients, partners, or accountants without login friction
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="share-statement-close w-9 h-9 rounded-lg flex items-center justify-center"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="share-statement-tabs px-6 flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`share-statement-tab ${
              activeTab === 'whatsapp'
                ? 'active'
                : ''
            }`}
          >
            💬 WhatsApp & Message Copy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`share-statement-tab ${
              activeTab === 'preview'
                ? 'active'
                : ''
            }`}
          >
            📄 Printable Client Statement
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`share-statement-tab ${
              activeTab === 'link'
                ? 'active'
                : ''
            }`}
          >
            🔗 Zero-Login Share Link
          </button>
        </div>

        {/* Tab Content */}
        <div className="share-statement-content p-6 overflow-y-auto space-y-4 flex-1 bg-white">
          {activeTab === 'whatsapp' && (
            <div className="space-y-4">
              <div className="share-statement-intro">
                Easily forward this non-technical summary directly to your manager, accountant, or team group:
              </div>

              <div className="share-statement-summary p-4 rounded-xl whitespace-pre-wrap">
                {summaryText}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-xs text-slate-500">
                  Includes key numbers and recent transactions in plain text.
                </span>
                <div className="share-statement-message-actions">
                  <a href={whatsappShareUrl} target="_blank" rel="noreferrer" className="share-statement-whatsapp-link">
                    Share via WhatsApp
                  </a>
                  <button type="button" onClick={handleCopyText} className="share-statement-copy-summary">
                    {copiedText ? <><CheckCircleIcon size={14} /> Copied!</> : <><CopyIcon size={14} /> Copy summary</>}
                  </button>
                </div>
                <p className="share-statement-whatsapp-help">WhatsApp opens with the message ready. Choose a chat and tap Send to share it.</p>
              </div>
              {linkError && <p className="share-statement-link-error" role="status">{linkError}</p>}
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-4">
              {/* Clean Printable Client Statement Sheet */}
              <div className="share-statement-printable p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-4 text-xs font-sans">
                <div className="flex justify-between items-start pb-3 border-b border-slate-200">
                  <div>
                    <h4 className="text-base font-bold text-blue-950">FinEase AI Expense Report</h4>
                    <p className="text-slate-500">Period: {timeRange}</p>
                    <p className="text-slate-500">Generated {generatedDate}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-700 block">Total Statement</span>
                    <span className="text-base font-bold text-blue-600">
                      {currency}{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="share-statement-rows">
                  {statementExpenses.map((e) => (
                    <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <div>
                        <strong className="text-slate-800">{e.payee}</strong>
                        <div className="text-[11px] text-slate-500">{e.date || 'No date'} • {e.category || 'Uncategorized'}</div>
                      </div>
                      <div className="text-right font-medium text-slate-900">
                        {currency}{parseFloat(e.amount).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-200 font-bold">
                  <span>{totalCount} transactions</span>
                  <span>Total: {currency}{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <div className="text-center text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                  Ready for submission • Clean audit format
                </div>
              </div>

              <div className="share-statement-actions flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                >
                  <PrinterIcon size={14} />
                  <span>Print / Save as PDF</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'link' && (
            <div className="space-y-4">
              <p className="share-statement-intro">
                Create an expiring, read-only snapshot. Anyone with the link can view it for 30 days; you can revoke it at any time.
              </p>

              {shareLink ? (
                <>
                  <div className="share-statement-link-row flex items-center gap-2 p-2 rounded-xl">
                    <input type="text" readOnly value={shareLink.url} aria-label="Read-only share link" className="share-statement-link-input grow bg-transparent text-xs font-mono focus:outline-hidden px-2" />
                    <button type="button" onClick={handleCopyLink} className="share-statement-link-copy rounded-lg text-xs font-semibold shrink-0 transition-colors">
                      {copiedLink ? 'Copied!' : 'Copy Link'}
                    </button>
                  </div>
                  <div className="share-statement-link-actions">
                    <span>Expires {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(shareLink.expiresAt))}</span>
                    <button type="button" onClick={handleRevokeLink}>Revoke link</button>
                  </div>
                </>
              ) : (
                <button type="button" onClick={handleCreateShareLink} disabled={isCreatingLink} className="share-statement-create-link">
                  {isCreatingLink ? 'Creating secure link…' : 'Create secure share link'}
                </button>
              )}
              {linkError && <p className="share-statement-link-error" role="status">{linkError}</p>}

              <div className="share-statement-link-note p-3 rounded-lg text-xs flex items-start gap-2">
                <ReceiptIcon size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Private snapshot:</strong> Only transaction date, payee, category, amount, and totals are included. Notes and receipt details stay private.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="share-statement-footer px-6 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="share-statement-close-action text-xs font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
