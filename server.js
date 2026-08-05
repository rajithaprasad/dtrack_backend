// server.js - Full Integration with PostgreSQL (No Table Creation)

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');
const { createCanvas } = require('canvas');
const JsBarcode = require('jsbarcode');
const { Canvas } = require('canvas');
const { Pool } = require('pg');
const app = express();

// ===== DATABASE CONNECTION =====
const pool = new Pool({
  host: 'dpg-d9por5ajnfac73a497l0-a.oregon-postgres.render.com',
  port: 5432,
  database: 'dtrack_b73t',
  user: 'dtrack_b73t_user',
  password: 'PdJYrZxp1zrMfVAtfJ7EsiMTdTsxoJRz',
  ssl: {
    rejectUnauthorized: false // Required for Render
  }
});

// Test database connection only (no table creation)
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.stack);
  } else {
    console.log('✅ Database connected successfully');
    release();
  }
});

// ===== FILE STORAGE SETUP =====
const uploadsDir = path.join(__dirname, 'uploads');
const labelsDir = path.join(uploadsDir, 'labels');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(labelsDir)) {
  fs.mkdirSync(labelsDir, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Detrack API Configuration
const DETRACK_API_KEY = '20928476aa7ee4a9348bc160a1e83d1afee75d69183b6934';
const DETRACK_API_URL = 'https://app.detrack.com/api/v2/dn/jobs';

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Configure multer for label file upload
const labelStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, labelsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `label-${uniqueSuffix}${ext}`);
  }
});

const uploadLabel = multer({
  storage: labelStorage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, PNG, and JPEG files are allowed'));
    }
  }
});

// ============== BARCODE & QR CODE GENERATION ==============

// Generate Barcode as PNG buffer
const generateBarcode = async (text) => {
  try {
    const canvas = createCanvas(300, 80);
    const ctx = canvas.getContext('2d');

    JsBarcode(canvas, text, {
      format: 'CODE128',
      width: 2,
      height: 65,
      displayValue: true,
      fontSize: 12,
      font: 'monospace',
      textAlign: 'center',
      textPosition: 'bottom',
      textMargin: 4,
      background: '#ffffff',
      lineColor: '#000000',
      margin: 5,
    });

    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error('Error generating barcode:', error);
    return null;
  }
};

// Generate QR Code as PNG buffer
const generateQRCode = async (text) => {
  try {
    const qrBuffer = await QRCode.toBuffer(text, {
      type: 'png',
      width: 80,
      margin: 1,
      color: {
        dark: '#1a1a2e',
        light: '#ffffff',
      },
    });
    return qrBuffer;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null;
  }
};

// ===== LAYOUT CONFIGURATIONS =====
const layouts = {
  '4-per-page': { 
    labelsPerPage: 4, cols: 2, rows: 2, 
    marginX: 18, marginY: 30, gapX: 15, gapY: 20, 
    labelWidth: 270, labelHeight: 380,
    pageWidth: 595.28, pageHeight: 841.89,
    isA4Layout: true,
    scale: 1.0,
  },
  '6-per-page': { 
    labelsPerPage: 6, cols: 2, rows: 3, 
    marginX: 15, marginY: 20, gapX: 12, gapY: 15, 
    labelWidth: 275, labelHeight: 245,
    pageWidth: 595.28, pageHeight: 841.89,
    isA4Layout: true,
    scale: 0.7,
  },
  '8-per-page-1': { 
    labelsPerPage: 8, cols: 2, rows: 4, 
    marginX: 12, marginY: 15, gapX: 10, gapY: 12, 
    labelWidth: 280, labelHeight: 185,
    pageWidth: 595.28, pageHeight: 841.89,
    isA4Layout: true,
    scale: 0.55,
  },
  '8-per-page-2': { 
    labelsPerPage: 8, cols: 2, rows: 4, 
    marginX: 12, marginY: 15, gapX: 10, gapY: 12, 
    labelWidth: 280, labelHeight: 185,
    pageWidth: 595.28, pageHeight: 841.89,
    isA4Layout: true,
    scale: 0.6,
  },
  '10x10': { 
    labelsPerPage: 1, cols: 1, rows: 1,
    marginX: 0, marginY: 0, gapX: 0, gapY: 0,
    labelWidth: 283.465, labelHeight: 283.465,
    pageWidth: 283.465, pageHeight: 283.465,
    isA4Layout: false,
    scale: 0.8,
  },
  '10x15': { 
    labelsPerPage: 1, cols: 1, rows: 1,
    marginX: 0, marginY: 0, gapX: 0, gapY: 0,
    labelWidth: 283.465, labelHeight: 425.197,
    pageWidth: 283.465, pageHeight: 425.197,
    isA4Layout: false,
    scale: 0.8,
  },
  '7.6x5': { 
    labelsPerPage: 1, cols: 1, rows: 1,
    marginX: 0, marginY: 0, gapX: 0, gapY: 0,
    labelWidth: 215.433, labelHeight: 141.732,
    pageWidth: 215.433, pageHeight: 141.732,
    isA4Layout: false,
    scale: 0.6,
  },
};

