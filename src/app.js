// src/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { corsOptions } = require('./config/cors');
const { errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// ===== MIDDLEWARE =====
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== STATIC FILES =====
const uploadsDir = path.join(__dirname, '../uploads');
const labelsDir = path.join(uploadsDir, 'labels');

app.use('/uploads', express.static(uploadsDir));
app.use('/uploads/labels', express.static(labelsDir));
app.use('/api/uploads/labels', express.static(labelsDir));

// ===== ROUTES =====
app.use('/api', routes);

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  const { pool } = require('./config/database');
  pool.query('SELECT 1')
    .then(() => {
      res.json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    })
    .catch((error) => {
      res.status(500).json({
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message
      });
    });
});

// ===== TEST ROUTE =====
app.get('/api/test', (req, res) => {
  res.json({
    status: '✅ Server is running',
    message: 'Detrack API integration is working',
    timestamp: new Date().toISOString(),
    apiKeyLoaded: !!process.env.DETRACK_API_KEY,
    apiKeyPreview: process.env.DETRACK_API_KEY ? process.env.DETRACK_API_KEY.substring(0, 10) + '...' : 'Not loaded'
  });
});

// ===== ROOT ROUTE =====
app.get('/', (req, res) => {
  res.json({
    status: '✅ Server is running',
    message: 'Detrack API integration with PostgreSQL and Authentication is ready',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register a new user',
        'POST /api/auth/login': 'Login user',
        'GET /api/auth/me': 'Get current user (authenticated)',
        'POST /api/auth/logout': 'Logout (authenticated)',
      },
      admin: {
        'GET /api/admin/users': 'Get all users (admin only)',
        'POST /api/admin/users': 'Create user (admin only)',
        'PATCH /api/admin/users/:userId/status': 'Update user status (admin only)',
        'PATCH /api/admin/users/:userId/role': 'Update user role (admin only)',
        'DELETE /api/admin/users/:userId': 'Delete user (admin only)',
      },
      jobs: {
        'GET /api/db-jobs': 'Get jobs from database',
        'GET /api/db-jobs/:id': 'Get single job from database',
        'POST /api/create-job': 'Create a single job',
        'POST /api/upload-manifest': 'Upload Excel and create jobs',
      },
      labels: {
        'POST /api/generate-labels': 'Generate shipping labels',
        'GET /api/download-labels/:filename': 'Download shipping labels',
        'GET /api/labels/:doNumber': 'Get labels for a job',
        'POST /api/upload-label': 'Upload a label manually',
        'DELETE /api/labels/:id': 'Delete a label',
      },
      detrack: {
        'GET /api/jobs': 'Get jobs from Detrack API',
        'GET /api/jobs/:id': 'Get single job from Detrack API',
        'GET /api/job-by-donumber': 'Get job by DO number from Detrack',
      },
      vehicles: {
        'GET /api/vehicles': 'Get vehicles from Detrack API',
      },
    },
    timestamp: new Date().toISOString()
  });
});

// ===== 404 HANDLER =====
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/test',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/auth/me',
      'GET /api/admin/users',
      'POST /api/admin/users',
      'PATCH /api/admin/users/:userId/status',
      'PATCH /api/admin/users/:userId/role',
      'DELETE /api/admin/users/:userId',
      'GET /api/db-jobs',
      'GET /api/db-jobs/:id',
      'POST /api/create-job',
      'POST /api/upload-manifest',
      'POST /api/generate-labels',
      'GET /api/download-labels/:filename',
      'GET /api/labels/:doNumber',
      'POST /api/upload-label',
      'DELETE /api/labels/:id',
      'GET /api/jobs',
      'GET /api/jobs/:id',
      'GET /api/job-by-donumber',
      'GET /api/vehicles'
    ]
  });
});

// ===== ERROR HANDLER =====
app.use(errorHandler);

module.exports = app;