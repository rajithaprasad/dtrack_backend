// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// All routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
router.patch('/users/:userId/status', adminController.updateUserStatus);
router.patch('/users/:userId/role', adminController.updateUserRole);
router.delete('/users/:userId', adminController.deleteUser);

module.exports = router;