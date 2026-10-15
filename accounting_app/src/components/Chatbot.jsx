import { useState, useRef, useEffect } from 'react';
import { 
  BotIcon, 
  SendIcon, 
  UploadCloudIcon, 
  ReceiptIcon, 
  CheckCircleIcon, 
  RefreshIcon,
  ArrowRightIcon,
  ExpandIcon,
  MinimizeIcon,
  CloseIcon
} from './Icons';
import { api } from '../services/api';
import ScanVerifyModal from './ScanVerifyModal';

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

const SAMPLE_INVOICES = [
  {
    name: "starbucks_bill.jpg",
    type: "IMAGE",
    label: "☕ Starbucks Cafe Bill (₹380.00)",
    desc: "Dining • Coffee & Croissant",
    details: {
      payee: "Starbucks Coffee Co.",
      amount: 380.00,
      category: "Dining",
      date: new Date().toISOString().split('T')[0],
      invoiceNo: "SBX-2026-9912",
      tax: 19.00,
      items: ["Cappuccino Grande (₹280.00)", "Warm Butter Croissant (₹100.00)"],
      confidence: 0.99
    }
  },
  {
    name: "aws_cloud_invoice.pdf",
    type: "PDF",
    label: "☁️ Amazon AWS Cloud (₹4,850.00)",
    desc: "Software & SaaS • EC2 & S3",
    details: {
      payee: "Amazon AWS Cloud Services",
      amount: 4850.00,
      category: "Software & SaaS",
      date: new Date().toISOString().split('T')[0],
      invoiceNo: "AWS-INV-88340",
      tax: 739.80,
      items: ["Amazon Elastic Compute Cloud (EC2)", "Amazon Simple Storage Service (S3)"],
      confidence: 0.98
    }
  },
  {
    name: "uber_commute_slip.png",
    type: "IMAGE",
    label: "🚕 Uber Commute Slip (₹420.00)",
    desc: "Travel & Commute • Office Ride",
    details: {
      payee: "Uber Technologies",
      amount: 420.00,
      category: "Travel & Commute",
      date: new Date().toISOString().split('T')[0],
      invoiceNo: "UBER-TRIP-7718",
      tax: 21.00,
      items: ["Uber Go City Commute - MG Road to Indiranagar"],
      confidence: 0.98
    }
  },
  {
    name: "stationery_invoice.xml",
    type: "XML",
    label: "📑 Stationery Depot (₹1,250.00)",
    desc: "Office Supplies • Paper & Files",
    details: {
      payee: "Stationery Depot",
      amount: 1250.00,
      category: "Office Supplies",
      date: new Date().toISOString().split('T')[0],
      invoiceNo: "SD-EINV-2041",
      tax: 62.50,
      items: ["A4 Executive Copier Paper (5 reams)", "Permanent Markers & Document Files"],
      confidence: 0.96
    }
  }
];