// ===== GENERATE A SINGLE LABEL WITH DYNAMIC SCALING =====
const generateLabelOnPage = async (page, x, y, width, height, data) => {
  const { 
    doNumber, barcodeText, customerName, address, companyName, 
    boxNumber, totalBoxes, phone, instructions, config 
  } = data;
  
  const font = await page.doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await page.doc.embedFont(StandardFonts.HelveticaBold);

  // Get scale factor from config
  const scale = config.scale || 1.0;

  // All sizes are multiplied by scale factor
  const labelPadding = 6 * scale;
  const orderFontSize = 10 * scale;
  const shipToLabelSize = 7 * scale;
  const customerNameSize = 11 * scale;
  const phoneSize = 8 * scale;
  const addressSize = 8 * scale;
  const instructionLabelSize = 6 * scale;
  const instructionTextSize = 8 * scale;
  const qrSize = 55 * scale;
  const barcodeHeight = 55 * scale;
  const addressSpacing = 7 * scale;
  const maxAddressLines = 6;
  const addressCharsPerLine = Math.floor(30 / scale);

  const margin = labelPadding;
  const left = x + margin;
  const right = x + width - margin;
  const top = y + margin;
  const bottom = y + height - margin;
  const usableWidth = width - (margin * 2);

  // --- Clean background ---
  page.drawRectangle({ x: x, y: y, width: width, height: height, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: x, y: y, width: width, height: height, borderColor: rgb(0.8, 0.8, 0.85), borderWidth: 1 });
  
  // --- Top accent bar ---
  page.drawRectangle({
    x: x,
    y: y + height - (4 * scale),
    width: width,
    height: 4 * scale,
    color: rgb(0.15, 0.3, 0.6),
  });
  
  // --- Left accent bar ---
  page.drawRectangle({
    x: x,
    y: y,
    width: 4 * scale,
    height: height,
    color: rgb(0.15, 0.3, 0.6),
  });

  // ===== LOGO SECTION (Top Left) =====
  let logoHeight = 0;
  let logoWidth = 0;
  try {
    const logoPath = path.join(__dirname, 'logo.png');
    if (fs.existsSync(logoPath)) {
      const logoImage = await page.doc.embedPng(fs.readFileSync(logoPath));
      logoWidth = 100 * scale;
      logoHeight = 40 * scale;
      const logoX = left;
      const logoY = y + height - (60 * scale);
      page.drawImage(logoImage, {
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
      });
    }
  } catch (error) {
    console.log('Logo not found:', error);
  }

  // === 1. ORDER ID (Top Right) ===
  const orderIdY = y + height - (18 * scale);
  page.drawText(`ORDER: ${doNumber}`, {
    x: right - (130 * scale),
    y: orderIdY,
    size: orderFontSize,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  // === 2. BARCODE (Below Logo) ===
  const barcodeBuffer = await generateBarcode(barcodeText);
  if (barcodeBuffer) {
    try {
      const barcodeImage = await page.doc.embedPng(barcodeBuffer);
      const bw = Math.min(usableWidth - (20 * scale), 180 * scale);
      const bh = Math.max(20 * scale, barcodeHeight);
      const barcodeX = left;
      const barcodeY = y + height - (60 * scale) - logoHeight - (30 * scale);
      page.drawImage(barcodeImage, {
        x: barcodeX,
        y: barcodeY,
        width: bw,
        height: bh,
      });
    } catch (e) {}
  }

  // === 3. QR CODE (Top Right) ===
  const qrBuffer = await generateQRCode(barcodeText);
  const qrSizeActual = Math.max(25 * scale, qrSize);
  const qrX = right - qrSizeActual - (10 * scale);
  const qrY = y + height - (85 * scale);
  
  if (qrBuffer) {
    try {
      const qrImage = await page.doc.embedPng(qrBuffer);
      page.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSizeActual,
        height: qrSizeActual,
      });
      page.drawText('SCAN QR', {
        x: qrX + qrSizeActual / 2 - (18 * scale),
        y: qrY - (10 * scale),
        size: 5 * scale,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });
    } catch (e) {}
  }

  // === 4. BOX NUMBER ===
  const boxY = y + height - (35 * scale);
  page.drawText(`BOX ${boxNumber}/${totalBoxes}`, {
    x: right - (100 * scale),
    y: boxY,
    size: 8 * scale,
    font: fontBold,
    color: rgb(0.15, 0.3, 0.6),
  });

  // === 5. SHIP TO ADDRESS ===
  let addressY = y + height - (160 * scale) - logoHeight;
  
  // "SHIP TO:" label
  page.drawText('SHIP TO:', {
    x: left,
    y: addressY,
    size: shipToLabelSize,
    font: fontBold,
    color: rgb(0.5, 0.5, 0.5),
  });
  addressY -= (12 * scale);

  // Customer Name
  page.drawText(customerName || 'Customer', {
    x: left,
    y: addressY,
    size: customerNameSize,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  addressY -= (10 * scale);

  // Phone
  if (phone) {
    page.drawText(`Phone: ${phone}`, {
      x: left,
      y: addressY,
      size: phoneSize,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
    addressY -= (8 * scale);
  }

  // Address
  if (address) {
    const cleanAddress = address.replace(/\s+/g, ' ').trim();
    const maxChars = addressCharsPerLine || 30;
    
    const parts = cleanAddress.split(',').map(p => p.trim()).filter(p => p.length > 0);
    let addressLines = [];
    
    if (parts.length > 1) {
      let currentLine = '';
      for (const part of parts) {
        if ((currentLine + ', ' + part).length <= maxChars && currentLine !== '') {
          currentLine += ', ' + part;
        } else if (currentLine === '') {
          currentLine = part;
        } else {
          addressLines.push(currentLine);
          currentLine = part;
        }
      }
      if (currentLine) addressLines.push(currentLine);
    } else {
      const words = cleanAddress.split(' ');
      let currentLine = '';
      for (const word of words) {
        if ((currentLine + ' ' + word).length <= maxChars) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) addressLines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) addressLines.push(currentLine);
    }
    
    const maxLines = Math.min(addressLines.length, maxAddressLines);
    for (let i = 0; i < maxLines && addressY > top + (30 * scale); i++) {
      page.drawText(addressLines[i], {
        x: left,
        y: addressY,
        size: addressSize,
        font: font,
        color: rgb(0.2, 0.2, 0.2),
      });
      addressY -= addressSpacing;
    }
  }

  // === 6. INSTRUCTIONS ===
  if (instructions && instructions.trim()) {
    const instrY = addressY - (15 * scale);
    
    if (instrY > top + (15 * scale)) {
      page.drawText('INSTRUCTIONS:', {
        x: left,
        y: instrY,
        size: instructionLabelSize,
        font: fontBold,
        color: rgb(0.3, 0.3, 0.3),
      });
      
      const instrMaxChars = Math.floor((usableWidth - (10 * scale)) / (instructionTextSize * 0.4));
      const words = instructions.split(' ');
      let lines = [];
      let currentLine = '';
      
      for (const word of words) {
        if ((currentLine + ' ' + word).length <= instrMaxChars) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);
      
      const maxInstrLines = Math.min(lines.length, 3);
      let instrTextY = instrY - (12 * scale);
      
      for (let i = 0; i < maxInstrLines && instrTextY > top + (15 * scale); i++) {
        let displayText = lines[i];
        if (i === maxInstrLines - 1 && lines.length > maxInstrLines) {
          displayText = displayText.substring(0, Math.max(3, displayText.length - 3)) + '...';
        }
        page.drawText(displayText, {
          x: left,
          y: instrTextY,
          size: instructionTextSize,
          font: font,
          color: rgb(0.2, 0.2, 0.2),
        });
        instrTextY -= instructionTextSize + (3 * scale);
      }
    }
  }
};

// ===== GENERATE SHIPPING LABELS =====
const generateShippingLabels = async (doNumber, barcodes, customerName, address, companyName = '', phone = '', instructions = '', layout = '4-per-page') => {
  const pdfDoc = await PDFDocument.create();
  
  const config = layouts[layout] || layouts['4-per-page'];
  const { 
    labelsPerPage, cols, rows, marginX, marginY, gapX, gapY, 
    labelWidth, labelHeight, pageWidth, pageHeight, isA4Layout,
  } = config;

  if (!isA4Layout) {
    for (let i = 0; i < barcodes.length; i++) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      
      const labelData = {
        doNumber,
        barcodeText: barcodes[i],
        customerName,
        address,
        companyName,
        boxNumber: i + 1,
        totalBoxes: barcodes.length,
        phone,
        instructions,
        config,
      };
      
      await generateLabelOnPage(page, 0, 0, pageWidth, pageHeight, labelData);
    }
    return pdfDoc;
  }

  for (let i = 0; i < barcodes.length; i++) {
    const positionInPage = i % labelsPerPage;
    const col = positionInPage % cols;
    const row = Math.floor(positionInPage / cols);

    const x = marginX + col * (labelWidth + gapX);
    const y = pageHeight - marginY - (row + 1) * labelHeight - row * gapY;

    if (i % labelsPerPage === 0) {
      pdfDoc.addPage([pageWidth, pageHeight]);
    }

    const page = pdfDoc.getPages()[pdfDoc.getPages().length - 1];

    const labelData = {
      doNumber,
      barcodeText: barcodes[i],
      customerName,
      address,
      companyName,
      boxNumber: i + 1,
      totalBoxes: barcodes.length,
      phone,
      instructions,
      config,
    };

    await generateLabelOnPage(page, x, y, labelWidth, labelHeight, labelData);
  }

  return pdfDoc;
};

// ============== API ENDPOINTS ==============

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});

