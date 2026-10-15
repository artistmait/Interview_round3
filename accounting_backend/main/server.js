require('dotenv').config();
const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFile } = require('child_process');
const multer = require('multer');
const crypto = require('crypto');

const TESSERACT_PATH = process.env.TESSERACT_PATH || 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';

let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.log('pdf-parse module load notice:', e.message);
}

const { initDb, Expense, Category, InvoiceDocument, SharedStatement } = require('../models');

const app = express();
const PORT = process.env.PORT || 5001;
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const ALLOWED_RECEIPT_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.xml', '.webp', '.bmp', '.tiff']);

// Bound upload memory use and reject unsupported filename types before parsing.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECEIPT_BYTES, files: 1, fields: 8, parts: 10 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_RECEIPT_EXTENSIONS.has(extension)) {
      return callback(new Error('Choose a PDF, image, or XML invoice.'));
    }
    callback(null, true);
  }
});

// Middlewares
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true, parameterLimit: 100 }));

const allowedOrigins = new Set((process.env.CORS_ORIGINS || [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
].join(',')).split(',').map((origin) => origin.trim()).filter(Boolean));

app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ success: false, message: 'Origin is not allowed.' });
  }
  if (origin) {
    res.set('Access-Control-Allow-Origin', origin);
    res.vary('Origin');
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const receiptRequestsByIp = new Map();
let activeReceiptRequests = 0;
function protectReceiptParser(req, res, next) {
  const now = Date.now();
  const ip = req.socket.remoteAddress || 'unknown';
  const recent = (receiptRequestsByIp.get(ip) || []).filter((timestamp) => now - timestamp < 10 * 60 * 1000);
  if (recent.length >= 10) {
    receiptRequestsByIp.set(ip, recent);
    return res.status(429).json({ success: false, message: 'Too many receipt uploads. Please try again in a few minutes.' });
  }
  if (activeReceiptRequests >= 2) {
    return res.status(503).json({ success: false, message: 'Receipt processing is busy. Please try again shortly.' });
  }
  recent.push(now);
  receiptRequestsByIp.set(ip, recent);
  if (receiptRequestsByIp.size > 500) {
    for (const [key, timestamps] of receiptRequestsByIp) {
      if (!timestamps.length || now - timestamps[timestamps.length - 1] >= 10 * 60 * 1000) receiptRequestsByIp.delete(key);
    }
  }
  activeReceiptRequests += 1;
  let released = false;
  const releaseSlot = () => {
    if (released) return;
    released = true;
    activeReceiptRequests = Math.max(0, activeReceiptRequests - 1);
  };
  res.once('finish', releaseSlot);
  res.once('close', releaseSlot);
  next();
}

function hashShareToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function sanitizeSharedExpense(expense) {
  if (!expense || typeof expense !== 'object' || Array.isArray(expense)) return null;
  const amount = Number(expense.amount);
  const date = String(expense.date || '').slice(0, 10);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99 || !isValidDateOnly(date)) return null;
  return {
    date,
    payee: String(expense.payee || 'Unknown merchant').slice(0, 120),
    category: String(expense.category || 'Uncategorized').slice(0, 80),
    amount
  };
}

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateExpensePayload(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Expected a JSON object.';
  const present = (field) => Object.prototype.hasOwnProperty.call(body, field);
  const fields = {
    payee: body.payee,
    category: body.category,
    date: body.date,
    amount: body.amount,
    tax: body.tax,
    confidence: body.confidence
  };
  if (!partial && (!present('payee') || !present('category') || !present('amount') || !present('date'))) {
    return 'Payee, amount, category, and date are required.';
  }
  if ((!partial || present('payee')) && (typeof fields.payee !== 'string' || !fields.payee.trim() || fields.payee.length > 255)) return 'Payee must be 1–255 characters.';
  if ((!partial || present('category')) && (typeof fields.category !== 'string' || !fields.category.trim() || fields.category.length > 100)) return 'Category must be 1–100 characters.';
  if (present('date') && !isValidDateOnly(fields.date)) return 'Date must be a valid YYYY-MM-DD date.';
  if ((!partial || present('amount')) && (!Number.isFinite(Number(fields.amount)) || Number(fields.amount) <= 0 || Number(fields.amount) > 9999999999.99)) return 'Amount must be greater than zero and within the supported range.';
  if (present('tax') && fields.tax !== null && fields.tax !== '' && (!Number.isFinite(Number(fields.tax)) || Number(fields.tax) < 0 || Number(fields.tax) > 9999999999.99)) return 'Tax must be a non-negative amount.';
  if (present('confidence') && fields.confidence !== null && fields.confidence !== '' && (!Number.isFinite(Number(fields.confidence)) || Number(fields.confidence) < 0 || Number(fields.confidence) > 1)) return 'Confidence must be between 0 and 1.';
  if (present('verified') && typeof body.verified !== 'boolean') return 'Verified must be true or false.';
  const maxLengths = { paymentMethod: 100, payment_method: 100, source: 50, invoiceNo: 100, invoice_no: 100, receiptName: 255, receipt_name: 255 };
  for (const [field, maxLength] of Object.entries(maxLengths)) {
    if (present(field) && body[field] !== null && (typeof body[field] !== 'string' || body[field].length > maxLength)) return `${field} must be a string of at most ${maxLength} characters.`;
  }
  for (const field of ['notes', 'previewUrl', 'preview_url']) {
    if (present(field) && body[field] !== null && (typeof body[field] !== 'string' || body[field].length > 4000)) return `${field} must be a string of at most 4000 characters.`;
  }
  if (present('items') && (!Array.isArray(body.items) || body.items.length > 100 || body.items.some((item) => typeof item !== 'string' || item.length > 500))) return 'Items must be an array of up to 100 strings, each at most 500 characters.';
  if (present('id') && (typeof body.id !== 'string' || !body.id.trim() || body.id.length > 50)) return 'ID must be a non-empty string of at most 50 characters.';
  return null;
}

