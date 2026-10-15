import { BotIcon, ChartIcon, SparklesIcon, ReceiptIcon, ShareIcon } from './Icons';

export default function Navbar({
  activeTab,
  setActiveTab,
  totalCount = 0,
  currency = '₹',
  onOpenChat,
  onOpenScan,
  onOpenShare
}) {
  return (
    <header className="navbar-container">
      <div className="navbar-content">
        {/* Brand / Logo */}
        <div className="navbar-brand" onClick={() => setActiveTab('landing')} role="button" tabIndex={0}>
          <div className="brand-logo-wrap">
            <BotIcon size={20} className="brand-logo-icon" />
          </div>
          <div className="brand-text">
            <div className="brand-title">
              FinEase <span className="brand-badge-ai">AI</span>
            </div>
            <div className="brand-subtitle">Smart Accounting & Expense Assistant</div>
          </div>
        </div>

        {/* Center Nav Switcher: Landing vs Reports */}
        <nav className="nav-switcher">
          <button
            type="button"
            className={`nav-tab ${activeTab === 'landing' ? 'active' : ''}`}
            onClick={() => setActiveTab('landing')}
          >
            <SparklesIcon size={15} />
            <span>Landing & Overview</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <ChartIcon size={15} />
            <span>Reports Dashboard</span>
            <span className="nav-count-pill">{totalCount}</span>
          </button>
        </nav>

        {/* Right Controls: Quick Actions & Currency */}
        <div className="navbar-actions flex items-center gap-2">
          {onOpenScan && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
              onClick={onOpenScan}
              title="Open side-by-side receipt matcher"
            >
              <ReceiptIcon size={14} />
              <span>Scan & Verify</span>
            </button>
          )}

          {onOpenShare && (
            <button
              type="button"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
              onClick={onOpenShare}
              title="Share statement via WhatsApp or printable PDF"
            >
              <ShareIcon size={14} />
              <span>Share Statement</span>
            </button>
          )}

          <div className="currency-badge" title="Currency set to Indian Rupees">
            <span>INR ({currency})</span>
          </div>

          <button
            type="button"
            className="btn-quick-chat"
            onClick={onOpenChat}
            title="Log new expense with conversational chatbot"
          >
            <BotIcon size={15} />
            <span>+ AI Assistant</span>
          </button>
        </div>
      </div>
    </header>
  );
}