// ===== FETCH JOBS FROM DATABASE =====
app.get('/api/db-jobs', async (req, res) => {
  try {
    const { date } = req.query;

    let query = 'SELECT * FROM jobs ORDER BY scheduled_date DESC, created_at DESC';
    const params = [];

    if (date) {
      query = 'SELECT * FROM jobs WHERE scheduled_date = $1 ORDER BY created_at DESC';
      params.push(date);
    }

    const result = await pool.query(query, params);

    console.log(`✅ Fetched ${result.rows.length} jobs from database`);

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Database fetch error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch jobs from database',
      details: error.message
    });
  }
});

// ===== FETCH SINGLE JOB FROM DATABASE =====
app.get('/api/db-jobs/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const result = await pool.query(
      'SELECT * FROM jobs WHERE id = $1 OR do_number = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Database fetch error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch job from database',
      details: error.message
    });
  }
});

// ===== FETCH JOB BY DO NUMBER FROM DETRACK API =====
app.get('/api/job-by-donumber', async (req, res) => {
  try {
    const { do_number } = req.query;
    
    if (!do_number) {
      return res.status(400).json({ error: 'do_number is required' });
    }
    
    console.log(`📡 Fetching job by DO number: ${do_number} from Detrack...`);
    
    const response = await axios.get(`https://app.detrack.com/api/v2/dn/jobs?do_number=${do_number}`, {
      headers: {
        'X-API-KEY': DETRACK_API_KEY
      }
    });
    
    const jobs = response.data?.data || [];
    const job = jobs.length > 0 ? jobs[0] : null;
    
    console.log(`✅ ${job ? 'Found' : 'No'} job found for DO number: ${do_number}`);
    
    return res.json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('❌ Fetch job by DO number error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch job from Detrack',
      details: error.response?.data?.message || error.message
    });
  }
});

