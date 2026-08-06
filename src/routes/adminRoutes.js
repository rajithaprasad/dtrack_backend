// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// All routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// User management
router.get('/users', adminController.getUsers);
router.get('/users/customers', adminController.getCustomers);
router.get('/users/staff', adminController.getStaff);
router.post('/users', adminController.createUser);
router.post('/users/customer', adminController.createCustomer);
router.patch('/users/:userId/status', adminController.updateUserStatus);
router.patch('/users/:userId/role', adminController.updateUserRole);
router.delete('/users/:userId', adminController.deleteUser);

// 🔥 NEW: Check if group has customer
router.get('/groups/:groupId/customer', adminController.checkGroupCustomer);

module.exports = router;
