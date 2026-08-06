// src/routes/index.js
const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const adminRoutes = require('./adminRoutes');
const jobRoutes = require('./jobRoutes');
const labelRoutes = require('./labelRoutes');
const vehicleController = require('../controllers/vehicleController');
const { authenticate } = require('../middleware/auth');

// Register all route modules
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/', jobRoutes);
router.use('/', labelRoutes);

// Vehicle routes
router.get('/vehicles', authenticate, vehicleController.getVehicles);

module.exports = router;