// ===== CREATE SINGLE JOB =====
app.post('/api/create-job', async (req, res) => {
  try {
    const jobData = req.body;
    
    console.log('📦 Creating single job in Detrack...');
    console.log('📋 Job data:', JSON.stringify(jobData, null, 2));
    
    // Validate required fields
    const requiredFields = ['do_number', 'address', 'deliver_to'];
    for (const field of requiredFields) {
      if (!jobData[field]) {
        return res.status(400).json({
          error: `Missing required field: ${field}`
        });
      }
    }
    
    // Prepare payload for Detrack API
    const payload = { data: {} };
    
    // Map fields to Detrack API format
    const fieldMap = {
      date: 'date',
      do_number: 'do_number',
      address: 'address',
      deliver_to: 'deliver_to',
      phone: 'phone',
      notify_email: 'notify_email',
      instructions: 'instructions',
      group: 'group',
      delivery_type: 'delivery_type',
      time_window: 'time_window',
      cartons: 'cartons',
      boxes: 'boxes',
      weight: 'weight',
      pieces: 'pieces',
      pallets: 'pallets',
      address_1: 'address_1',
      address_2: 'address_2',
      postal_code: 'postal_code',
      city: 'city',
      state: 'state',
      country: 'country',
      latitude: 'latitude',
      longitude: 'longitude',
      company_name: 'company_name',
      zone: 'zone',
      assign_to: 'assign_to',
      run_no: 'run_no',
      depot: 'depot',
      reason: 'reason',
      received_by: 'received_by',
      note: 'note',
      remarks: 'remarks',
      carrier: 'carrier',
      payment_mode: 'payment_mode',
      payment_amount: 'payment_amount',
      invoice_no: 'invoice_no',
      account_no: 'account_no',
      delivery_sequence: 'delivery_sequence',
      service_type: 'service_type',
      service_time: 'service_time',
      start_time: 'start_time',
      end_time: 'end_time',
      depot_contact: 'depot_contact',
      depot_contact_no: 'depot_contact_no',
      depot_address: 'depot_address',
      payment_collected: 'payment_collected',
      auto_reschedule: 'auto_reschedule',
      attachment_url: 'attachment_url'
    };
    
    // Build payload with only valid fields
    Object.keys(jobData).forEach(key => {
      if (fieldMap[key] && jobData[key] !== '' && jobData[key] !== null && jobData[key] !== undefined) {
        payload.data[fieldMap[key]] = jobData[key];
      }
    });
    
    console.log('📤 Sending to Detrack:', JSON.stringify(payload, null, 2));
    
    // Send to Detrack
    const response = await axios.post(DETRACK_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': DETRACK_API_KEY
      }
    });
    
    if (response.data && response.data.data && response.data.data.id) {
      const detrackId = response.data.data.id;
      
      // Generate barcodes
      const barcodes = [];
      const totalBoxes = jobData.boxes || jobData.cartons || 1;
      for (let i = 0; i < totalBoxes; i++) {
        barcodes.push(`${jobData.do_number}-${String(i + 1).padStart(2, '0')}`);
      }
      
      // Save to PostgreSQL
      const query = `
        INSERT INTO jobs (
          do_number, customer_name, customer_company, phone, 
          delivery_address, postcode, recipient_name, recipient_phone,
          boxes, weight, contents, status, scheduled_date,
          special_instructions, barcodes, detrack_id, source,
          group_name, pickup_address, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING id
      `;
      
      const result = await pool.query(query, [
        jobData.do_number,
        jobData.deliver_to || jobData.customer_name || '',
        jobData.company_name || '',
        jobData.phone || '',
        jobData.address || '',
        jobData.postal_code || '',
        jobData.deliver_to || '',
        jobData.phone || '',
        jobData.boxes || jobData.cartons || 1,
        jobData.weight || 0,
        jobData.contents || '',
        'pending',
        jobData.date || null,
        jobData.instructions || '',
        JSON.stringify(barcodes),
        detrackId,
        'customer',
        jobData.group || '',
        jobData.pickup_address || '',
        new Date().toISOString(),
        new Date().toISOString()
      ]);
      
      console.log(`✅ Job ${jobData.do_number} created with ID: ${detrackId}`);
      
      return res.json({
        success: true,
        job: {
          id: result.rows[0].id,
          do_number: jobData.do_number,
          detrack_id: detrackId,
          boxes: totalBoxes,
          barcodes: barcodes
        }
      });
    } else {
      throw new Error('Failed to create job in Detrack');
    }
    
  } catch (error) {
    console.error('❌ Error creating job:', error);
    return res.status(500).json({
      error: 'Failed to create job',
      details: error.response?.data?.message || error.message
    });
  }
});

