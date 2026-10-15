import { useState, useMemo, useEffect } from 'react';
import { api } from '../services/api';
import { 
  CloseIcon, 
  CheckCircleIcon, 
  ReceiptIcon, 
  AlertCircleIcon, 
  UploadCloudIcon 
} from './Icons';

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

const PRESET_DOCUMENTS = [
  {
    id: "doc-starbucks",
    name: "starbucks_bill.jpg",
    payee: "Starbucks Coffee Co.",
    amount: 380.00,
    category: "Dining",
    date: new Date().toISOString().split('T')[0],
    invoiceNo: "SBX-2026-9912",
    tax: 19.00,
    items: ["Cappuccino Grande (₹280.00)", "Warm Butter Croissant (₹100.00)"],
    confidence: 0.99
  },
  {
    id: "doc-aws",
    name: "aws_cloud_invoice.pdf",
    payee: "Amazon AWS Cloud Services",
    amount: 4850.00,
    category: "Software & SaaS",
    date: new Date().toISOString().split('T')[0],
    invoiceNo: "AWS-INV-88340",
    tax: 739.80,
    items: ["Amazon Elastic Compute Cloud (EC2)", "Amazon Simple Storage Service (S3)"],
    confidence: 0.98
  },
  {
    id: "doc-uber",
    name: "uber_commute_slip.png",
    payee: "Uber Technologies",
    amount: 420.00,
    category: "Travel & Commute",
    date: new Date().toISOString().split('T')[0],
    invoiceNo: "UBER-TRIP-7718",
    tax: 21.00,
    items: ["Uber Go City Commute - MG Road to Indiranagar"],
    confidence: 0.98
  }
];

