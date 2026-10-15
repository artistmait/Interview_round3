import { useState } from 'react';
import { 
  BotIcon, 
  UploadCloudIcon, 
  CheckCircleIcon, 
  ReceiptIcon,
  ChartIcon, 
  ArrowRightIcon,
  SparklesIcon,
  ChevronRightIcon
} from './Icons';

// Local asset illustrations
import financeImg1 from '../assets/finanace_img1.png';
import financeImg2 from '../assets/finance_img2.png';
import heroLayer from '../assets/hero.png';

export default function LandingPage({
  expenses = [],
  currency = '₹',
  onExpenseAdded,
  onOpenChat,
  onNavigateToReports,
  onOpenScan,
  onOpenShare
}) {
  const [dragActive, setDragActive] = useState(false);

  const recentThree = expenses.slice(0, 3);
  const totalAmount = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      if (onOpenChat) {
        onOpenChat('invoice');
      }
    }
  };

  return (
    <div className="landing-page-container">
      {/* 1. Hero Section (Slack-inspired Split Composition) */}
      <section className="slack-hero-section">
        <div className="slack-hero-grid">
          {/* Left Column: Bold Copy & Action */}
          <div className="slack-hero-left">

            <h1 className="slack-hero-title">
              Where Everyday <br />
              <span className="text-gradient-blue">Expenses Get Solved.</span>
            </h1>

            <p className="slack-hero-subtitle">
              When your team needs to scan a lunch bill, record daily commute fares, parse vendor invoices with line items, claim GST, or review monthly cashflow — FinEase has you covered.
            </p>

            {/* Key Micro-Metrics */}
            <div className="hero-micro-metrics">
              <div className="metric-cell">
                <div className="metric-num">
                  {currency}{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
                <div className="metric-label">Verified INR Expenses</div>
              </div>
              <div className="metric-divider"></div>
              <div className="metric-cell">
                <div className="metric-num">{expenses.length || 12}+</div>
                <div className="metric-label">Logged Invoices</div>
              </div>
              <div className="metric-divider"></div>
              <div className="metric-cell">
                <div className="metric-num">0.4s</div>
                <div className="metric-label">Tesseract OCR Speed</div>
              </div>
            </div>
          </div>

          {/* Right Column: Creative Illustration with Live Floating OCR Badges */}
          <div className="slack-hero-right">
            <div className="hero-illustration-stage">
              {/* Background ambient blue glow */}
              <div className="stage-ambient-glow"></div>

              {/* Main Artwork */}
              <div className="illustration-wrapper">
                <img 
                  src={financeImg1} 
                  alt="FinEase AI Automated Accounting and Finance Dashboard" 
                  className="hero-main-illustration"
                />
              </div>

              {/* Floating Live Badge #1: Top Right OCR Extraction Card */}
              <div className="floating-badge badge-top-right">
                <div className="badge-header">
                  <div className="badge-icon-wrap">
                    <ReceiptIcon size={14} />
                  </div>
                  <div className="badge-title-group">
                    <span className="badge-tag">OCR EXTRACTED • 98% ACCURACY</span>
                    <strong className="badge-payee">Bhagini (Sriganda Palace)</strong>
                  </div>
                </div>
                <div className="badge-body">
                  <div className="badge-row">
                    <span>Invoice #7767</span>
                    <strong className="text-blue-600">₹3,150.00</strong>
                  </div>
                  <div className="badge-items-snippet">
                    <span>• Mutton Biriyani (4x @ ₹400)</span>
                    <span>• CGST + SGST (₹150.00)</span>
                  </div>
                </div>
                <div className="badge-status-chip">
                  <CheckCircleIcon size={12} />
                  <span>Reconciled to PostgreSQL</span>
                </div>
              </div>

              {/* Floating Live Badge #2: Bottom Left Conversational Chat Badge */}
              <div className="floating-badge badge-bottom-left">
                <div className="chat-bubble-mini">
                  <div className="mini-avatar">
                    <BotIcon size={14} />
                  </div>
                  <div className="mini-text">
                    <span className="mini-sender">FinEase Assistant</span>
                    <p className="mini-msg">"Got it! Categorized ₹450 to <strong>Travel & Commute</strong>."</p>
                  </div>
                </div>
                <div className="mini-meta-strip">
                  <span className="ping-online-dot"></span>
                  <span>Instant Natural Language Logging</span>
                </div>
              </div>

              {/* Floating Live Badge #3: Subtle Platform Stack Badge */}
              <div className="floating-badge badge-middle-stack">
                <img src={heroLayer} alt="Layers" className="stack-icon-layer" />
                <div className="stack-info">
                  <strong>Zero Jargon</strong>
                  <span>Plain English Bookkeeping</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Drag & Drop Live Bill Ingestion Zone (Layman-friendly) */}
      <section className="live-dropzone-section">
        <div 
          className={`dropzone-interactive-card ${dragActive ? 'drag-active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleFileDrop}
          onClick={() => onOpenChat && onOpenChat('invoice')}
        >
          <div className="dropzone-left-info">
            <div className="dropzone-icon-pulse">
              <UploadCloudIcon size={28} />
            </div>
            <div>
              <h3 className="dropzone-title">Drop your receipt, bill, or invoice right here</h3>
              <p className="dropzone-subtitle">
                Accepts <strong>PDF, JPG, PNG, or XML</strong> • Our Tesseract engine extracts vendor, date, taxes & line items automatically.
              </p>
            </div>
          </div>

          <div className="dropzone-action-side flex flex-col gap-2">
            <button 
              type="button" 
              className="btn-dropzone-cta"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenChat) onOpenChat('invoice');
              }}
            >
              <UploadCloudIcon size={16} />
              <span>Select File or Test OCR</span>
            </button>

            {onOpenScan && (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 shadow-2xs transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenScan();
                }}
              >
                <ReceiptIcon size={14} />
                <span>Side-by-Side Matcher</span>
              </button>
            )}

            <span className="dropzone-hint-note">100% private & secure locally</span>
          </div>
        </div>
      </section>

      {/* 3. The 3-Step Layman Flow: "How Plain Accounting Works" */}
      <section className="workflow-trio-section">
        <div className="section-header-slack">
          <span className="section-kicker-blue">HOW IT WORKS</span>
          <h2 className="section-main-heading">
            Accounting Made Friction-Free for Everyone
          </h2>
          <p className="section-lead-copy">
            No complicated double-entry ledger forms. You don’t need an accounting degree to track every rupee accurately.
          </p>
        </div>

        <div className="steps-cards-grid">
          {/* Step 1 */}
          <div className="step-feature-card">
            <div className="step-card-num">01</div>
            <div className="step-card-icon-wrap bg-blue-50 text-blue-700">
              <UploadCloudIcon size={24} />
            </div>
            <h3 className="step-card-title">Snap or Drop Any Bill</h3>
            <p className="step-card-desc">
              Whether it’s a printed restaurant slip, grocery thermal bill, cab PDF receipt, or e-invoice XML — upload it in one click without re-typing.
            </p>
            <div className="step-feature-footer">
              <span className="pill-blue-light">Camera Photos • PDFs • JPG</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="step-feature-card active-flow-card">
            <div className="step-card-num">02</div>
            <div className="step-card-icon-wrap bg-blue-600 text-white shadow-blue">
              <SparklesIcon size={24} />
            </div>
            <h3 className="step-card-title">Tesseract OCR Does the Reading</h3>
            <p className="step-card-desc">
              High-accuracy layout parsing automatically detects the merchant, date, individual line items, quantities, sub-total, and CGST/SGST taxes.
            </p>
            <div className="step-feature-footer">
              <span className="pill-blue-light">Sub-Total • Tax • Item Table</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="step-feature-card">
            <div className="step-card-num">03</div>
            <div className="step-card-icon-wrap bg-blue-50 text-blue-700">
              <CheckCircleIcon size={24} />
            </div>
            <h3 className="step-card-title">One-Click Confirm & Dashboard Sync</h3>
            <p className="step-card-desc">
              Review the clean summary card in the chatbot. Click "Confirm & Log" and the expense is immediately saved to your PostgreSQL database.
            </p>
            <div className="step-feature-footer">
              <span className="pill-blue-light">Reconciled • Charts • CSV/JSON</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Deep-Dive Showcase featuring second asset: finance_img2.png */}
      <section className="showcase-split-section">
        <div className="showcase-split-card">
          <div className="showcase-split-grid">
            {/* Visual Column with finance_img2 */}
            <div className="showcase-visual-col">
              <div className="showcase-art-frame">
                <img 
                  src={financeImg2} 
                  alt="Finance Presentation and Insights" 
                  className="showcase-character-art"
                />
                <div className="showcase-art-tag">
                  <ChartIcon size={15} />
                  <span>Real-Time Reports & Cashflow Analytics</span>
                </div>
              </div>
            </div>

            {/* Copy & Value Props Column */}
            <div className="showcase-info-col">
              <span className="section-kicker-blue">EFFORTLESS RECORDING</span>
              <h2 className="showcase-col-title">
                Talk to Your Books Like You Talk to a Friend.
              </h2>
              <p className="showcase-col-desc">
                Forgot the receipt? Just open the assistant in the corner and type casually: <em>"Spent ₹650 on team pizza"</em> or <em>"Paid ₹3,250 electricity bill today"</em>. The AI classifies it and updates your spend charts automatically.
              </p>

              <div className="benefits-checklist">
                <div className="benefit-row">
                  <div className="benefit-check-icon">
                    <CheckCircleIcon size={16} />
                  </div>
                  <div>
                    <strong>No Manual Math or Ledger Codes</strong>
                    <p>Every transaction is saved with clear Indian Rupee (₹) formatting and standard categories.</p>
                  </div>
                </div>

                <div className="benefit-row">
                  <div className="benefit-check-icon">
                    <CheckCircleIcon size={16} />
                  </div>
                  <div>
                    <strong>Guided 3-Step Questioning</strong>
                    <p>Can't recall exact details? The bot asks 3 quick multiple-choice questions to categorize it in seconds.</p>
                  </div>
                </div>

                <div className="benefit-row">
                  <div className="benefit-check-icon">
                    <CheckCircleIcon size={16} />
                  </div>
                  <div>
                    <strong>Complete Audit Trail with PostgreSQL</strong>
                    <p>Full edit, search, filter, and CSV/JSON export capabilities whenever your accountant asks.</p>
                  </div>
                </div>
              </div>

              <div className="showcase-cta-row">
                <button
                  type="button"
                  className="btn-slack-primary"
                  onClick={() => onOpenChat && onOpenChat()}
                >
                  <BotIcon size={17} />
                  <span>Launch AI Assistant (Corner)</span>
                </button>

                <button
                  type="button"
                  className="btn-slack-secondary"
                  onClick={onNavigateToReports}
                >
                  <span>Open Reports Dashboard</span>
                  <ArrowRightIcon size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Live Reconciled Expenses Snippet */}
      <section className="recent-records-slack-section">
        <div className="recent-header-slack">
          <div>
            <span className="section-kicker-blue">POSTGRESQL AUDIT TRAIL</span>
            <h3 className="recent-title-slack">Recent Verified Transactions</h3>
          </div>

          <button
            type="button"
            className="btn-slack-link"
            onClick={onNavigateToReports}
          >
            <span>Explore all {expenses.length} records in Reports</span>
            <ChevronRightIcon size={16} />
          </button>
        </div>

        <div className="recent-cards-slack-grid">
          {recentThree.map((item) => (
            <div key={item.id} className="slack-expense-card">
              <div className="card-top-line">
                <span className="card-id-tag">{item.id}</span>
                <span className="card-source-chip">
                  {item.source === 'OCR Receipt' ? 'OCR Ingested' : 'Chat Logged'}
                </span>
              </div>

              <div className="card-main-info">
                <strong className="card-payee-name">{item.payee}</strong>
                <div className="card-amount-large">
                  {currency}{parseFloat(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="card-bottom-meta">
                <div className="card-cat-pill">{item.category}</div>
                <div className="card-date-str">{item.date}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Bold Blue Call-to-Action Card (Slack footer hero style) */}
      <section className="slack-bottom-banner">
        <div className="bottom-banner-content">
          <div className="banner-badge-light">
            <SparklesIcon size={15} />
            <span>Simplify Your Accounting Today</span>
          </div>

          <h2 className="banner-title">
            Ready to Take the Headache Out of Expense Tracking?
          </h2>

          <p className="banner-desc">
            No software installation required. Click the floating AI Assistant button anytime, upload your receipts, and keep your accounting in tip-top shape.
          </p>

          <div className="banner-actions">
            <button
              type="button"
              className="btn-banner-white"
              onClick={() => onOpenChat && onOpenChat('invoice')}
            >
              <UploadCloudIcon size={17} />
              <span>Scan Your First Receipt Now</span>
            </button>

            <button
              type="button"
              className="btn-banner-translucent"
              onClick={onNavigateToReports}
            >
              <ChartIcon size={17} />
              <span>View Financial Reports Dashboard</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