// API Endpoint: Generate and save shipping labels
app.post('/api/generate-labels', async (req, res) => {
  try {
    const { doNumber, barcodes, customerName, address, companyName, phone, instructions, layout } = req.body;

    if (!doNumber || !barcodes || barcodes.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: doNumber and barcodes'
      });
    }

    console.log(`📦 Generating labels for ${doNumber} (${barcodes.length} labels) with layout: ${layout || '4-per-page'}`);

    const pdfDoc = await generateShippingLabels(
      doNumber,
      barcodes,
      customerName,
      address,
      companyName || '',
      phone || '',
      instructions || '',
      layout || '4-per-page'
    );
    const pdfBytes = await pdfDoc.save();

    const filename = `labels_${doNumber}_${Date.now()}.pdf`;
    const filepath = path.join(labelsDir, filename);
    fs.writeFileSync(filepath, pdfBytes);

    const fileUrl = `/uploads/labels/${filename}`;

    // Save to labels table
    const query = `
      INSERT INTO labels (do_number, file_name, file_path, file_url, label_count, barcodes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const result = await pool.query(query, [
      doNumber,
      filename,
      filepath,
      fileUrl,
      barcodes.length,
      JSON.stringify(barcodes)
    ]);

    // Update job with label URL
    await pool.query(
      'UPDATE jobs SET label_url = $1 WHERE do_number = $2',
      [fileUrl, doNumber]
    );

    console.log(`✅ Labels saved: ${filename} (ID: ${result.rows[0].id})`);

    return res.json({
      success: true,
      id: result.rows[0].id,
      filename: filename,
      url: fileUrl,
      doNumber: doNumber,
      labelCount: barcodes.length,
      barcodes: barcodes
    });

  } catch (error) {
    console.error('❌ Error generating labels:', error);
    return res.status(500).json({
      error: 'Failed to generate shipping labels',
      details: error.message
    });
  }
});

// API Endpoint: Download shipping labels
app.get('/api/download-labels/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(labelsDir, filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filepath, filename);
  } catch (error) {
    console.error('❌ Error downloading labels:', error);
    return res.status(500).json({
      error: 'Failed to download labels',
      details: error.message
    });
  }
});

// API Endpoint: Get labels for a job
app.get('/api/labels/:doNumber', async (req, res) => {
  try {
    const doNumber = req.params.doNumber;

    const result = await pool.query(
      'SELECT * FROM labels WHERE do_number = $1 ORDER BY created_at DESC',
      [doNumber]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching labels:', error);
    res.status(500).json({ error: 'Failed to fetch labels' });
  }
});

// API Endpoint: Upload label manually
app.post('/api/upload-label', uploadLabel.single('label'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { doNumber, boxNumber } = req.body;
    const filepath = req.file.path;
    const filename = req.file.filename;
    const fileUrl = `/uploads/labels/${filename}`;

    // Save to database
    const query = `
      INSERT INTO labels (do_number, file_name, file_path, file_url, label_count, barcodes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const result = await pool.query(query, [
      doNumber,
      filename,
      filepath,
      fileUrl,
      1,
      JSON.stringify([])
    ]);

    res.json({
      success: true,
      id: result.rows[0].id,
      filename: filename,
      url: fileUrl,
      doNumber: doNumber
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload label' });
  }
});

// API Endpoint: Delete label
app.delete('/api/labels/:id', async (req, res) => {
  try {
    const id = req.params.id;

    // Get file path first
    const result = await pool.query(
      'SELECT file_path FROM labels WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Label not found' });
    }

    const filepath = result.rows[0].file_path;

    // Delete file
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    // Delete from database
    await pool.query('DELETE FROM labels WHERE id = $1', [id]);

    res.json({ success: true, message: 'Label deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete label' });
  }
});

// ============== TEST ROUTES ==============
app.get('/', (req, res) => {
  res.json({
    status: '✅ Server is running',
    message: 'Detrack API integration with PostgreSQL is ready',
    endpoints: {
      'POST /api/upload-manifest': 'Upload Excel file and create jobs',
      'POST /api/create-job': 'Create a single job directly',
      'POST /api/generate-labels': 'Generate shipping labels',
      'GET /api/download-labels/:filename': 'Download shipping labels',
      'GET /api/labels/:doNumber': 'Get labels for a job',
      'POST /api/upload-label': 'Upload a label manually',
      'DELETE /api/labels/:id': 'Delete a label',
      'GET /api/db-jobs': 'Get all jobs from database',
      'GET /api/db-jobs/:id': 'Get single job from database',
      'GET /api/job-by-donumber': 'Get job by DO number from Detrack',
      'GET /api/jobs': 'Get all jobs from Detrack API',
      'GET /api/test': 'Test endpoint'
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    status: '✅ Server is running',
    message: 'Detrack API integration is working',
    timestamp: new Date().toISOString(),
    apiKeyLoaded: !!DETRACK_API_KEY,
    apiKeyPreview: DETRACK_API_KEY ? DETRACK_API_KEY.substring(0, 10) + '...' : 'Not loaded'
  });
});

// ============== JOB ENDPOINTS (Detrack API) ==============
app.get('/api/jobs', async (req, res) => {
  try {
    console.log('📡 Fetching jobs from Detrack...');

    const response = await axios.get('https://app.detrack.com/api/v2/dn/jobs', {
      headers: {
        'X-API-KEY': DETRACK_API_KEY
      }
    });

    console.log(`✅ Fetched ${response.data?.data?.length || 0} jobs from Detrack`);

    return res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('❌ Fetch jobs error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch jobs from Detrack',
      details: error.response?.data?.message || error.message
    });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  try {
    const jobId = req.params.id;
    console.log(`📡 Fetching job ${jobId} from Detrack...`);

    const response = await axios.get(`https://app.detrack.com/api/v2/dn/jobs/${jobId}`, {
      headers: {
        'X-API-KEY': DETRACK_API_KEY
      }
    });

    return res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('❌ Fetch job error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch job',
      details: error.response?.data?.message || error.message
    });
  }
});