function hasValidReceiptSignature(extension, buffer) {
  if (!buffer || buffer.length === 0) return false;
  if (extension === '.pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (extension === '.xml') return /^\uFEFF?\s*</.test(buffer.toString('utf8', 0, Math.min(buffer.length, 512)));
  if (extension === '.jpg' || extension === '.jpeg') return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  if (extension === '.png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
  if (extension === '.webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (extension === '.bmp') return buffer.subarray(0, 2).toString('ascii') === 'BM';
  if (extension === '.tiff') return buffer.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2A, 0x00])) || buffer.subarray(0, 4).equals(Buffer.from([0x4D, 0x4D, 0x00, 0x2A]));
  return false;
}

// OCR Helper to execute Tesseract CLI
function cleanOcrText(txt) {
  return (txt || '')
    .replace(/[‘’‛`]/g, '')
    .replace(/[—–]/g, '-')
    .replace(/\r\n/g, '\n');
}

function runTesseract(filePath, psm = '6') {
  return new Promise((resolve) => {
    execFile(
      TESSERACT_PATH,
      [filePath, 'stdout', '--psm', psm],
      { maxBuffer: 15 * 1024 * 1024, timeout: 20000 },
      (err, stdout, stderr) => {
        if (err) {
          console.warn(`Tesseract (psm ${psm}) warning:`, err.message);
        }
        resolve(stdout || '');
      }
    );
  });
}

function runTesseractTsv(filePath) {
  return new Promise((resolve) => {
    execFile(TESSERACT_PATH, [filePath, 'stdout', '--psm', '6', 'tsv'],
      { maxBuffer: 15 * 1024 * 1024, timeout: 20000 },
      (err, stdout) => {
        if (err) console.warn('Tesseract TSV notice:', err.message);
        resolve(stdout || '');
      }
    );
  });
}

function getOcrAnalysis(tsv, extracted) {
  const rows = tsv.trim().split(/\r?\n/).map((line) => line.split('\t'));
  const page = rows.find((row) => row[0] === '1');
  const imageWidth = Number(page?.[8]);
  const imageHeight = Number(page?.[9]);
  if (!imageWidth || !imageHeight) return { regions: [], confidence: null };

  const lines = new Map();
  for (const row of rows) {
    if (row[0] !== '5' || !row[11]?.trim()) continue;
    const key = row.slice(1, 5).join(':');
    const word = {
      text: row[11].trim(),
      left: Number(row[6]),
      top: Number(row[7]),
      right: Number(row[6]) + Number(row[8]),
      bottom: Number(row[7]) + Number(row[9])
    };
    const line = lines.get(key) || { words: [], left: Infinity, top: Infinity, right: 0, bottom: 0 };
    line.words.push(word.text);
    line.left = Math.min(line.left, word.left);
    line.top = Math.min(line.top, word.top);
    line.right = Math.max(line.right, word.right);
    line.bottom = Math.max(line.bottom, word.bottom);
    lines.set(key, line);
  }

  const candidates = [...lines.values()].map((line) => ({ ...line, text: line.words.join(' ').toLowerCase() }));
  const find = (matcher) => {
    const line = candidates.find((candidate) => matcher.test(candidate.text));
    return line ? {
      x: line.left / imageWidth * 100,
      y: line.top / imageHeight * 100,
      width: (line.right - line.left) / imageWidth * 100,
      height: (line.bottom - line.top) / imageHeight * 100
    } : null;
  };
  const payeeFirstWord = String(extracted.payee || '').split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const invoiceValue = String(extracted.invoiceNo || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regions = [
    { field: 'payee', label: 'Vendor', bounds: (payeeFirstWord ? find(new RegExp(payeeFirstWord, 'i')) : null) || (candidates[0] ? {
      x: candidates[0].left / imageWidth * 100,
      y: candidates[0].top / imageHeight * 100,
      width: (candidates[0].right - candidates[0].left) / imageWidth * 100,
      height: (candidates[0].bottom - candidates[0].top) / imageHeight * 100
    } : null) },
    { field: 'invoiceNo', label: 'Invoice number', bounds: find(new RegExp(`invoice|receipt|bill|inv${invoiceValue ? `|${invoiceValue}` : ''}`, 'i')) },
    { field: 'date', label: 'Date', bounds: find(/date|dated|\b\d{1,4}[/-]\d{1,2}[/-]\d{1,4}\b|\b\d{1,2}\s+[a-z]{3,9}\s+\d{2,4}\b/i) },
    { field: 'tax', label: 'Tax', bounds: find(/tax|gst|vat|cgst|sgst/i) },
    { field: 'amount', label: 'Total', bounds: find(/grand total|total|payable|amount due/i) }
  ].filter((region) => region.bounds);
  const confidences = rows
    .filter((row) => row[0] === '5' && Number(row[10]) >= 0)
    .map((row) => Number(row[10]));
  const confidence = confidences.length
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length / 100
    : null;
  return { regions, confidence };
}

// Universal receipt & invoice parser for any bill (restaurant, retail, SaaS, utility, grocery)
function parseInvoiceText(rawText, fileName = "", secondaryText = "") {
  const fullText = (rawText + '\n' + secondaryText);
  const cleanMain = cleanOcrText(rawText);
  const cleanFull = cleanOcrText(fullText);

  // 1. Payee / Vendor Name Extraction
  let payee = '';
  const linesMain = cleanMain.split('\n').map(l => l.trim()).filter(Boolean);
  const vendorCandidates = [];
  for (const line of linesMain) {
    if (vendorCandidates.length >= 2) break;
    // Skip receipt headers, structural marks, and address/contact metadata
    if (/(?:tax\s*invoice|receipt|cash\s*memo|bill\s*of\s*supply|invoice|estimate|quotation|welcome|order\s*slip|trip\s*receipt)/i.test(line)) continue;
    if (/(?:service\s*rd|road|street|layout|nagar|bengaluru|bangalore|karnataka|delhi|mumbai|chennai|hyderabad|pincode|pin\s*code|pin:|gst|phone|tel|mob|time:|date:)/i.test(line)) continue;
    if (/(?:bill\s*no|invoice\s*no|invoice\s*number|receipt\s*no|receipt\s*#|order\s*no|particulars|base\s*fare|fare|item\s+qty|qty\s+price|paid\s*by|payment\s*mode|mode:)/i.test(line)) continue;
    if (/^[=\-_*#\.\s]+$/.test(line)) continue;
    if (/^\d+$/.test(line)) continue;
    if (/[0-9]+\.[0-9]{2}/.test(line)) continue; // Skip lines containing pricing numbers

    const sanitizedLine = line.replace(/^[^\w]+|[^\w]+$/g, '').trim();
    if (sanitizedLine.length >= 2) {
      vendorCandidates.push(sanitizedLine);
    }
  }

  if (vendorCandidates.length === 1) {
    payee = vendorCandidates[0];
  } else if (vendorCandidates.length >= 2) {
    payee = `${vendorCandidates[0]} (${vendorCandidates[1]})`;
  }

  // 2. Invoice / Receipt Number (Check all matches to avoid matching header words like 'Receipt Date')
  let invoiceNo = '';
  const invMatches = [
    ...cleanFull.matchAll(/\b(?:invoice|tax\s*invoice|bill|receipt|order|inv)\s*(?:number|num|no\.?|#)?\s*[:=\.-]?\s*([A-Za-z0-9\-_/]+)/gi),
    ...cleanFull.matchAll(/\bvoice\s*no\.?\s*[:=\.-]?\s*([A-Za-z0-9\-_/]+)/gi)
  ];
  for (const m of invMatches) {
    const val = (m[1] || '').trim();
    if (val && !/^(date|dated|cash|upi|table|receipt|invoice|bill|no|card|mode)$/i.test(val)) {
      invoiceNo = val;
      break;
    }
  }
  if (!invoiceNo) {
    invoiceNo = '';
  }

  // 3. Date Extraction
  let date = '';
  const months = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  // 3a. Alphanumeric dates like "16 May 2024", "16-May-2024", "Date: 16 May 2024"
  const dWordMatch = cleanFull.match(/(?:date|dated|dae)?\s*[:=\.-]?\s*(\d{1,2})\s*(?:st|nd|rd|th)?\s+([a-zA-Z]{3,9})[\s,]+(20\d{2}|\d{2})/i);
  if (dWordMatch) {
    let day = parseInt(dWordMatch[1], 10);
    const mStr = dWordMatch[2].slice(0, 3).toLowerCase();
    let yr = dWordMatch[3];
    if (yr.length === 2) yr = '20' + yr;
    if (day > 31) {
      // Fix common OCR digit misreads in thermal print (e.g. 36 -> 16)
      const dayStr = String(day);
      if (dayStr.startsWith('3') && parseInt('1' + dayStr.slice(1), 10) <= 31) {
        day = parseInt('1' + dayStr.slice(1), 10);
      }
    }
    if (months[mStr] && day >= 1 && day <= 31) {
      date = `${yr}-${months[mStr]}-${String(day).padStart(2, '0')}`;
    }
  } else {
    // 3b. Numeric dates like "16/05/2024", "2024-05-16", "04/10/2026"
    const dNumMatch = cleanFull.match(/(?:date|dated)?\s*[:=\.-]?\s*(\d{1,4})[\/\.-](\d{1,2})[\/\.-](\d{1,4})/i);
    if (dNumMatch) {
      const p1 = parseInt(dNumMatch[1], 10);
      const p2 = parseInt(dNumMatch[2], 10);
      let p3 = dNumMatch[3];
      if (p1 > 1000) {
        // YYYY-MM-DD
        date = `${p1}-${String(p2).padStart(2, '0')}-${String(parseInt(p3, 10)).padStart(2, '0')}`;
      } else {
        if (p3.length === 2) p3 = '20' + p3;
        if (p1 > 12 && p2 <= 12) {
          // DD/MM/YYYY
          date = `${p3}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
        } else if (p2 <= 12 && p1 <= 31) {
          date = `${p3}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
        }
      }
    }
  }

  // 4. Sub-Total & Grand Total Extraction
  let subTotal = 0;
  const subMatch = cleanFull.match(/(?:sub\s*-?\s*total|subtotal|taxable\s*amount|items\s*total)\s*[:=]?\s*(?:₹|rs\.?|inr|r)?\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i);
  if (subMatch) {
    subTotal = parseFloat(subMatch[1].replace(/,/g, ''));
  }

  let totalAmount = 0;
  const totalRegexes = [
    /(?:grand\s*total|net\s*payable|amount\s*payable|bill\s*total|balance\s*due)\s*[:=]?\s*(?:₹|rs\.?|inr|r|x|=)?\s*\n?\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i,
    /(?:mode\s*:\s*\w+\s+)?(?<!sub[-\s])\btotal\b\s*[:=]?\s*(?:₹|rs\.?|inr|r|x|=)?\s*\n?\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i,
    /(?:total\s*amount)\s*[:=]?\s*(?:₹|rs\.?|inr|r|x|=)?\s*\n?\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i
  ];
  for (const rx of totalRegexes) {
    const tm = cleanFull.match(rx);
    if (tm && tm[1]) {
      const val = parseFloat(tm[1].replace(/,/g, ''));
      if (val > 0) {
        totalAmount = val;
        break;
      }
    }
  }

  // 5. Tax / GST Calculation
  let tax = 0;
  let cgst = 0;
  let sgst = 0;
  const cgstM = cleanFull.match(/(?:cgst|cest)\s*[:=\.]?\s*(?:(\d+(?:\.\d+)?)\s*%)?\s*(?:₹|rs\.?|inr|r|%)?\s*[:=]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (cgstM) {
    if (cgstM[1] && subTotal > 0) {
      const rate = parseFloat(cgstM[1]) / (parseFloat(cgstM[1]) > 20 ? 10 : 1);
      cgst = +(subTotal * (rate / 100)).toFixed(2);
    } else if (cgstM[2]) {
      cgst = parseFloat(cgstM[2]);
    }
  }
  const sgstM = cleanFull.match(/(?:sgst|sost)\s*[:=\.]?\s*(?:(\d+(?:\.\d+)?)\s*%)?\s*(?:₹|rs\.?|inr|r|%)?\s*[:=]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (sgstM) {
    if (sgstM[1] && subTotal > 0) {
      const rate = parseFloat(sgstM[1]) / (parseFloat(sgstM[1]) > 20 ? 10 : 1);
      sgst = +(subTotal * (rate / 100)).toFixed(2);
    } else if (sgstM[2]) {
      sgst = parseFloat(sgstM[2]);
    }
  }

  if (cgst > 0 || sgst > 0) {
    tax = +(cgst + sgst).toFixed(2);
  } else if (totalAmount > 0 && subTotal > 0 && totalAmount >= subTotal) {
    tax = +(totalAmount - subTotal).toFixed(2);
  } else {
    const genTaxM = cleanFull.match(/(?:tax|gst|vat)\s*(?:amount)?\s*[:=]?\s*(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
    if (genTaxM) tax = parseFloat(genTaxM[1]);
  }

  // If total wasn't found but subtotal was found
  if (totalAmount === 0 && subTotal > 0) {
    totalAmount = +(subTotal + tax).toFixed(2);
  }

  // If total is smaller than subTotal due to partial scan, correct to subTotal + tax
  if (subTotal > 0 && totalAmount > 0 && totalAmount < subTotal) {
    totalAmount = +(subTotal + tax).toFixed(2);
  }

  // 6. Line Items Extraction
  const items = [];
  const lines = cleanMain.split('\n').map(l => l.trim()).filter(Boolean);
  let itemSection = false;

  for (const line of lines) {
    if (/(?:tem|item|description|particulars)\s+(?:price|rate|qty|total)/i.test(line)) {
      itemSection = true;
      continue;
    }
    if (itemSection) {
      if (/(?:sub-?total|total|cgst|sgst|mode:|save paper|thank you|time:)/i.test(line)) {
        itemSection = false;
        break;
      }

      let cleaned = line
        .replace(/^[^\w]+/, '')
        .replace(/[xR₹]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleaned.length > 2) {
        // Tabular format check: <Name> <Price> <Qty> <Total>
        const matchRow = cleaned.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+)\s+(\d+(?:\.\d+)?)$/);
        if (matchRow) {
          const [, name, price, qty, total] = matchRow;
          items.push(`${name.trim()} (${qty}x @ ₹${price}) - ₹${total}`);
        } else {
          // Fallback line item row
          const sanitizedRow = cleaned.replace(/[^\w\s-]/g, '').trim();
          if (sanitizedRow.length > 2) {
            items.push(sanitizedRow);
          }
        }
      }
    }
  }

  if (items.length === 0) {
    items.length = 0;
  }

  // 7. Category Detection
  let category = "Miscellaneous";
  const textLower = (cleanFull + " " + fileName).toLowerCase();

  if (/(?:supermarket|grocery|superstore|mart|hypermarket|dmart|spencer|reliance fresh|nature's basket|blinkit|zepto|bigbasket|vegetables|fruits|dairy|oil|atta|sugar)/i.test(textLower)) {
    category = "Groceries";
  } else if (/(?:uber|ola|rapido|taxi|cab|flight|airline|indigo|air india|train|irctc|metro|petrol|diesel|fuel|toll|parking|commute|ride)/i.test(textLower)) {
    category = "Travel & Commute";
  } else if (/(?:biriyani|biryani|roti|chicken|mutton|paneer|curry|naan|rice|dal|dosa|idli|pizza|burger|coffee|tea|cafe|restaurant|hotel|bhagini|bar|pub|food|dining|kitchen|bistro|dhaba|swiggy|zomato|subway|starbucks|table:)/i.test(textLower)) {
    category = "Dining";
  } else if (/(?:electricity|electric|bescom|adani|tata power|water|gas|cylinder|broadband|wifi|airtel|jio|utility)/i.test(textLower)) {
    category = "Utilities";
  } else if (/(?:stationery|paper|print|xerox|cartridge|pen|pencil|desk|office supplies)/i.test(textLower)) {
    category = "Office Supplies";
  } else if (/(?:aws|amazon web|azure|google cloud|cloud|software|saas|hosting|domain|github|figma|slack|zoom|digitalocean|droplet)/i.test(textLower)) {
    category = "Software & SaaS";
  } else if (/(?:pharmacy|apollo|medplus|chemist|hospital|clinic|doctor|healthcare|medicine|tablet|syrup)/i.test(textLower)) {
    category = "Healthcare";
  }

  return {
    payee,
    amount: totalAmount,
    subTotal,
    category,
    date,
    invoiceNo,
    tax: parseFloat(tax) || 0,
    items,
    confidence: null,
    rawTextSnippet: cleanMain.slice(0, 300)
  };
}

// Parse XML invoices specifically
function parseXmlInvoice(xmlString, fileName = "") {
  let payee = "";
  let amount = 0;
  let date = "";
  let invoiceNo = "";
  let items = [];

  const supplierMatch = xmlString.match(/<(?:cac:PartyName|PartyName|SupplierName)>[\s\S]*?<cbc:Name>([\s\S]*?)<\/cbc:Name>/i) ||
                        xmlString.match(/<(?:Supplier|Vendor|Payee)>([\s\S]*?)<\/(?:Supplier|Vendor|Payee)>/i);
  if (supplierMatch && supplierMatch[1]) {
    payee = supplierMatch[1].trim();
  }

  const amountMatch = xmlString.match(/<(?:cbc:PayableAmount|PayableAmount|GrandTotal|TotalAmount)[^>]*>([\s\S]*?)<\/(?:cbc:PayableAmount|PayableAmount|GrandTotal|TotalAmount)>/i);
  if (amountMatch && amountMatch[1]) {
    amount = parseFloat(amountMatch[1].trim());
  }

  const idMatch = xmlString.match(/<(?:cbc:ID|InvoiceNumber|ID)>([\s\S]*?)<\/(?:cbc:ID|InvoiceNumber|ID)>/i);
  if (idMatch && idMatch[1]) {
    invoiceNo = idMatch[1].trim();
  }

  const dateMatch = xmlString.match(/<(?:cbc:IssueDate|IssueDate|Date)>([\s\S]*?)<\/(?:cbc:IssueDate|IssueDate|Date)>/i);
  if (dateMatch && dateMatch[1]) {
    date = dateMatch[1].trim();
  }

  if (!amount || !payee) {
    const textParsed = parseInvoiceText(xmlString, fileName);
    if (!amount) amount = textParsed.amount;
  }

  return {
    payee,
    amount,
    category: "Miscellaneous",
    date,
    invoiceNo,
    tax: 0,
    items,
    confidence: null
  };
}

// ==========================================
// POSTGRESQL CRUD ROUTES
// ==========================================

// 1. GET all expenses with filtering & search (READ)
app.get('/api/expenses', async (req, res) => {
  try {
    const expenses = await Expense.findAll(req.query);
    res.json({
      success: true,
      count: expenses.length,
      data: expenses
    });
  } catch (err) {
    console.error('Error fetching expenses from PostgreSQL:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expenses from database'
    });
  }
});

// 2. GET single expense by ID (READ)
app.get('/api/expenses/:id', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: `Expense with ID ${req.params.id} not found`
      });
    }
    res.json({
      success: true,
      data: expense
    });
  } catch (err) {
    console.error('Error fetching expense by ID:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense'
    });
  }
});

// 3. POST create new expense (CREATE)
app.post('/api/expenses', async (req, res) => {
  try {
    const validationError = validateExpensePayload(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const newExpense = await Expense.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Expense created successfully in PostgreSQL database',
      data: newExpense
    });
  } catch (err) {
    console.error('Error creating expense in PostgreSQL:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create expense in database'
    });
  }
});

// 4. PUT update existing expense by ID (UPDATE)
app.put('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validationError = validateExpensePayload(req.body, { partial: true });
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }
    const updated = await Expense.update(id, req.body);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Expense with ID ${id} not found`
      });
    }

    res.json({
      success: true,
      message: `Expense ${id} updated successfully in PostgreSQL`,
      data: updated
    });
  } catch (err) {
    console.error('Error updating expense in PostgreSQL:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update expense'
    });
  }
});