export default function ScanVerifyModal({
  isOpen,
  onClose,
  onSaveExpense,
  existingExpenses = [],
  currency = '₹',
  initialDoc = null
}) {
  const [selectedDoc, setSelectedDoc] = useState(initialDoc || PRESET_DOCUMENTS[0]);
  const [formData, setFormData] = useState({
    payee: (initialDoc || PRESET_DOCUMENTS[0]).payee,
    amount: (initialDoc || PRESET_DOCUMENTS[0]).amount,
    category: (initialDoc || PRESET_DOCUMENTS[0]).category,
    date: (initialDoc || PRESET_DOCUMENTS[0]).date,
    invoiceNo: (initialDoc || PRESET_DOCUMENTS[0]).invoiceNo,
    tax: (initialDoc || PRESET_DOCUMENTS[0]).tax,
    items: (initialDoc || PRESET_DOCUMENTS[0]).items || []
  });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scanError, setScanError] = useState('');
  const [xmlPreview, setXmlPreview] = useState('');
  const [activeField, setActiveField] = useState('payee');

  useEffect(() => {
    if (!selectedDoc.previewOwned || !selectedDoc.previewUrl) return undefined;
    return () => URL.revokeObjectURL(selectedDoc.previewUrl);
  }, [selectedDoc.previewOwned, selectedDoc.previewUrl]);

  // Check for potential duplicate in existing expenses
  const duplicateAlert = useMemo(() => {
    if (!existingExpenses || existingExpenses.length === 0) return null;
    const match = existingExpenses.find((exp) => {
      const existingPayee = String(exp.payee || '').toLowerCase().trim();
      const currentPayee = String(formData.payee || '').toLowerCase().trim();
      const samePayee = existingPayee && currentPayee && (
        existingPayee === currentPayee ||
        (Math.min(existingPayee.length, currentPayee.length) >= 4 &&
          (existingPayee.includes(currentPayee) || currentPayee.includes(existingPayee)))
      );
      const sameAmount = Math.abs((parseFloat(exp.amount) || 0) - (parseFloat(formData.amount) || 0)) < 1;
      return samePayee && sameAmount;
    });
    return match || null;
  }, [existingExpenses, formData.payee, formData.amount]);

  const documentType = selectedDoc.fileType || selectedDoc.name?.split('.').pop()?.toLowerCase();

  if (!isOpen) return null;

  const handleSelectPreset = (doc) => {
    setSelectedDoc(doc);
    setFormData({
      payee: doc.payee,
      amount: doc.amount,
      category: doc.category,
      date: doc.date,
      invoiceNo: doc.invoiceNo,
      tax: doc.tax,
      items: doc.items || []
    });
    setXmlPreview('');
    setScanError('');
    setActiveField('payee');
    setSavedSuccess(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    e.target.value = '';
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'png', 'jpg', 'jpeg', 'xml', 'webp', 'bmp', 'tiff'].includes(extension)) {
      setScanError('Choose a PDF, image, or XML invoice.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setScanError('This file is larger than the 10 MB upload limit.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setSelectedDoc({ id: `doc-${Date.now()}`, name: file.name, previewUrl, previewOwned: true, fileType: extension });
    setScanError('');
    setXmlPreview('');
    setIsScanning(true);
    try {
      if (extension === 'xml') setXmlPreview(await file.text());
      const parsed = await api.parseUploadedDocument(file);
      const extracted = parsed.extracted;
      const category = CATEGORIES.includes(extracted.category) ? extracted.category : 'Miscellaneous';
      setSelectedDoc((current) => ({
        ...current,
        ...extracted,
        name: parsed.fileName || file.name,
        fileType: extension,
        previewUrl,
        previewOwned: true
      }));
      setFormData({
        payee: extracted.payee || '',
        amount: extracted.amount || '',
        category,
        date: extracted.date || '',
        invoiceNo: extracted.invoiceNo || '',
        tax: extracted.tax || '',
        items: extracted.items || []
      });
      setActiveField('payee');
      setSavedSuccess(false);
    } catch (error) {
      setScanError(error.message || 'Could not scan the document. Check that the OCR service is running.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSave = async () => {
    if (!formData.payee.trim() || !Number.isFinite(Number(formData.amount)) || Number(formData.amount) <= 0 || !formData.date) {
      setScanError('Confirm a payee, positive amount, and transaction date before saving.');
      return;
    }
    const newExpense = {
      id: `EXP-${Date.now().toString().slice(-4)}`,
      payee: formData.payee || "Vendor",
      amount: parseFloat(formData.amount) || 0,
      category: formData.category || "Miscellaneous",
      date: formData.date,
      source: "OCR Receipt",
      invoiceNo: formData.invoiceNo || null,
      tax: formData.tax ? parseFloat(formData.tax) : null,
      notes: `Verified side-by-side OCR invoice (${selectedDoc.name || 'document'})`,
      items: formData.items || [],
      verified: true,
      receiptName: selectedDoc.name || null
    };

    setIsSaving(true);
    setScanError('');
    try {
      if (onSaveExpense) {
        const result = await onSaveExpense(newExpense);
        if (result?.success === false) throw new Error(result.message || 'Could not save this expense.');
      }
      setSavedSuccess(true);
      setTimeout(() => onClose(), 1200);
    } catch (error) {
      setScanError(error.message || 'Could not save this expense. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="scan-verify-overlay fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="scan-verify-dialog relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-blue-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Top Bar - Clean Blue Theme */}
        <div className="scan-verify-header px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-300">
              <ReceiptIcon size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Side-by-Side Scan & Verify
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/20">
                  Zero-Friction Matcher
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Inspect original receipt on the left, confirm extracted plain fields on the right
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Quick Sample Selector Strip */}
        <div className="scan-verify-presets px-6 py-2.5 bg-blue-50 border-b border-blue-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-blue-900">Switch Sample Bill:</span>
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_DOCUMENTS.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  disabled={isScanning}
                  onClick={() => handleSelectPreset(doc)}
                  className={`scan-sample-button ${selectedDoc.name === doc.name ? 'is-selected' : ''}`}
                >
                  {doc.payee.split(' ')[0]} ({currency}{doc.amount})
                </button>
              ))}
            </div>
          </div>

          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold text-blue-700 bg-white hover:bg-blue-100 border border-blue-200 shadow-xs transition-colors">
            <UploadCloudIcon size={14} />
            <span>Upload Another File</span>
            <input 
              type="file" 
              className="hidden" 
              disabled={isScanning}
              accept=".pdf,.png,.jpg,.jpeg,.xml,.webp,.bmp,.tiff" 
              onChange={handleFileUpload}
            />
          </label>
        </div>

        {/* Modal Main Body: 2 Columns Split View */}
        <div className="scan-verify-body flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50">
          
          {/* Left Column: Visual Document Inspector with Highlight Bounding Boxes (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
              <span className="flex items-center gap-1.5 font-bold text-slate-800">
                <ReceiptIcon size={14} className="text-blue-600" />
                Original Document Preview
              </span>
              <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                {selectedDoc.previewUrl && documentType !== 'pdf' && documentType !== 'xml'
                  ? selectedDoc.confidence !== null && selectedDoc.confidence !== undefined && Number.isFinite(Number(selectedDoc.confidence))
                    ? `${Math.round(Number(selectedDoc.confidence) * 100)}% OCR confidence`
                    : 'Confidence unavailable'
                  : selectedDoc.previewUrl ? 'Document loaded' : 'Sample data'}
              </span>
            </div>

            {selectedDoc.previewUrl ? (
              documentType === 'pdf' ? (
                <iframe className="scan-document-pdf" src={selectedDoc.previewUrl} title={`Preview of ${selectedDoc.name}`} />
              ) : documentType === 'xml' ? (
                <pre className="scan-document-xml">{xmlPreview || 'XML document loaded'}</pre>
              ) : (
                <div className="scan-document-image-wrap">
                  <img className="scan-document-image" src={selectedDoc.previewUrl} alt={`Uploaded receipt ${selectedDoc.name}`} />
                  {selectedDoc.ocrRegions?.map((region) => (
                    <button
                      key={region.field}
                      type="button"
                      className={`scan-ocr-region ${activeField === region.field ? 'is-active' : ''}`}
                      style={{
                        left: `${region.bounds.x}%`,
                        top: `${region.bounds.y}%`,
                        width: `${region.bounds.width}%`,
                        height: `${region.bounds.height}%`
                      }}
                      onClick={() => setActiveField(region.field)}
                      aria-label={`Highlight OCR result for ${region.label}`}
                      title={`${region.label}: ${formData[region.field]}`}
                    />
                  ))}
                </div>
              )
            ) : (
            <div className="scan-sample-receipt relative bg-white border border-slate-300 rounded-xl p-5 shadow-xs font-mono text-xs text-slate-700 space-y-4">
              <div className="scan-sample-receipt-header text-center pb-3 border-b border-dashed border-slate-300">
                <div className="text-xs uppercase text-slate-400 font-sans font-semibold tracking-wider">
                  Tax Invoice / Thermal Receipt
                </div>
                {/* Highlight Box #1: Vendor */}
                <div className="scan-sample-receipt-vendor mt-2 inline-block p-1.5 rounded bg-blue-50 border border-blue-400 ring-2 ring-blue-500/20 text-blue-900 font-bold text-sm">
                  {formData.payee}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Official Tax GSTIN: 29AABCS1429B1Z2</div>
              </div>

              {/* Highlight Box #2: Invoice No & Date */}
              <div className="scan-sample-receipt-meta flex items-center justify-between text-xs p-1.5 rounded bg-indigo-50/70 border border-indigo-300">
                <span>Inv: #{formData.invoiceNo || 'INV-2026-01'}</span>
                <span>Date: {formData.date}</span>
              </div>

              {/* Itemized lines */}
              <div className="scan-sample-receipt-items space-y-1.5 py-1 border-t border-b border-dashed border-slate-200 font-sans text-xs">
                {formData.items && formData.items.length > 0 ? (
                  formData.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-slate-600">
                      <span>• {it}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between text-slate-600">
                    <span>• General Business Expenditure</span>
                    <span>{currency}{parseFloat(formData.amount || 0).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Highlight Box #3: Taxes & Total */}
              <div className="scan-sample-receipt-totals space-y-1 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>CGST + SGST (Included):</span>
                  <span>{currency}{parseFloat(formData.tax || 0).toFixed(2)}</span>
                </div>
                <div className="scan-sample-receipt-total flex justify-between items-center p-2 rounded bg-emerald-50 border border-emerald-400 ring-2 ring-emerald-500/20 text-emerald-900 font-bold text-base font-sans">
                  <span>TOTAL AMOUNT:</span>
                  <span>{currency}{parseFloat(formData.amount || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="scan-sample-receipt-footer text-center text-[10px] text-slate-400 pt-2 border-t border-dashed border-slate-200">
                {selectedDoc.previewUrl ? `Document: ${selectedDoc.name} • OCR extracted` : `Sample document: ${selectedDoc.name}`}
              </div>
            </div>
            )}

            {selectedDoc.ocrRegions?.length > 0 && (
              <div className="scan-region-legend" aria-label="OCR fields found in document">
                {selectedDoc.ocrRegions.map((region) => (
                  <button
                    key={region.field}
                    type="button"
                    className={activeField === region.field ? 'is-active' : ''}
                    onClick={() => setActiveField(region.field)}
                  >
                    <span>{region.label}</span>
                    <strong>{formData[region.field] || 'Not found'}</strong>
                  </button>
                ))}
              </div>
            )}

            {isScanning && <p className="scan-status" role="status">Reading document and locating the extracted fields…</p>}
            {scanError && <p className="scan-error" role="alert">{scanError}</p>}

            <div className="scan-inspector-hint">
              {selectedDoc.previewUrl && documentType === 'pdf'
                ? 'PDF preview shown as provided. Check each extracted value in the fields on the right.'
                : selectedDoc.previewUrl && documentType === 'xml'
                  ? 'Structured invoice source shown as provided. Check each extracted value in the fields on the right.'
                  : selectedDoc.previewUrl && !selectedDoc.ocrRegions?.length
                    ? 'OCR text locations were unavailable for this file. Check the extracted values on the right.'
                    : selectedDoc.previewUrl
                      ? 'Select a blue outline to focus its matching field.'
                      : 'Sample layout for demonstration. Upload a receipt to inspect its original document.'}
            </div>
          </div>

          {/* Right Column: Layman 4-Field Form with Duplicate Alert (7 cols) */}
          <div className="scan-verify-fields lg:col-span-7 flex flex-col justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Extracted Plain Information</h4>
                  <p className="text-xs text-slate-500">Verify or adjust any field before confirming</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Step 2 of 2
                </span>
              </div>

              {/* Duplicate Detection Warning Banner */}
              {duplicateAlert && (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertCircleIcon size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold">Notice: Possible duplicate entry found!</strong>
                    <p className="mt-0.5 text-amber-800">
                      You already have a verified record for <strong>"{duplicateAlert.payee}"</strong> ({currency}{duplicateAlert.amount}) recorded on {duplicateAlert.date}. If this is a recurring charge, feel free to proceed.
                    </p>
                  </div>
                </div>
              )}

              {/* The 4 Plain Fields */}
              <div className="space-y-3.5">
                {/* Field 1: Vendor */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    1. Who was paid? (Vendor / Payee)
                  </label>
                  <input
                    type="text"
                    value={formData.payee}
                    onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
                    className={`scan-field-input w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white font-medium text-slate-900 ${activeField === 'payee' ? 'is-active' : ''}`}
                    onFocus={() => setActiveField('payee')}
                    placeholder="e.g. Starbucks, Uber, AWS"
                  />
                </div>

                {/* Field 2: Total Amount */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    2. How much was paid? (Total in Indian Rupees)
                  </label>
                  <div className="scan-amount-input relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center font-bold text-slate-500">
                      {currency}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      min="0.01"
                      className={`scan-field-input w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white font-bold text-blue-900 ${activeField === 'amount' ? 'is-active' : ''}`}
                      onFocus={() => setActiveField('amount')}
                    />
                  </div>
                </div>

                {/* Field 3: Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    3. Transaction Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className={`scan-field-input w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white text-slate-800 ${activeField === 'date' ? 'is-active' : ''}`}
                    onFocus={() => setActiveField('date')}
                  />
                </div>

                {/* Field 4: Category */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    4. What kind of expense is this? (Category)
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className={`scan-field-input w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white text-slate-800 font-medium ${activeField === 'category' ? 'is-active' : ''}`}
                    onFocus={() => setActiveField('category')}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="scan-cancel-button px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={savedSuccess || isSaving || isScanning || !formData.payee.trim() || Number(formData.amount) <= 0 || !formData.date}
                className={`scan-save-button inline-flex items-center gap-2 ${savedSuccess ? 'is-saved' : ''}`}
              >
                <CheckCircleIcon size={16} />
                <span>
                  {savedSuccess
                    ? 'Saved Successfully to Records!'
                    : isSaving ? 'Saving expense…' : 'Looks Good — Save to Records (1-Click)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
