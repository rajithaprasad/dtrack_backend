// src/routes/jobRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const jobController = require('../controllers/jobController');

// All routes require authentication
router.use(authenticate);

// Database jobs
router.get('/db-jobs', jobController.getJobs);
router.get('/db-jobs/:id', jobController.getJob);

// Create jobs
router.post('/create-job', jobController.createJob);
router.post('/upload-manifest', upload.single('file'), jobController.uploadManifest);

// Detrack API jobs
router.get('/jobs', jobController.getDetrackJobs);
router.get('/jobs/:id', jobController.getDetrackJob);
router.get('/job-by-donumber', jobController.getJobByDoNumber);

// ===== BOX SCANNING ROUTES =====
// Get box status for a job
router.get('/box-status/:do_number', jobController.getBoxStatus);

// Scan a single box (Mobile App)
router.post('/scan-box', jobController.scanBox);
router.get('/dashboard-stats', jobController.getDashboardStats);

// Bulk scan multiple boxes
router.post('/bulk-scan', jobController.bulkScan);
router.get('/groups', jobController.getGroups);
router.get('/groups/search-all', jobController.searchAllGroups);
module.exports = router;