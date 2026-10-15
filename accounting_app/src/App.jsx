import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LandingPage from './components/LandingPage';
import ReportsDashboard from './components/ReportsDashboard';
import Chatbot from './components/Chatbot';
import ScanVerifyModal from './components/ScanVerifyModal';
import ShareStatementModal from './components/ShareStatementModal';
import { BotIcon, CheckCircleIcon } from './components/Icons';
import { api } from './services/api';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('landing'); // 'landing' | 'reports'
  const [expenses, setExpenses] = useState([]);
  const [currency, setCurrency] = useState('₹');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatFullscreen, setIsChatFullscreen] = useState(false);
  const [chatInitialAction, setChatInitialAction] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [storageMode, setStorageMode] = useState('loading');
  const [hasPendingLocal, setHasPendingLocal] = useState(false);
  const [isGlobalScanOpen, setIsGlobalScanOpen] = useState(false);
  const [isGlobalShareOpen, setIsGlobalShareOpen] = useState(false);

  // Load expenses on startup
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const res = await api.getExpenses();
        if (cancelled) return;
        if (res && res.data) setExpenses(res.data);
        setHasPendingLocal(Boolean(res?.hasPendingLocal));
        setStorageMode(res?.isLocal ? 'local' : 'backend');
      } catch (error) {
        if (cancelled) return;
        setStorageMode('error');
        setToastMessage(error.message || 'Could not load expense records.');
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  // Display Toast Notification
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Open chatbot with optional action ('invoice', etc.)
  const handleOpenChat = (action = null) => {
    setIsChatOpen(true);
    setIsChatFullscreen(false);
    if (action) {
      setChatInitialAction(action);
    }
  };

  // Close chatbot
  const handleCloseChat = () => {
    setIsChatOpen(false);
    setIsChatFullscreen(false);
    setChatInitialAction(null);
  };

  // Callback when user verifies an expense in the chatbot
  const handleExpenseAdded = (newExpense) => {
    setExpenses((prev) => [newExpense, ...prev]);
    const localOnly = Boolean(newExpense.localOnly);
    if (localOnly) setHasPendingLocal(true);
    setStorageMode(localOnly || hasPendingLocal || expenses.some((expense) => expense.localOnly) ? 'local' : 'backend');
    showToast(localOnly
      ? `Transaction ${newExpense.id} is saved in this browser only.`
      : `Transaction ${newExpense.id} verified and populated into Reports Dashboard!`);
  };

  // Callback when user edits an expense in the Reports Dashboard
  const handleUpdateExpense = async (id, updates) => {
    try {
      const res = await api.updateExpense(id, updates);
      if (res && res.data) {
        setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...res.data } : e)));
        if (res.isLocal || res.data.localOnly) setHasPendingLocal(true);
        setStorageMode(res.isLocal || hasPendingLocal || expenses.some((expense) => expense.localOnly && expense.id !== id) || res.data.localOnly ? 'local' : 'backend');
        showToast(res.isLocal ? `Expense ${id} updated in this browser only.` : `Expense ${id} updated successfully.`);
      } else {
        showToast(res?.message || 'Could not update this expense.');
      }
    } catch (error) {
      showToast(error.message || 'Could not update this expense.');
    }
  };

  // Callback when user deletes an expense
  const handleDeleteExpense = async (id) => {
    try {
      const result = await api.deleteExpense(id);
      if (!result.success) throw new Error(result.message || 'Could not delete this expense.');
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      if (result.isLocal) setHasPendingLocal(true);
      setStorageMode(result.isLocal || hasPendingLocal || expenses.some((expense) => expense.localOnly && expense.id !== id) ? 'local' : 'backend');
      showToast(result.isLocal ? `Expense ${id} removed in this browser only.` : `Expense ${id} removed from records.`);
    } catch (error) {
      showToast(error.message || 'Could not delete this expense.');
    }
  };

  return (
    <div className="app-root">
      {/* Top Universal Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalCount={expenses.length}
        currency={currency}
        setCurrency={setCurrency}
        onOpenChat={() => handleOpenChat('invoice')}
        onOpenScan={() => setIsGlobalScanOpen(true)}
        onOpenShare={() => setIsGlobalShareOpen(true)}
      />

      {storageMode === 'local' && (
        <div className="storage-mode-banner" role="status">
          Local demo mode: browser-only changes are kept on this device and are not synced to PostgreSQL automatically.
        </div>
      )}
      {storageMode === 'error' && (
        <div className="storage-mode-banner is-error" role="alert">
          Expense records could not be loaded from the backend. Check the local server and reload.
        </div>
      )}

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'landing' ? (
          <LandingPage
            expenses={expenses}
            currency={currency}
            onExpenseAdded={handleExpenseAdded}
            onOpenChat={handleOpenChat}
            onOpenScan={() => setIsGlobalScanOpen(true)}
            onOpenShare={() => setIsGlobalShareOpen(true)}
            onNavigateToReports={() => {
              setActiveTab('reports');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : (
          <ReportsDashboard
            expenses={expenses}
            currency={currency}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
            onNavigateToChat={() => handleOpenChat('invoice')}
            onAddExpense={handleExpenseAdded}
          />
        )}
      </main>

      {/* Floating Chatbot Assistant Widget — Small window docked in bottom-right corner, expandable to fullscreen */}
      {isChatOpen && (
        <div className={`floating-chat-widget ${isChatFullscreen ? 'widget-fullscreen' : ''}`}>
          <Chatbot
            onExpenseAdded={handleExpenseAdded}
            onNavigateToReports={() => {
              handleCloseChat();
              setActiveTab('reports');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            currency={currency}
            isEmbedded={false}
            isFullscreen={isChatFullscreen}
            onToggleFullscreen={() => setIsChatFullscreen((prev) => !prev)}
            onClose={handleCloseChat}
            initialAction={chatInitialAction}
          />
        </div>
      )}

      {/* Global Scan & Verify Side-by-Side Modal */}
      <ScanVerifyModal
        isOpen={isGlobalScanOpen}
        onClose={() => setIsGlobalScanOpen(false)}
        onSaveExpense={async (expense) => {
          const result = await api.addExpense(expense);
          if (result.success) {
            handleExpenseAdded(result.data);
            setIsGlobalScanOpen(false);
          } else {
            throw new Error(result.message || 'Could not save this expense.');
          }
        }}
        existingExpenses={expenses}
        currency={currency}
      />

      {/* Global Share Statement Modal */}
      <ShareStatementModal
        isOpen={isGlobalShareOpen}
        onClose={() => setIsGlobalShareOpen(false)}
        expenses={expenses}
        currency={currency}
      />

      {/* Floating Launcher Button — Always available in the bottom-right corner of the page */}
      {!isChatOpen && (
        <button
          type="button"
          className="floating-launcher-btn"
          onClick={() => handleOpenChat()}
          title="Open AI Chat Assistant & Invoice Scanner"
          aria-label="Open AI Chat Assistant & Invoice Scanner"
        >
          <div className="launcher-icon-wrap">
            <BotIcon size={22} />
            <span className="launcher-online-dot"></span>
          </div>
          <span className="launcher-label">AI Chatbot</span>
          <span className="launcher-tooltip">Record Expense with AI • OCR Invoices</span>
          <span className="launcher-pulse"></span>
        </button>
      )}

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="global-toast">
          <CheckCircleIcon size={18} className="toast-icon" />
          <span className="toast-text">{toastMessage}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setToastMessage(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-left">
            <strong>FinEase AI</strong> • Modular Expense Tracking & Conversational Accounting Engine
          </div>
          <div className="footer-right">
            <span>OCR Powered</span> • <span>PDF / Images / XML</span> • <span>Indian Rupee (₹) Default</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
