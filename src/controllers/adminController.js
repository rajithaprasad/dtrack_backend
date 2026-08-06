// src/controllers/adminController.js
const bcrypt = require('bcrypt');
const User = require('../models/User');

// ===== ADMIN: GET ALL USERS =====
exports.getUsers = async (req, res) => {
  try {
    const users = await User.getAll();
    res.json({
      success: true,
      users: users.map(user => ({
        ...user,
        group_id: user.group_id || null,
        group_name: user.group_name || null
      }))
    });
  } catch (error) {
    console.error('❌ Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
};

// ===== ADMIN: GET CUSTOMERS ONLY =====
exports.getCustomers = async (req, res) => {
  try {
    const customers = await User.getAllCustomers();
    res.json({
      success: true,
      customers
    });
  } catch (error) {
    console.error('❌ Get customers error:', error);
    res.status(500).json({ error: 'Failed to get customers' });
  }
};

// ===== ADMIN: GET STAFF ONLY =====
exports.getStaff = async (req, res) => {
  try {
    const staff = await User.getAllStaff();
    res.json({
      success: true,
      staff
    });
  } catch (error) {
    console.error('❌ Get staff error:', error);
    res.status(500).json({ error: 'Failed to get staff' });
  }
};

// ===== ADMIN: CREATE STAFF/ADMIN ACCOUNT =====
exports.createUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, companyName, phone, address } = req.body;

    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({
        error: 'Missing required fields: email, password, firstName, lastName, role'
      });
    }

    if (!['staff', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be staff or admin' });
    }

    const existingUser = await User.findByEmail(email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role,
      companyName,
      companyType: 'internal',
      phone,
      address,
      groupId: null,
      groupName: null
    });

    console.log(`✅ Admin created new user: ${newUser.email} (${newUser.role})`);

    res.status(201).json({
      success: true,
      message: `User created successfully with role: ${role}`,
      user: newUser
    });

  } catch (error) {
    console.error('❌ Admin create user error:', error);
    res.status(500).json({
      error: 'Failed to create user',
      details: error.message
    });
  }
};

// ===== ADMIN: CREATE CUSTOMER WITH GROUP =====
exports.createCustomer = async (req, res) => {
  try {
    const { 
      email, password, firstName, lastName, 
      companyName, phone, address,
      groupId, groupName
    } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Missing required fields: email, password, firstName, lastName'
      });
    }

    if (!groupId) {
      return res.status(400).json({ error: 'Group selection is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findByEmail(email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Check if group already has a customer
    const existingCustomer = await User.findCustomerByGroup(groupId);
    if (existingCustomer) {
      return res.status(409).json({ 
        error: 'This group already has a customer account',
        existingCustomer: {
          id: existingCustomer.id,
          email: existingCustomer.email,
          name: `${existingCustomer.first_name} ${existingCustomer.last_name}`,
          company: existingCustomer.company_name
        }
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role: 'customer',
      companyName,
      companyType: 'detrack_customer',
      phone,
      address,
      groupId,
      groupName
    });

    console.log(`✅ Admin created customer: ${newUser.email} for group: ${groupName}`);

    res.status(201).json({
      success: true,
      message: 'Customer account created successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        role: newUser.role,
        companyName: newUser.company_name,
        groupId: newUser.group_id,
        groupName: newUser.group_name
      }
    });

  } catch (error) {
    console.error('❌ Admin create customer error:', error);
    res.status(500).json({
      error: 'Failed to create customer',
      details: error.message
    });
  }
};

// ===== ADMIN: UPDATE USER STATUS =====
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    if (parseInt(userId) === req.user.id) {
      return res.status(403).json({ error: 'Cannot change your own status' });
    }

    const user = await User.updateStatus(userId, status);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`✅ Admin updated user ${user.email} status to ${status}`);

    res.json({
      success: true,
      message: `User status updated to ${status}`,
      user
    });
  } catch (error) {
    console.error('❌ Update user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
};

// ===== ADMIN: UPDATE USER ROLE =====
exports.updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['customer', 'staff', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (parseInt(userId) === req.user.id) {
      return res.status(403).json({ error: 'Cannot change your own role' });
    }

    const user = await User.updateRole(userId, role);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`✅ Admin updated user ${user.email} role to ${role}`);

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user
    });
  } catch (error) {
    console.error('❌ Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
};

// ===== ADMIN: DELETE USER =====
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (parseInt(userId) === req.user.id) {
      return res.status(403).json({ error: 'Cannot delete your own account' });
    }

    const user = await User.delete(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`✅ Admin deleted user: ${user.email}`);

    res.json({
      success: true,
      message: 'User deleted successfully',
      user
    });
  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};