// ============== VEHICLE ENDPOINTS ==============
app.get('/api/vehicles', async (req, res) => {
  try {
    const response = await axios.get('https://app.detrack.com/api/v2/vehicles', {
      headers: {
        'X-API-KEY': DETRACK_API_KEY
      }
    });
    return res.json(response.data);
  } catch (error) {
    console.error('Vehicles fetch error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch vehicles',
      details: error.message
    });
  }
});

// ============== UPLOAD ENDPOINT ==============

// Helper: Get value from row with fallbacks
const getValue = (row, ...keys) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== '' && row[key] !== null) {
      return row[key];
    }
  }
  return '';
};

// Helper: Get number from row with fallbacks
const getNumber = (row, ...keys) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== '' && value !== null) {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) return parsed;
      }
    }
  }
  return 0;
};

// Helper: Convert Excel date and ensure it's today or future
const getValidDate = (excelDate) => {
  let dateStr;

  if (typeof excelDate === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + excelDate * 86400000);
    dateStr = date.toISOString().split('T')[0];
  } else if (typeof excelDate === 'string' && excelDate.includes(' ')) {
    dateStr = excelDate.split(' ')[0];
  } else if (typeof excelDate === 'string') {
    try {
      const parsed = new Date(excelDate);
      if (!isNaN(parsed.getTime())) {
        dateStr = parsed.toISOString().split('T')[0];
      } else {
        dateStr = excelDate;
      }
    } catch (e) {
      dateStr = excelDate;
    }
  } else {
    dateStr = new Date().toISOString().split('T')[0];
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    dateStr = new Date().toISOString().split('T')[0];
  }

  const today = new Date().toISOString().split('T')[0];
  if (dateStr < today) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    dateStr = futureDate.toISOString().split('T')[0];
    console.log(`📅 Date was in the past (${excelDate}), using ${dateStr} instead`);
  }

  return dateStr;
};

// V2 API Valid Fields
const V2_VALID_FIELDS = [
  'date', 'do_number', 'address', 'deliver_to', 'phone', 'notify_email',
  'instructions', 'group', 'delivery_type', 'time_window', 'cartons',
  'boxes', 'weight', 'pieces', 'pallets', 'address_1', 'address_2',
  'postal_code', 'city', 'state', 'country', 'latitude', 'longitude',
  'company_name', 'zone', 'assign_to', 'run_no', 'depot',
  'reason', 'received_by', 'note', 'remarks', 'carrier',
  'payment_mode', 'payment_amount', 'invoice_no', 'account_no',
  'delivery_sequence', 'service_type', 'service_time', 'start_time',
  'end_time', 'depot_contact', 'depot_contact_no', 'depot_address',
  'payment_collected', 'auto_reschedule', 'attachment_url'
];