export default function Chatbot({
  onExpenseAdded,
  onNavigateToReports,
  currency = '₹',
  isEmbedded = false,
  isFullscreen: propFullscreen,
  onToggleFullscreen,
  onClose,
  initialAction = null
}) {
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const isFullscreen = propFullscreen !== undefined ? propFullscreen : internalFullscreen;

  const toggleFullscreen = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      setInternalFullscreen((prev) => !prev);
    }
  };

  const [messages, setMessages] = useState([
    {
      id: 'msg-welcome',
      sender: 'bot',
      type: 'welcome',
      text: "Hello! I am your AI Expense Assistant. I can help you record expenses, or scan and parse invoices directly onto your dashboard.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      hints: [
        "📄 Enter / Upload Invoice",
        "☕ Starbucks Cafe Bill (₹380)",
        "☁️ AWS Cloud Invoice (₹4,850)",
        "🚕 Uber Commute Slip (₹420)",
        "💬 Spent ₹350 on lunch",
        "🤔 Forgot expense details..."
      ]
    }
  ]);

  const [inputVal, setInputVal] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const [fuzzyFlow, setFuzzyFlow] = useState(null);
  const [sideBySideDoc, setSideBySideDoc] = useState(null);
  const [sideBySideMsgId, setSideBySideMsgId] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const chatRootRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  // Escape key exits fullscreen
  useEffect(() => {
    if (!isFullscreen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (onToggleFullscreen) onToggleFullscreen();
        else setInternalFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen, onToggleFullscreen]);

  // Handle initialAction (e.g. 'invoice')
  useEffect(() => {
    if (initialAction === 'invoice') {
      startInvoiceEntryFlow();
    }
  }, [initialAction]);

  const sanitizeText = (str) => {
    if (!str) return '';
    return str.replace(/<[^>]*>?/gm, '').trim();
  };

  // Check if text indicates intent to enter an invoice/document
  const isInvoiceIntent = (text) => {
    const lower = text.toLowerCase();
    return (
      lower.includes("invoice") ||
      lower.includes("receipt") ||
      lower.includes("bill") ||
      lower.includes("ocr") ||
      lower.includes("scan document") ||
      lower.includes("upload document") ||
      lower.includes("enter document") ||
      lower.includes("parse document") ||
      lower.includes("upload invoice") ||
      lower.includes("enter invoice")
    );
  };

  // Specific conversational flow for entering an invoice document
  const startInvoiceEntryFlow = () => {
    const promptId = 'invoice-prompt-' + Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: promptId,
        sender: 'bot',
        type: 'invoice-entry-prompt',
        text: "I'll guide you through entering your invoice! You can upload an invoice file (PDF, PNG, JPG, or XML), drag & drop it here, or test with one of our sample invoices. Our OCR engine will automatically extract the vendor, date, total amount (₹), tax/GST, and line items.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Extract amount and vendor from natural language in Rupees
  const parseNaturalLanguage = (text) => {
    const clean = sanitizeText(text);
    
    // Amount regex matching ₹, rs, inr, or pure digits
    const amountRegex = /(?:[$€£₹]|rs\.?\s*|inr\s*)?\s*([0-9]+(?:\.[0-9]{1,2})?)(?:\s*(?:rupees|rs|bucks|inr))?/i;
    const amountMatch = clean.match(amountRegex);
    let amount = 0;
    if (amountMatch && amountMatch[1]) {
      amount = parseFloat(amountMatch[1]);
    }

    const lower = clean.toLowerCase();
    let category = "Miscellaneous";
    if (/(coffee|starbucks|chai|tea|dinner|lunch|breakfast|food|restaurant|burger|pizza|biryani|swiggy|zomato|subway|cafe)/.test(lower)) {
      category = "Dining";
    } else if (/(grocery|supermarket|market|vegetables|fruits|milk|dmart|blinkit|zepto|bigbasket|nature's basket|ration)/.test(lower)) {
      category = "Groceries";
    } else if (/(uber|ola|rapido|auto|cab|taxi|flight|indigo|air india|train|metro|petrol|fuel|toll|commute)/.test(lower)) {
      category = "Travel & Commute";
    } else if (/(electric|bescom|adani|tata power|water|gas bill|cylinder|wifi|broadband|airtel|jio|utility|phone bill)/.test(lower)) {
      category = "Utilities";
    } else if (/(stationery|office|paper|pen|desk|printer|cartridge|supplies)/.test(lower)) {
      category = "Office Supplies";
    } else if (/(aws|amazon web|software|subscription|figma|slack|github|zoom|saas|hosting)/.test(lower)) {
      category = "Software & SaaS";
    } else if (/(pharmacy|doctor|hospital|apollo|medicine|clinic|healthcare|medical)/.test(lower)) {
      category = "Healthcare";
    }

    let payee;
    const atMatch = clean.match(/(?:at|to|from)\s+([A-Za-z0-9\s&'.]+?)(?:\s+(?:for|on|yesterday|today|amounting|₹|rs|\d)|$)/i);
    if (atMatch && atMatch[1] && atMatch[1].trim().length > 1) {
      payee = atMatch[1].trim();
    } else {
      if (lower.includes('starbucks')) payee = "Starbucks Coffee";
      else if (lower.includes('uber')) payee = "Uber Technologies";
      else if (lower.includes('ola')) payee = "Ola Cabs";
      else if (lower.includes('swiggy')) payee = "Swiggy Food Delivery";
      else if (lower.includes('zomato')) payee = "Zomato Restaurant";
      else if (lower.includes('dmart')) payee = "DMart Supermarket";
      else if (lower.includes('blinkit')) payee = "Blinkit Quick Commerce";
      else if (lower.includes('aws') || lower.includes('amazon')) payee = "Amazon AWS Cloud";
      else if (lower.includes('figma')) payee = "Figma Subscription";
      else if (lower.includes('bescom') || lower.includes('adani')) payee = "Electricity Board (Adani/BESCOM)";
      else payee = clean.slice(0, 30) || "Local Merchant";
    }

    return {
      payee,
      amount,
      category,
      date: new Date().toISOString().split('T')[0],
      source: "Chatbot"
    };
  };

  const isVagueOrForgot = (text) => {
    const lower = text.toLowerCase();
    return (
      lower.includes("don't remember") ||
      lower.includes("dont remember") ||
      lower.includes("forgot") ||
      lower.includes("not sure") ||
      lower.includes("vague") ||
      lower.includes("lost track") ||
      (lower.includes("some money") && !lower.match(/\d+/))
    );
  };

  const startFuzzyFlow = () => {
    const promptId = 'fuzzy-' + Date.now();
    setFuzzyFlow({ step: 1, category: null, amount: null, payee: null });

    setMessages((prev) => [
      ...prev,
      {
        id: promptId,
        sender: 'bot',
        type: 'fuzzy-step-1',
        text: "No worries! Let's classify it simply. What was this expense mainly for?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        options: [
          { label: "🍔 Food & Dining", val: "Dining" },
          { label: "🛒 Groceries & Supermarket", val: "Groceries" },
          { label: "🚕 Commute & Travel", val: "Travel & Commute" },
          { label: "💼 Office & Stationery", val: "Office Supplies" },
          { label: "⚡ Utilities & Bills", val: "Utilities" },
          { label: "🛍️ General / Other", val: "Miscellaneous" }
        ]
      }
    ]);
  };

  const handleFuzzyChoice = (val, step) => {
    if (step === 1) {
      setFuzzyFlow((prev) => ({ ...prev, category: val, step: 2 }));
      setMessages((prev) => [
        ...prev,
        {
          id: 'user-choice-' + Date.now(),
          sender: 'user',
          text: `Category: ${val}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        {
          id: 'bot-fuzzy-2-' + Date.now(),
          sender: 'bot',
          type: 'fuzzy-step-2',
          text: `Understood (${val}). Approximately how much was spent in Rupees?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          options: [
            { label: "< ₹200 (Small purchase)", val: 150.00 },
            { label: "₹200 - ₹800 (Moderate)", val: 450.00 },
            { label: "₹800 - ₹2,500 (Substantial)", val: 1400.00 },
            { label: "> ₹2,500 (Major expense)", val: 3800.00 }
          ]
        }
      ]);
    } else if (step === 2) {
      const selectedAmount = val;
      setFuzzyFlow((prev) => ({ ...prev, amount: selectedAmount, step: 3 }));

      setMessages((prev) => [
        ...prev,
        {
          id: 'user-choice-2-' + Date.now(),
          sender: 'user',
          text: `Approx. ${currency}${selectedAmount}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        {
          id: 'bot-fuzzy-3-' + Date.now(),
          sender: 'bot',
          type: 'fuzzy-step-3',
          text: "Almost done. Do you recall who was paid or which payment method was used?",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          options: [
            { label: "UPI / QR Code Scan", payee: "UPI Merchant" },
            { label: "Local Shop / Vendor", payee: "Local Retailer" },
            { label: "Cash Payment", payee: "Cash Vendor" },
            { label: "Not sure (Use 'Unclassified')", payee: "Unclassified Expense" }
          ]
        }
      ]);
    } else if (step === 3) {
      const payeeName = val.payee || "Unclassified Vendor";
      const finalCat = fuzzyFlow?.category || "Miscellaneous";
      const finalAmount = fuzzyFlow?.amount || 450.0;

      setMessages((prev) => [
        ...prev,
        {
          id: 'user-choice-3-' + Date.now(),
          sender: 'user',
          text: `Payee: ${payeeName}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      createVerificationCard({
        payee: payeeName,
        amount: finalAmount,
        category: finalCat,
        date: new Date().toISOString().split('T')[0],
        source: 'Guided Classification',
        notes: 'Categorized through guided questions',
        receiptName: null,
        confidence: 0.90
      });

      setFuzzyFlow(null);
    }
  };

  const createVerificationCard = (data) => {
    const cardId = 'verify-' + Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: cardId,
        sender: 'bot',
        type: 'verification-card',
        text: "Invoice OCR parsing complete! Please review the extracted data below. Click 'Confirm & Log to Dashboard' or type 'yes' to record it:",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        expenseData: {
          payee: data.payee || '',
          amount: parseFloat(data.amount) || 0,
          category: data.category || 'Miscellaneous',
          date: data.date || '',
          paymentMethod: data.paymentMethod || 'UPI / Card',
          source: data.source || 'OCR Receipt',
          notes: data.notes || '',
          receiptName: data.receiptName || null,
          invoiceNo: data.invoiceNo || null,
          tax: data.tax !== undefined ? data.tax : null,
          items: data.items || [],
          previewUrl: data.previewUrl || null,
          confidence: data.confidence ?? null
        },
        verified: false,
        editing: false
      }
    ]);
  };

  const handleSendMessage = async (textToSend = null) => {
    const rawText = textToSend !== null ? textToSend : inputVal;
    const clean = sanitizeText(rawText);
    if (!clean) return;

    const userMsgId = 'user-' + Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: clean,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setInputVal('');

    // Check if user says "yes" / "confirm" / "save" to accept pending verification card
    const lowerClean = clean.toLowerCase();
    const isAffirmative = /^(yes|yeah|yep|confirm|save|add it|looks good|proceed|ok|okay|sure|verified)$/i.test(lowerClean.trim());
    if (isAffirmative) {
      const pendingCard = [...messages].reverse().find((m) => m.type === 'verification-card' && !m.verified);
      if (pendingCard) {
        handleConfirmVerification(pendingCard.id, pendingCard.expenseData);
        return;
      }
    }

    // Explicit invoice intent without amounts
    if (clean.includes("📄 Enter / Upload Invoice") || (isInvoiceIntent(clean) && !clean.match(/\d+/))) {
      startInvoiceEntryFlow();
      return;
    }

    if (isVagueOrForgot(clean)) {
      startFuzzyFlow();
      return;
    }

    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      const extracted = parseNaturalLanguage(clean);
      createVerificationCard({
        payee: extracted.payee,
        amount: extracted.amount,
        category: extracted.category,
        date: extracted.date,
        source: 'Chatbot',
        notes: `Recorded via: "${clean}"`,
        confidence: 0.95
      });
    }, 500);
  };

  // Process Document (File object or preset details) with proper OCR
  const handleProcessDocument = async (fileOrName, fileType = 'IMAGE', sampleDetails = null) => {
    const isFileObj = fileOrName instanceof File;
    const fileName = isFileObj ? fileOrName.name : fileOrName;
    const uploadId = 'ocr-loading-' + Date.now();

    let previewUrl = null;
    if (isFileObj && fileOrName.type.startsWith('image/')) {
      previewUrl = URL.createObjectURL(fileOrName);
    }

    setMessages((prev) => [
      ...prev,
      {
        id: 'user-doc-' + Date.now(),
        sender: 'user',
        type: 'document-upload',
        text: `Uploaded invoice: ${fileName}`,
        fileName,
        fileType,
        previewUrl,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      {
        id: uploadId,
        sender: 'bot',
        type: 'ocr-progress',
        fileName,
        stepText: "Analyzing invoice layout via OCR engine... extracting Vendor, Total Amount (₹), Invoice #, Tax and Line Items...",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);

    setIsProcessing(true);

    try {
      let parsed;
      if (sampleDetails) {
        await new Promise((r) => setTimeout(r, 650));
        parsed = {
          fileName,
          fileType,
          extracted: sampleDetails
        };
      } else {
        // Send real file to backend OCR parser endpoint
        parsed = await api.parseDocument(fileOrName, fileType);
      }

      setIsProcessing(false);
      setMessages((prev) => prev.filter((m) => m.id !== uploadId));

      createVerificationCard({
        payee: parsed.extracted.payee,
        amount: parsed.extracted.amount,
        category: parsed.extracted.category,
        date: parsed.extracted.date,
        invoiceNo: parsed.extracted.invoiceNo,
        tax: parsed.extracted.tax,
        items: parsed.extracted.items,
        source: 'OCR Receipt',
        notes: `Extracted from ${fileName} (Inv: ${parsed.extracted.invoiceNo || 'N/A'})`,
        receiptName: fileName,
        previewUrl,
        fileType: fileType.toLowerCase(),
        ocrRegions: parsed.extracted.ocrRegions || [],
        confidence: parsed.extracted.confidence ?? null
      });
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      setMessages((prev) => prev.filter((m) => m.id !== uploadId));
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const ext = fileName.split('.').pop().toLowerCase();
    const typeLabel = ext === 'pdf' ? 'PDF' : ext === 'xml' ? 'XML' : 'IMAGE';

    handleProcessDocument(file, typeLabel);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setUploadDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const ext = fileName.split('.').pop().toLowerCase();
    const typeLabel = ext === 'pdf' ? 'PDF' : ext === 'xml' ? 'XML' : 'IMAGE';

    handleProcessDocument(file, typeLabel);
  };

  const handleConfirmVerification = async (msgId, expenseData, rethrowError = false) => {
    setIsProcessing(true);

    try {
      const res = await api.addExpense(expenseData);
      setIsProcessing(false);

      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, verified: true, savedRecord: res.data } : m))
      );

      if (onExpenseAdded && res.data) {
        onExpenseAdded(res.data);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: 'confirmed-' + Date.now(),
          sender: 'bot',
          type: 'confirmation-success',
          text: res.isLocal
            ? `Saved to this browser only as ${res.data?.id || 'TX-NEW'}. Start the backend to store it in PostgreSQL.`
            : `🎉 Verified & Saved! Recorded as ${res.data?.id || 'TX-NEW'} (${currency}${parseFloat(expenseData.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to ${expenseData.payee}). This transaction is now logged onto your Reports Dashboard.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          transactionId: res.data?.id
        }
      ]);
    } catch (error) {
      setIsProcessing(false);
      if (rethrowError) throw error;
      setMessages((prev) => [...prev, {
        id: 'save-error-' + Date.now(),
        sender: 'bot',
        type: 'error',
        text: error.message || 'Could not save this expense. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }
  };

  const handleUpdateCardField = (msgId, field, value) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        return {
          ...m,
          expenseData: {
            ...m.expenseData,
            [field]: field === 'amount' ? (value === '' ? '' : parseFloat(value) || 0) : value
          }
        };
      })
    );
  };

  const handleToggleCardEdit = (msgId) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, editing: !m.editing } : m))
    );
  };

  const resetChat = () => {
    setMessages([
      {
        id: 'msg-fresh',
        sender: 'bot',
        type: 'welcome',
        text: "Chat cleared! How can I help you today? You can enter an invoice for OCR parsing, or type an expense in Rupees.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hints: [
          "📄 Enter / Upload Invoice",
          "☕ Starbucks Cafe Bill (₹380)",
          "☁️ AWS Cloud Invoice (₹4,850)",
          "🚕 Uber Commute Slip (₹420)",
          "💬 Spent ₹350 on lunch"
        ]
      }
    ]);
  };

  return (
    <div
      ref={chatRootRef}
      className={`chatbot-container ${isEmbedded ? 'embedded' : 'floating'} ${isFullscreen ? 'fullscreen' : ''}`}
    >
      {/* Chatbot Top Bar */}
      <div className="chatbot-header">
        <div className="bot-profile">
          <div className="bot-avatar">
            <BotIcon size={18} />
          </div>
          <div>
            <div className="bot-name">
              FinEase AI Assistant
              <span className="ocr-badge">● Online • OCR Ready</span>
            </div>
            <div className="bot-status-sub">
              Conversational Accounting & Invoice OCR Scanner
            </div>
          </div>
        </div>

        <div className="chatbot-header-actions">
          <button
            type="button"
            className="btn-header-action"
            title="Reset conversation"
            onClick={resetChat}
          >
            <RefreshIcon size={14} />
            <span className="action-text">Reset</span>
          </button>

          <button
            type="button"
            className="btn-header-action"
            title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter full screen mode'}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <MinimizeIcon size={14} /> : <ExpandIcon size={14} />}
            <span className="action-text">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>

          {onClose && (
            <button
              type="button"
              className="btn-header-action btn-header-close"
              title="Close / Minimize chat window"
              onClick={onClose}
            >
              <CloseIcon size={16} />
              <span className="action-text">Close</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Action Strip */}
      <div className="sample-presets-bar">
        <span className="presets-label">Quick Actions:</span>
        <div className="presets-scroll">
          <button
            type="button"
            className="preset-chip chip-highlight"
            onClick={startInvoiceEntryFlow}
          >
            📄 Enter / Upload Invoice
          </button>

          {SAMPLE_INVOICES.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              className="preset-chip"
              onClick={() => handleProcessDocument(sample.name, sample.type, sample.details)}
              title={sample.desc}
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Stream */}
      <div
        ref={messagesContainerRef}
        className={`chatbot-messages ${uploadDragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setUploadDragOver(true);
        }}
        onDragLeave={() => setUploadDragOver(false)}
        onDrop={handleDrop}
      >
        {uploadDragOver && (
          <div className="drag-drop-overlay">
            <UploadCloudIcon size={40} />
            <p>Drop PDF, JPEG, PNG, or XML invoice here to parse with OCR!</p>
          </div>
        )}

        {messages.map((msg) => {
          const isBot = msg.sender === 'bot';

          return (
            <div
              key={msg.id}
              className={`message-wrapper ${isBot ? 'bot-wrapper' : 'user-wrapper'}`}
            >
              {isBot && (
                <div className="message-avatar">
                  <BotIcon size={15} />
                </div>
              )}

              <div className="message-bubble-group">
                {msg.text && (
                  <div className={`message-bubble ${isBot ? 'bot-bubble' : 'user-bubble'}`}>
                    <p className="bubble-text">{msg.text}</p>
                    <span className="bubble-time">{msg.timestamp}</span>
                  </div>
                )}

                {/* Welcome hints / suggestions */}
                {msg.type === 'welcome' && msg.hints && (
                  <div className="welcome-hints-wrap">
                    <span className="hints-title">Suggested flows to try:</span>
                    <div className="hints-grid">
                      {msg.hints.map((hint, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`hint-btn ${hint.includes("Enter / Upload") ? "hint-btn-primary" : ""}`}
                          onClick={() => handleSendMessage(hint)}
                        >
                          {hint}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Specific Guided Invoice Entry Prompt Card */}
                {msg.type === 'invoice-entry-prompt' && (
                  <div className="invoice-entry-card">
                    <div className="invoice-entry-header">
                      <div className="entry-icon-wrap">
                        <UploadCloudIcon size={20} />
                      </div>
                      <div>
                        <h4 className="entry-card-title">Document & Invoice OCR Ingestion</h4>
                        <p className="entry-card-desc">Supported formats: PDF, PNG, JPG, XML</p>
                      </div>
                    </div>

                    <div 
                      className="invoice-dropzone-box"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloudIcon size={28} className="dropzone-icon" />
                      <div className="dropzone-text">
                        <strong>Click to select invoice file</strong> or drag & drop here
                      </div>
                      <span className="dropzone-sub">Extracts Vendor, Date, ₹ Amount, Tax & Line Items</span>
                    </div>

                    <div className="sample-invoices-section">
                      <span className="samples-heading">Or select an instant sample invoice to test:</span>
                      <div className="samples-grid">
                        {SAMPLE_INVOICES.map((sample, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            className="sample-invoice-card-btn"
                            onClick={() => handleProcessDocument(sample.name, sample.type, sample.details)}
                          >
                            <div className="sample-btn-top">
                              <span className="sample-btn-label">{sample.label}</span>
                              <span className="sample-btn-type">{sample.type}</span>
                            </div>
                            <span className="sample-btn-desc">{sample.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* OCR scanning state with visual progress */}
                {msg.type === 'ocr-progress' && (
                  <div className="ocr-scanning-card">
                    <div className="ocr-pulse-spinner"></div>
                    <div className="ocr-card-details">
                      <div className="ocr-file-name">
                        <ReceiptIcon size={16} />
                        <span>{msg.fileName}</span>
                      </div>
                      <div className="ocr-status-text">{msg.stepText}</div>
                      <div className="ocr-steps-mini">
                        <span className="step-tag active">Reading Layout</span>
                        <span className="step-tag active">Extracting Fields</span>
                        <span className="step-tag">Calculating Tax</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Document uploaded confirmation badge */}
                {msg.type === 'document-upload' && (
                  <div className="doc-attachment-badge">
                    <ReceiptIcon size={16} />
                    <span className="doc-name">{msg.fileName}</span>
                    <span className="doc-type-pill">{msg.fileType}</span>
                  </div>
                )}

                {/* Guided classification choices */}
                {msg.type?.startsWith('fuzzy-step') && msg.options && (
                  <div className="fuzzy-options-list">
                    {msg.options.map((opt, i) => (
                      <button
                        key={i}
                        type="button"
                        className="fuzzy-pill-btn"
                        onClick={() => {
                          if (msg.type === 'fuzzy-step-1') handleFuzzyChoice(opt.val, 1);
                          else if (msg.type === 'fuzzy-step-2') handleFuzzyChoice(opt.val, 2);
                          else if (msg.type === 'fuzzy-step-3') handleFuzzyChoice(opt, 3);
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Verification Card with Detailed OCR Parsed Data */}
                {msg.type === 'verification-card' && (
                  <div className={`verification-card ${msg.verified ? 'card-verified' : ''}`}>
                    <div className="card-top-header">
                      <div>
                        <span className="card-badge-title">OCR Extracted Invoice</span>
                        {msg.expenseData.invoiceNo && (
                          <span className="card-inv-no"> #{msg.expenseData.invoiceNo}</span>
                        )}
                      </div>
                      <span className="confidence-tag">
                        {msg.expenseData.confidence !== null && msg.expenseData.confidence !== undefined && Number.isFinite(Number(msg.expenseData.confidence))
                          ? `${Math.round(Number(msg.expenseData.confidence) * 100)}% OCR confidence`
                          : 'Confidence unavailable'}
                      </span>
                    </div>

                    {/* Receipt Image Thumbnail preview if available */}
                    {msg.expenseData.previewUrl && (
                      <div className="card-preview-thumb">
                        <img
                          src={msg.expenseData.previewUrl}
                          alt="Uploaded receipt"
                          className="receipt-thumb-img"
                        />
                      </div>
                    )}

                    <div className="card-form-body">
                      {/* Payee / Vendor */}
                      <div className="card-field">
                        <label className="card-field-label">Vendor / Payee</label>
                        {msg.editing && !msg.verified ? (
                          <input
                            type="text"
                            className="card-field-input"
                            value={msg.expenseData.payee}
                            onChange={(e) =>
                              handleUpdateCardField(msg.id, 'payee', e.target.value)
                            }
                          />
                        ) : (
                          <div className="card-field-val strong">{msg.expenseData.payee}</div>
                        )}
                      </div>

                      {/* Total Amount in Rupees */}
                      <div className="card-field">
                        <label className="card-field-label">Total Amount ({currency})</label>
                        {msg.editing && !msg.verified ? (
                          <div className="input-currency-wrapper">
                            <span className="prefix-currency">{currency}</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              className="card-field-input pl-curr"
                              value={msg.expenseData.amount}
                              onChange={(e) =>
                                handleUpdateCardField(msg.id, 'amount', e.target.value)
                              }
                            />
                          </div>
                        ) : (
                          <div className="card-field-val amount-highlight">
                            {currency}{parseFloat(msg.expenseData.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>

                      {/* Category */}
                      <div className="card-field">
                        <label className="card-field-label">Category</label>
                        {msg.editing && !msg.verified ? (
                          <select
                            className="card-field-select"
                            value={msg.expenseData.category}
                            onChange={(e) =>
                              handleUpdateCardField(msg.id, 'category', e.target.value)
                            }
                          >
                            {CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="card-category-badge">
                            {msg.expenseData.category}
                          </span>
                        )}
                      </div>

                      {/* Date */}
                      <div className="card-field">
                        <label className="card-field-label">Invoice Date</label>
                        {msg.editing && !msg.verified ? (
                          <input
                            type="date"
                            className="card-field-input"
                            value={msg.expenseData.date}
                            onChange={(e) =>
                              handleUpdateCardField(msg.id, 'date', e.target.value)
                            }
                          />
                        ) : (
                          <div className="card-field-val">{msg.expenseData.date}</div>
                        )}
                      </div>

                      {/* Tax / GST if detected */}
                      {msg.expenseData.tax !== null && msg.expenseData.tax !== undefined && (
                        <div className="card-field">
                          <label className="card-field-label">Tax / GST Included</label>
                          <div className="card-field-val text-sm">
                            {currency}{parseFloat(msg.expenseData.tax).toFixed(2)}
                          </div>
                        </div>
                      )}

                      {/* Detected Line Items */}
                      {msg.expenseData.items && msg.expenseData.items.length > 0 && (
                        <div className="card-items-wrap">
                          <label className="card-field-label">Extracted Line Items</label>
                          <ul className="card-items-list">
                            {msg.expenseData.items.map((it, i) => (
                              <li key={i} className="card-item-entry">• {it}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Source receipt file */}
                      {msg.expenseData.receiptName && (
                        <div className="card-receipt-tag">
                          <ReceiptIcon size={12} />
                          <span>File: {msg.expenseData.receiptName}</span>
                        </div>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="card-footer-actions">
                      {!msg.verified ? (
                        <>
                          <button
                            type="button"
                            className="btn-card-edit"
                            style={{
                              background: '#EFF6FF',
                              color: '#1D4ED8',
                              border: '1px solid #BFDBFE',
                              fontWeight: '600'
                            }}
                            onClick={() => {
                              setSideBySideDoc(msg.expenseData);
                              setSideBySideMsgId(msg.id);
                            }}
                            title="Open interactive side-by-side receipt matcher"
                          >
                            <ReceiptIcon size={14} />
                            <span>Side-by-Side Split View</span>
                          </button>

                          <button
                            type="button"
                            className="btn-card-edit"
                            onClick={() => handleToggleCardEdit(msg.id)}
                          >
                            {msg.editing ? "Done" : "✏️ Edit Details"}
                          </button>

                          <button
                            type="button"
                            className="btn-card-confirm"
                            disabled={isProcessing || !String(msg.expenseData.payee || '').trim() || Number(msg.expenseData.amount) <= 0 || !msg.expenseData.date}
                            onClick={() =>
                              handleConfirmVerification(msg.id, msg.expenseData)
                            }
                          >
                            <CheckCircleIcon size={15} />
                            <span>Confirm & Log to Dashboard</span>
                          </button>
                        </>
                      ) : (
                        <div className="verified-success-pill">
                          <CheckCircleIcon size={15} />
                          <span>Verified & Logged to Dashboard</span>
                        </div>
                      )}
                    </div>

                    {!msg.verified && (
                      <div className="card-confirm-hint">
                        💡 Tip: Click <strong>"Confirm & Log to Dashboard"</strong> or type <strong>"yes"</strong> to record this invoice.
                      </div>
                    )}
                  </div>
                )}

                {/* Confirmation banner */}
                {msg.type === 'confirmation-success' && (
                  <div className="confirmation-banner">
                    <p>{msg.text}</p>
                    <button
                      type="button"
                      className="btn-view-reports"
                      onClick={() => onNavigateToReports?.()}
                    >
                      <span>📊 View in Reports Dashboard</span>
                      <ArrowRightIcon size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isProcessing && (
          <div className="message-wrapper bot-wrapper">
            <div className="message-avatar">
              <BotIcon size={15} />
            </div>
            <div className="bot-bubble typing-bubble">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input container */}
      <div className="chatbot-input-container">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInput}
          accept=".pdf,.jpg,.jpeg,.png,.xml,image/jpeg,image/png,application/pdf,text/xml,application/xml"
          style={{ display: 'none' }}
        />

        <div className="input-row">
          <button
            type="button"
            className="btn-upload-receipt"
            title="Upload Invoice document (PDF, JPG, PNG, XML)"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloudIcon size={16} />
            <span>Upload Invoice</span>
          </button>

          <input
            type="text"
            className="chat-text-input"
            placeholder="Type: 'Upload invoice', 'Spent ₹350 on lunch'..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />

          <button
            type="button"
            className="btn-send-message"
            disabled={!inputVal.trim() || isProcessing}
            onClick={() => handleSendMessage()}
            title="Send expense or command"
          >
            <SendIcon size={16} />
          </button>
        </div>

        <div className="input-footer-note">
          Supports PDF, Images & XML • OCR Parser in Rupees (₹) • User verification check
        </div>
      </div>

      {sideBySideDoc && (
        <ScanVerifyModal
          isOpen={Boolean(sideBySideDoc)}
          onClose={() => {
            setSideBySideDoc(null);
            setSideBySideMsgId(null);
          }}
          onSaveExpense={async (savedExp) => {
            if (sideBySideMsgId) {
              await handleConfirmVerification(sideBySideMsgId, savedExp, true);
            } else if (onExpenseAdded) {
              const result = await api.addExpense(savedExp);
              if (!result.success) throw new Error(result.message || 'Could not save this expense.');
              await onExpenseAdded(result.data);
            }
            setSideBySideDoc(null);
            setSideBySideMsgId(null);
          }}
          currency={currency}
          initialDoc={sideBySideDoc}
        />
      )}
    </div>
  );
}