// 5. DELETE expense by ID (DELETE)
app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Expense.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Expense with ID ${id} not found`
      });
    }

    res.json({
      success: true,
      message: `Expense ${id} deleted successfully from PostgreSQL`,
      data: deleted
    });
  } catch (err) {
    console.error('Error deleting expense from PostgreSQL:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to delete expense'
    });
  }
});

// 6. GET categories with budget & totals
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.findAll();
    res.json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
});

// 7. POST create a new category
app.post('/api/categories', async (req, res) => {
  try {
    const { name, icon, description, budgetLimit } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    const category = await Category.create({ name, icon, description, budgetLimit });
    res.status(201).json({
      success: true,
      data: category
    });
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create category'
    });
  }
});

// 8. GET aggregate statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await Expense.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate stats'
    });
  }
});

// 9. GET uploaded invoices list
app.get('/api/invoices', async (req, res) => {
  try {
    const invoices = await InvoiceDocument.findAll();
    res.json({
      success: true,
      count: invoices.length,
      data: invoices
    });
  } catch (err) {
    console.error('Error fetching invoices:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices'
    });
  }
});

// 10. POST /api/parse-receipt - Proper OCR and invoice parser endpoint
app.post('/api/parse-receipt', protectReceiptParser, upload.single('receipt'), async (req, res) => {
  try {
    let fileName = "";
    let fileType = "";
    let fileBuffer = null;
    let fileText = "";
    let fileSize = 0;

    if (req.file) {
      fileName = req.file.originalname || "invoice";
      fileType = req.file.mimetype || "";
      fileBuffer = req.file.buffer;
      fileSize = req.file.size || 0;
    } else if (req.body) {
      fileName = req.body.fileName || "invoice";
      fileType = req.body.fileType || "";
      if (typeof fileName !== 'string' || fileName.length > 255 || typeof fileType !== 'string' || fileType.length > 100) {
        return res.status(400).json({ success: false, message: 'Invalid receipt metadata.' });
      }
      if (req.body.fileText !== undefined && typeof req.body.fileText !== 'string') {
        return res.status(400).json({ success: false, message: 'Receipt text must be a string.' });
      }
      if (req.body.fileBase64 !== undefined && typeof req.body.fileBase64 !== 'string') {
        return res.status(400).json({ success: false, message: 'Encoded receipt data must be a string.' });
      }
      fileText = req.body.fileText || "";
      if (req.body.fileBase64) {
        const base64Data = req.body.fileBase64.replace(/^data:.*?;base64,/, '');
        if (base64Data.length > Math.ceil(MAX_RECEIPT_BYTES / 3) * 4 + 4) {
          return res.status(413).json({ success: false, message: 'Receipt files must be 10 MB or smaller.' });
        }
        fileBuffer = Buffer.from(base64Data, 'base64');
        fileSize = fileBuffer.length;
      }
    }

    if (typeof fileName !== 'string' || fileName.length > 255 || typeof fileType !== 'string' || fileType.length > 100) {
      return res.status(400).json({ success: false, message: 'Invalid receipt metadata.' });
    }
    const ext = path.extname(fileName).toLowerCase();
    if (fileSize > MAX_RECEIPT_BYTES) {
      return res.status(413).json({ success: false, message: 'Receipt files must be 10 MB or smaller.' });
    }
    if (fileText.length > 1024 * 1024) {
      return res.status(413).json({ success: false, message: 'Receipt text must be 1 MB or smaller.' });
    }
    if (fileBuffer && !hasValidReceiptSignature(ext, fileBuffer)) {
      return res.status(415).json({ success: false, message: 'The file contents do not match a supported PDF, image, or XML type.' });
    }
    if (!ALLOWED_RECEIPT_EXTENSIONS.has(ext)) {
      return res.status(415).json({ success: false, message: 'Choose a PDF, image, or XML invoice.' });
    }
    const allowedMimeTypes = {
      '.pdf': ['application/pdf'],
      '.xml': ['application/xml', 'text/xml'],
      '.jpg': ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.png': ['image/png'],
      '.webp': ['image/webp'],
      '.bmp': ['image/bmp', 'image/x-ms-bmp'],
      '.tiff': ['image/tiff']
    };
    if (fileType && fileType !== 'application/octet-stream' && !allowedMimeTypes[ext].includes(fileType.toLowerCase())) {
      return res.status(415).json({ success: false, message: 'The file type does not match its filename.' });
    }
    let extracted = null;

    // A. PDF Document Parsing
    if (ext === '.pdf') {
      if (fileBuffer && pdfParse) {
        try {
          const pdfData = await pdfParse(fileBuffer);
          fileText = pdfData.text || "";
        } catch (pdfErr) {
          console.log('PDF text extract notice:', pdfErr.message);
        }
      }
      if (fileBuffer && !fileText.trim()) {
        return res.status(422).json({ success: false, message: 'No readable text was found. Try a text-based PDF or upload a clear image.' });
      }
      extracted = parseInvoiceText(fileText, fileName);
    } 
    // B. XML E-Invoice Parsing
    else if (ext === '.xml') {
      const xmlStr = fileText || (fileBuffer ? fileBuffer.toString('utf8') : "");
      extracted = parseXmlInvoice(xmlStr, fileName);
    } 
    // C. Images & other formats (OCR extraction via Tesseract CLI)
    else {
      let ocrText = fileText || "";
      let secondaryText = "";
      let ocrTsv = "";

      if (fileBuffer && fileBuffer.length > 0) {
        const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'];
        const tempExt = ext && validExts.includes(ext) ? ext : '.jpg';
        const tempFile = path.join(os.tmpdir(), `ocr_${crypto.randomUUID()}${tempExt}`);

        try {
          await fs.promises.writeFile(tempFile, fileBuffer, { flag: 'wx', mode: 0o600 });
          console.log(`Running Tesseract OCR on ${fileName} (${tempFile})...`);
          const [psm6Out, psm11Out, tsvOut] = await Promise.all([
            runTesseract(tempFile, '6'),
            runTesseract(tempFile, '11'),
            runTesseractTsv(tempFile)
          ]);
          ocrText = psm6Out || psm11Out || "";
          secondaryText = psm11Out || "";
          ocrTsv = tsvOut;
          console.log(`Tesseract completed: extracted ${ocrText.length} characters.`);
        } catch (ocrErr) {
          console.error('Tesseract OCR error:', ocrErr.message);
        } finally {
          try {
            await fs.promises.unlink(tempFile);
          } catch {}
        }
      }

      if (fileBuffer && !fileText && !ocrText.trim()) {
        return res.status(422).json({ success: false, message: 'No readable text was found. Try a sharper image or a text-based PDF.' });
      }
      extracted = parseInvoiceText(ocrText, fileName, secondaryText);
      const ocrAnalysis = getOcrAnalysis(ocrTsv, extracted);
      extracted.ocrRegions = ocrAnalysis.regions;
      if (ocrAnalysis.confidence !== null) extracted.confidence = ocrAnalysis.confidence;
    }

    // Record document in PostgreSQL invoices table
    try {
      await InvoiceDocument.create({
        fileName,
        fileType: ext.replace('.', '').toUpperCase() || 'RECEIPT',
        fileSize,
        extractedData: extracted,
        status: 'parsed'
      });
    } catch (docErr) {
      console.warn('Note: Document metadata logging to PostgreSQL skipped:', docErr.message);
    }

    res.json({
      success: true,
      message: `OCR document analysis completed for ${fileName}`,
      data: {
        fileName,
        fileType: ext.replace('.', '').toUpperCase() || 'RECEIPT',
        extracted
      }
    });
  } catch (error) {
    console.error('OCR Parsing Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to parse receipt document'
    });
  }
});

// Create a bearer-token link to an immutable, read-only statement snapshot.
app.post('/api/shared-statements', async (req, res) => {
  const { expenses, currency = '₹', period = 'All Time' } = req.body || {};
  if (!Array.isArray(expenses) || expenses.length > 500) {
    return res.status(400).json({ success: false, message: 'Provide up to 500 statement transactions.' });
  }

  const transactions = expenses.map(sanitizeSharedExpense);
  if (transactions.some((expense) => !expense)) {
    return res.status(400).json({ success: false, message: 'Each transaction must have a valid date, payee, and positive amount.' });
  }

  try {
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const total = transactions.reduce((sum, expense) => sum + expense.amount, 0);
    const snapshot = {
      currency: String(currency).slice(0, 8),
      period: String(period).slice(0, 80),
      total,
      transactions,
      createdAt: new Date().toISOString()
    };
    const record = await SharedStatement.create(hashShareToken(token), snapshot, expiresAt);
    res.set('Cache-Control', 'no-store');
    res.status(201).json({ success: true, data: { token, expiresAt: record.expires_at } });
  } catch (err) {
    console.error('Error creating shared statement:', err);
    res.status(500).json({ success: false, message: 'Could not create a share link.' });
  }
});

app.get('/api/shared-statements/:token', async (req, res) => {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(req.params.token)) {
    return res.status(404).json({ success: false, message: 'This statement link is invalid, expired, or revoked.' });
  }
  try {
    const statement = await SharedStatement.findActive(hashShareToken(req.params.token));
    res.set('Cache-Control', 'no-store');
    if (!statement) {
      return res.status(404).json({ success: false, message: 'This statement link is invalid, expired, or revoked.' });
    }
    res.json({ success: true, data: { ...statement.snapshot, expiresAt: statement.expires_at } });
  } catch (err) {
    console.error('Error reading shared statement:', err);
    res.status(500).json({ success: false, message: 'Could not load this statement.' });
  }
});

app.delete('/api/shared-statements/:token', async (req, res) => {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(req.params.token)) {
    return res.status(404).json({ success: false, message: 'Share link not found.' });
  }
  try {
    const revoked = await SharedStatement.revoke(hashShareToken(req.params.token));
    res.set('Cache-Control', 'no-store');
    if (!revoked) return res.status(404).json({ success: false, message: 'Share link not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error revoking shared statement:', err);
    res.status(500).json({ success: false, message: 'Could not revoke this share link.' });
  }
});

// Healthcheck Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'PostgreSQL',
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Receipt files must be 10 MB or smaller.'
      : 'Invalid receipt upload.';
    return res.status(status).json({ success: false, message });
  }
  if (err.message === 'Choose a PDF, image, or XML invoice.') {
    return res.status(415).json({ success: false, message: err.message });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request payload is too large.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Request body must contain valid JSON.' });
  }
  console.error('Unhandled API error:', err);
  return res.status(500).json({ success: false, message: 'The request could not be completed.' });
});

// Server Initialization
async function startServer() {
  try {
    console.log('Initializing PostgreSQL connection and tables...');
    await initDb();
    // This interview demo is intentionally local-only; remote deployments need authentication and tenant scoping first.
    app.listen(PORT, '127.0.0.1', () => {
      console.log(`Accounting backend running with PostgreSQL on http://127.0.0.1:${PORT}`);
    });
  } catch (err) {
    console.error('Database initialization failed:', err);
    // Start server anyway so API is available and can reconnect
    app.listen(PORT, '127.0.0.1', () => {
      console.log(`Accounting backend running (DB initialization pending) on http://127.0.0.1:${PORT}`);
    });
  }
}

startServer();