// API Endpoint: Upload Excel and create jobs (NO LABELS GENERATED)
app.post('/api/upload-manifest', upload.single('file'), async (req, res) => {
  try {
    console.log('📁 File upload received');
    console.log('📄 File name:', req.file.originalname);
    console.log('📏 File size:', req.file.size, 'bytes');

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    console.log('📋 Sheet name:', sheetName);

    const worksheet = workbook.Sheets[sheetName];

    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    console.log('📊 RAW DATA - Total rows:', rawData.length);

    let headerRowIndex = -1;
    let dataStartIndex = -1;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (row && row.length > 0) {
        const rowStr = row.join(' ').toLowerCase();
        if (rowStr.includes('d.o. no') || rowStr.includes('do no') || rowStr.includes('tracking no')) {
          headerRowIndex = i;
          dataStartIndex = i + 1;
          console.log(`🔍 Found header row at index ${i}`);
          break;
        }
      }
    }

    if (headerRowIndex === -1) {
      console.log('❌ No header row found in Excel file');
      return res.status(400).json({
        error: 'No header row found in Excel file',
        debug: { totalRows: rawData.length }
      });
    }

    const headers = rawData[headerRowIndex].map(h => h?.toString().trim() || '');
    console.log('📋 Headers found:', headers.slice(0, 10), '...');

    const dataRows = [];
    for (let i = dataStartIndex; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.every(cell => !cell || cell === '')) continue;

      const obj = {};
      headers.forEach((header, idx) => {
        const cleanHeader = header.trim();
        obj[cleanHeader] = row[idx] || '';
      });
      dataRows.push(obj);
    }

    console.log('📊 Data rows extracted:', dataRows.length);
    if (dataRows.length > 0) {
      console.log('📊 First data row sample:', JSON.stringify(dataRows[0], null, 2));
    }

    if (dataRows.length === 0) {
      return res.status(400).json({
        error: 'No data rows found after header row'
      });
    }

    const validRows = [];
    const errors = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowErrors = [];

      const hasData = Object.values(row).some(v => v && v !== '');
      if (!hasData) continue;

      const doNumber = getValue(row, 'D.O. No.', 'Tracking No.', 'DO No');
      const address = getValue(row, 'Address 1', 'Address');

      if (!doNumber) rowErrors.push('Missing D.O. No.');
      if (!address) rowErrors.push('Missing Address');

      if (rowErrors.length > 0) {
        errors.push({
          row: i + 1,
          doNumber: doNumber || 'Unknown',
          errors: rowErrors
        });
      } else {
        validRows.push(row);
      }
    }

    console.log(`✅ Valid rows: ${validRows.length}`);
    console.log(`❌ Errors: ${errors.length}`);

    if (validRows.length === 0) {
      return res.status(400).json({
        error: 'No valid rows found in the Excel file',
        errors: errors,
        sampleData: dataRows.slice(0, 3)
      });
    }

    const jobs = [];

    for (const row of validRows) {
      const doNumber = getValue(row, 'D.O. No.', 'Tracking No.', 'DO No', 'Order No.').toString().trim();

      const dateStr = getValidDate(getValue(row, 'Date', 'Processing Date'));

      const address = getValue(row, 'Address 1', 'Address');
      const address2 = getValue(row, 'Address 2');
      const city = getValue(row, 'City');
      const state = getValue(row, 'State');
      const postalCode = getValue(row, 'Postal Code');
      const country = getValue(row, 'Country');

      const fullAddress = [address, address2, city, state, postalCode, country]
        .filter(Boolean)
        .join(', ');

      const deliverTo = getValue(row, 'Deliver to', 'Deliver To');
      const recipientName = deliverTo;

      const timeWindow = getValue(row, 'Time Window', '07:00-18:00');

      const noOfShippingLabels = getNumber(row, 'No. of Shipping Labels', 'Cartons');
      const cartons = getNumber(row, 'Cartons', 'No. of Shipping Labels');
      const boxes = noOfShippingLabels || cartons || 1;

      console.log(`📦 D.O. ${doNumber}: No. of Shipping Labels = ${noOfShippingLabels}, Cartons = ${cartons}, Boxes = ${boxes}`);

      const job = {
        date: dateStr,
        do_number: doNumber || `DO-${Date.now()}`,
        address: fullAddress || address || 'Address not provided',
        deliver_to: recipientName || 'Unknown Recipient',
        phone: getValue(row, 'Phone No.', 'Phone'),
        notify_email: getValue(row, 'Notify Email', 'Notify email'),
        instructions: getValue(row, 'Instructions'),
        group: getValue(row, 'Group'),
        delivery_type: getValue(row, 'Delivery Type', 'Job type', 'Home Delivery'),
        time_window: timeWindow,
        cartons: cartons,
        boxes: boxes,
        weight: getNumber(row, 'Weight'),
        pieces: getNumber(row, 'Pieces'),
        pallets: getNumber(row, 'Pallets'),
        address_1: address,
        address_2: address2,
        postal_code: postalCode,
        city: city,
        state: state,
        country: country,
        latitude: getValue(row, 'Latitude', 'Lat'),
        longitude: getValue(row, 'Longitude', 'Lng'),
        company_name: getValue(row, 'Company Name'),
        zone: getValue(row, 'Zone'),
        assign_to: getValue(row, 'Assign to'),
        run_no: getValue(row, 'Run No.'),
        depot: getValue(row, 'Depot'),
        reason: getValue(row, 'Reason'),
        received_by: getValue(row, 'Received by'),
        note: getValue(row, 'Note'),
        remarks: getValue(row, 'Remarks'),
        carrier: getValue(row, 'Carrier'),
        payment_mode: getValue(row, 'Payment mode'),
        payment_amount: getNumber(row, 'Payment Amount'),
        invoice_no: getValue(row, 'Invoice No.'),
        account_no: getValue(row, 'Account No.'),
        delivery_sequence: getNumber(row, 'Delivery Sequence'),
        service_type: getValue(row, 'Service type'),
        service_time: getValue(row, 'Service Time'),
        start_time: getValue(row, 'Start Time'),
        end_time: getValue(row, 'End Time'),
        depot_contact: getValue(row, 'Depot Contact'),
        depot_contact_no: getValue(row, 'Depot Contact No.'),
        depot_address: getValue(row, 'Depot Address'),
        payment_collected: getValue(row, 'Payment Collected') === 'true' ? true : false,
        auto_reschedule: getValue(row, 'Auto Reschedule Delivery') === 'true' ? true : false,
        attachment_url: getValue(row, 'Attachment (URL)'),
      };

      const totalBoxes = boxes || cartons || 1;
      const barcodes = [];
      for (let c = 0; c < totalBoxes; c++) {
        barcodes.push(`${doNumber}-${String(c + 1).padStart(2, '0')}`);
      }
      job.barcodes = barcodes;

      jobs.push(job);
    }

    console.log(`📦 Parsed ${jobs.length} jobs from Excel`);
    if (jobs.length > 0) {
      console.log('📋 First job sample:', JSON.stringify(jobs[0], null, 2));
    }

    const results = [];
    const failedJobs = [];

    console.log(`🚀 Creating ${jobs.length} jobs in Detrack...`);

    for (const job of jobs) {
      try {
        console.log(`   Creating job: ${job.do_number} with ${job.boxes} boxes on ${job.date}`);

        const payload = { data: {} };

        Object.keys(job).forEach(key => {
          if (key !== 'barcodes' && V2_VALID_FIELDS.includes(key) && job[key] !== '' && job[key] !== null && job[key] !== undefined) {
            payload.data[key] = job[key];
          }
        });

        const response = await axios.post(DETRACK_API_URL, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': DETRACK_API_KEY
          }
        });

        if (response.data && response.data.data && response.data.data.id) {
          const detrackId = response.data.data.id;

          // Save job to PostgreSQL (NO LABELS GENERATED HERE)
          const query = `
            INSERT INTO jobs (
              do_number, customer_name, customer_company, phone, 
              delivery_address, postcode, recipient_name, recipient_phone,
              boxes, weight, contents, status, scheduled_date,
              special_instructions, barcodes, detrack_id, source,
              group_name, pickup_address, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
            ON CONFLICT (do_number) DO UPDATE SET
              customer_name = EXCLUDED.customer_name,
              customer_company = EXCLUDED.customer_company,
              phone = EXCLUDED.phone,
              delivery_address = EXCLUDED.delivery_address,
              postcode = EXCLUDED.postcode,
              recipient_name = EXCLUDED.recipient_name,
              recipient_phone = EXCLUDED.recipient_phone,
              boxes = EXCLUDED.boxes,
              weight = EXCLUDED.weight,
              contents = EXCLUDED.contents,
              status = EXCLUDED.status,
              scheduled_date = EXCLUDED.scheduled_date,
              special_instructions = EXCLUDED.special_instructions,
              barcodes = EXCLUDED.barcodes,
              detrack_id = EXCLUDED.detrack_id,
              group_name = EXCLUDED.group_name,
              pickup_address = EXCLUDED.pickup_address,
              updated_at = CURRENT_TIMESTAMP
          `;

          await pool.query(query, [
            job.do_number,
            job.deliver_to || job.customer_name || '',
            job.company_name || '',
            job.phone || '',
            job.address || '',
            job.postal_code || '',
            job.deliver_to || '',
            job.phone || '',
            job.boxes || 1,
            job.weight || 0,
            job.instructions || '',
            'pending',
            job.date || null,
            job.instructions || '',
            JSON.stringify(job.barcodes || []),
            detrackId,
            'customer',
            job.group || '',
            job.pickup_address || '',
            new Date().toISOString(),
            new Date().toISOString()
          ]);

          results.push({
            do_number: job.do_number,
            status: 'success',
            detrack_id: detrackId,
            date: job.date,
            boxes: job.boxes,
            barcodes: job.barcodes
          });
          console.log(`   ✅ Job ${job.do_number} created with ID: ${detrackId} (${job.boxes} boxes)`);
        } else {
          console.log(`   ⚠️ Job ${job.do_number} response:`, response.data);
          failedJobs.push({
            do_number: job.do_number,
            error: response.data?.message || 'Unknown error',
            details: response.data || {}
          });
        }

      } catch (error) {
        console.error(`   ❌ Failed to create ${job.do_number}:`, error.response?.data || error.message);
        failedJobs.push({
          do_number: job.do_number,
          error: error.response?.data?.message || error.message,
          details: error.response?.data || {}
        });
      }
    }

    // ===== NO LABELS GENERATED DURING UPLOAD =====
    // Labels are only generated when user clicks "Generate Labels" button
    // No labelResults array, no labels table updates

    return res.json({
      success: true,
      total: jobs.length,
      created: results.length,
      failed: failedJobs.length,
      results: results,
      failedJobs: failedJobs,
      validationErrors: errors,
      debug: {
        totalRows: dataRows.length,
        validRows: validRows.length,
        jobsParsed: jobs.length
      }
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    return res.status(500).json({
      error: 'Failed to process upload',
      details: error.message,
      stack: error.stack
    });
  }
});

// ============== 404 HANDLER ==============
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/test',
      'GET /api/db-jobs',
      'GET /api/db-jobs/:id',
      'GET /api/job-by-donumber',
      'GET /api/jobs',
      'GET /api/jobs/:id',
      'POST /api/upload-manifest',
      'POST /api/create-job',
      'POST /api/generate-labels',
      'GET /api/download-labels/:filename',
      'GET /api/labels/:doNumber',
      'POST /api/upload-label',
      'DELETE /api/labels/:id',
      'GET /api/vehicles'
    ]
  });
});

// Start server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 Test endpoint: http://localhost:${PORT}/api/test`);
  console.log(`📡 Health endpoint: http://localhost:${PORT}/api/health`);
  console.log(`📡 Database Jobs endpoint: http://localhost:${PORT}/api/db-jobs`);
  console.log(`📡 Detrack Jobs endpoint: http://localhost:${PORT}/api/jobs`);
  console.log(`📡 Create Job endpoint: http://localhost:${PORT}/api/create-job`);
  console.log(`📡 Labels endpoint: http://localhost:${PORT}/api/generate-labels`);
  console.log(`🔑 API Key loaded: ${DETRACK_API_KEY ? 'Yes' : 'No'}`);
  console.log(`📁 Uploads folder: ${uploadsDir}`);
  console.log(`📁 Labels folder: ${labelsDir}`);
  console.log(`🗄️ Database: Connected to detrack_db`);
  console.log(`📁 Waiting for requests...`);
});