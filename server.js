const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// ==================== EST TIMEZONE UTILITIES ====================
/**
 * Get current time in EST timezone
 */
function getNowEST() {
  const now = new Date();
  const estFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = estFormatter.formatToParts(now);
  const estDate = new Date(
    parseInt(parts.find(p => p.type === 'year').value),
    parseInt(parts.find(p => p.type === 'month').value) - 1,
    parseInt(parts.find(p => p.type === 'day').value),
    parseInt(parts.find(p => p.type === 'hour').value),
    parseInt(parts.find(p => p.type === 'minute').value),
    parseInt(parts.find(p => p.type === 'second').value)
  );
  
  return estDate;
}

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mnyc_claims';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ==================== SCHEMAS ====================

// User Schema
const userSchema = new mongoose.Schema({
  odoo_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, default: null },
  password: { type: String, required: true },
  role: { type: String, enum: ['master', 'admin', 'agent'], default: 'agent' },
  avatar: String,
  color: String,
  isDefaultPassword: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Activity Log Schema
const activityLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // 'edit', 'share', 'delete', 'restore', 'create', 'transfer'
  claimId: { type: String, default: null },
  claimNo: { type: String, default: null },
  performedBy: { type: String, required: true }, // user odoo_id
  performedByName: { type: String, required: true },
  details: { type: String, default: null }, // What changed
  oldValue: { type: String, default: null },
  newValue: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
  userRole: { type: String, enum: ['master', 'admin', 'agent'] }
});

// Deleted Claims Schema (for restoration)
const deletedClaimSchema = new mongoose.Schema({
  claimData: { type: Object, required: true }, // Full claim data backup
  deletedBy: { type: String, required: true }, // user odoo_id
  deletedByName: { type: String, required: true },
  deletedAt: { type: Date, default: Date.now },
  restoredAt: { type: Date, default: null },
  restoredBy: { type: String, default: null }
});

// Claim Schema
const claimSchema = new mongoose.Schema({
  claimNo: { type: String, required: true, unique: true },
  patient: { type: String, required: true },
  balance: { type: Number, default: 0 },
  // New fields
  dos: { type: Date, default: null }, // Date of Service
  visitType: { type: String, default: null },
  acctNo: { type: String, default: null }, // Account Number
  primaryPayer: { type: String, default: null },
  billedCharges: { type: Number, default: 0 },
  priority: { type: String, default: null }, // P-1, P-2, CHERRY, etc.
  age: { type: Number, default: null }, // Age in days
  ageBucket: { type: String, default: null }, // Age bucket category
  // Assignment fields
  assignedTo: { type: String, default: null },
  sharedWith: [String],
  status: { type: String, default: null },
  actionTaken: { type: String, default: null },
  dateWorked: { type: Date, default: null },
  nextFollowUp: { type: Date, default: null },
  lastWorkedBy: { type: String, default: null },
  history: [{
    remarks: String,
    status: String,
    actionTaken: String,
    dateWorked: Date,
    nextFollowUp: Date,
    workedBy: String
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Claim = mongoose.model('Claim', claimSchema);
const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
const DeletedClaim = mongoose.model('DeletedClaim', deletedClaimSchema);

// Create master admin user if it doesn't exist
async function createMasterAdmin() {
  try {
    const masterExists = await User.findOne({ odoo_id: 'master.mnyc' });
    if (!masterExists) {
      const masterUser = new User({
        odoo_id: 'master.mnyc',
        name: 'Site Administrator',
        email: 'admin@mnyc.local',
        password: 'Shubh@0924',
        role: 'master',
        avatar: 'M',
        color: '#000000',
        isDefaultPassword: false
      });
      await masterUser.save();
      console.log('✅ Master admin user created successfully');
    }
  } catch (error) {
    console.error('Error creating master admin:', error);
  }
}

// Create master admin on startup
createMasterAdmin();

// ==================== USER ROUTES ====================

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connecting... Please wait and try again.' });
    }
    
    const user = await User.findOne({ odoo_id: username.toLowerCase() });
    
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.json({
      id: user.odoo_id.toUpperCase(),
      odoo_id: user.odoo_id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      color: user.color,
      isDefaultPassword: user.isDefaultPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Get all users (for admin/master)
app.get('/api/users', async (req, res) => {
  try {
    // Don't show master user to anyone except master themselves
    const users = await User.find({ role: { $in: ['agent', 'admin'] } }).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single user
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findOne({ odoo_id: req.params.id }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new user (admin only)
app.post('/api/users', async (req, res) => {
  try {
    const { username, name, email, password, color } = req.body;
    
    if (!username || !name || !password) {
      return res.status(400).json({ error: 'Username, name, and password are required' });
    }
    
    // Check if user already exists
    const existing = await User.findOne({ odoo_id: username.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Generate avatar from first letter of name
    const avatar = name.charAt(0).toUpperCase();
    
    // Get next employee ID
    const agentCount = await User.countDocuments({ role: 'agent' });
    const empId = `EMP00${agentCount + 1}`;
    
    const user = new User({
      odoo_id: username.toLowerCase(),
      name,
      email: email || null,
      password,
      role: 'agent',
      avatar,
      color: color || '#' + Math.floor(Math.random()*16777215).toString(16),
      isDefaultPassword: true
    });
    
    await user.save();
    
    res.status(201).json({
      message: 'User created successfully',
      user: {
        odoo_id: user.odoo_id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        color: user.color,
        empId
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;
    const user = await User.findOne({ odoo_id: req.params.id });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to change password' });
      }
      if (user.password !== currentPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      user.password = newPassword;
      user.isDefaultPassword = false;
    }
    
    // Update other fields
    if (name) user.name = name;
    if (email !== undefined) user.email = email;
    if (name) user.avatar = name.charAt(0).toUpperCase();
    user.updatedAt = new Date(); // Store actual UTC time
    
    await user.save();
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        odoo_id: user.odoo_id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        color: user.color
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user (admin only)
app.delete('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ odoo_id: req.params.id, role: 'agent' });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Migrate existing users to have empId (one-time migration)
app.post('/api/users/migrate-empids', async (req, res) => {
  try {
    // Get all agents without empId, sorted by creation date
    const usersWithoutEmpId = await User.find({ 
      role: 'agent', 
      $or: [{ empId: { $exists: false } }, { empId: null }]
    }).sort({ createdAt: 1 });
    
    if (usersWithoutEmpId.length === 0) {
      return res.json({ message: 'All users already have empIds', migrated: 0 });
    }
    
    // Find highest existing empId
    const lastAgent = await User.findOne({ role: 'agent', empId: { $exists: true, $ne: null } })
      .sort({ empId: -1 })
      .limit(1);
    
    let nextEmpNum = 1;
    if (lastAgent && lastAgent.empId) {
      const lastNum = parseInt(lastAgent.empId.replace('EMP', ''), 10);
      if (!isNaN(lastNum)) nextEmpNum = lastNum + 1;
    }
    
    // Assign empIds to users without one
    for (const user of usersWithoutEmpId) {
      const empId = `EMP${String(nextEmpNum).padStart(3, '0')}`;
      await User.updateOne({ _id: user._id }, { $set: { empId } });
      nextEmpNum++;
    }
    
    res.json({ 
      message: 'Migration completed', 
      migrated: usersWithoutEmpId.length 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to check current user empIds and claim assignments
app.get('/api/debug/assignments', async (req, res) => {
  try {
    const users = await User.find({ role: 'agent' }).select('odoo_id name empId createdAt').sort({ createdAt: 1 });
    const claimsByAssignee = await Claim.aggregate([
      { $group: { _id: '$assignedTo', count: { $sum: 1 } } }
    ]);
    
    res.json({
      users: users.map(u => ({
        odoo_id: u.odoo_id,
        name: u.name,
        empId: u.empId,
        createdAt: u.createdAt
      })),
      claimAssignments: claimsByAssignee
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fix user empIds to match the original order (admin endpoint)
app.post('/api/users/fix-empids', async (req, res) => {
  try {
    // Define the correct empId mapping based on original system
    const correctMapping = {
      'ravi': 'EMP001',
      'shubham': 'EMP002', 
      'harsh': 'EMP003',
      'baby singh': 'EMP004',
      'babysingh': 'EMP004'
    };
    
    const updates = [];
    const agents = await User.find({ role: 'agent' });
    
    for (const agent of agents) {
      const nameLower = agent.name.toLowerCase();
      const odooIdLower = agent.odoo_id.toLowerCase();
      
      // Try to find correct empId by name or odoo_id
      let correctEmpId = correctMapping[nameLower] || correctMapping[odooIdLower];
      
      if (correctEmpId && agent.empId !== correctEmpId) {
        await User.updateOne({ _id: agent._id }, { $set: { empId: correctEmpId } });
        updates.push({ name: agent.name, oldEmpId: agent.empId, newEmpId: correctEmpId });
      }
    }
    
    res.json({
      message: 'EmpIds fixed',
      updates
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CLAIM ROUTES ====================

// Get all claims
app.get('/api/claims', async (req, res) => {
  try {
    const claims = await Claim.find().sort({ createdAt: -1 });
    res.json(claims);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single claim
app.get('/api/claims/:id', async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    res.json(claim);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new claim
app.post('/api/claims', async (req, res) => {
  try {
    const claim = new Claim(req.body);
    await claim.save();
    res.status(201).json(claim);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Claim number already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update claim
app.put('/api/claims/:id', async (req, res) => {
  try {
    req.body.updatedAt = new Date(); // Store actual UTC time
    const claim = await Claim.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    res.json(claim);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete claim
app.delete('/api/claims/:id', async (req, res) => {
  try {
    const { deletedByName, userRole } = req.query;
    
    const claim = await Claim.findByIdAndDelete(req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    
    // Save deleted claim for restoration
    const deletedClaimRecord = new DeletedClaim({
      claimData: claim.toObject(),
      deletedBy: deletedByName || 'unknown',
      deletedByName: deletedByName || 'Unknown User'
    });
    await deletedClaimRecord.save();
    
    // Log this action
    const log = new ActivityLog({
      action: 'delete_claim',
      claimId: claim._id,
      claimNo: claim.claimNo,
      performedBy: deletedByName,
      performedByName: deletedByName || 'Unknown User',
      details: `Deleted claim: ${claim.claimNo}`,
      userRole: userRole || 'admin'
    });
    await log.save();
    
    res.json({ message: 'Claim deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk import claims
app.post('/api/claims/bulk', async (req, res) => {
  try {
    const claims = req.body;
    const results = await Claim.insertMany(claims, { ordered: false });
    res.status(201).json({ imported: results.length });
  } catch (error) {
    if (error.writeErrors) {
      res.status(207).json({ 
        imported: error.insertedDocs?.length || 0,
        errors: error.writeErrors.length 
      });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// ==================== MASTER ADMIN ROUTES ====================

// Update user role to admin or agent (master only)
app.put('/api/users/:id/role', async (req, res) => {
  try {
    const { newRole, updatedByName, userRole } = req.body;
    
    // Only master admin can change roles
    if (userRole !== 'master') {
      return res.status(403).json({ error: 'Only master admin can change user roles' });
    }
    
    if (!['admin', 'agent'].includes(newRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const user = await User.findOne({ odoo_id: req.params.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const oldRole = user.role;
    user.role = newRole;
    await user.save();
    
    // Log this action
    const log = new ActivityLog({
      action: 'role_change',
      performedBy: updatedByName,
      performedByName: 'Master Admin',
      details: `Changed user ${user.name} role from ${oldRole} to ${newRole}`,
      oldValue: oldRole,
      newValue: newRole,
      userRole: 'master'
    });
    await log.save();
    
    res.json({ message: 'User role updated successfully', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create admin user (master only)
app.post('/api/users/create-admin', async (req, res) => {
  try {
    const { username, name, email, password, createdByName, userRole } = req.body;
    
    // Only master admin can create admin users
    if (userRole !== 'master') {
      return res.status(403).json({ error: 'Only master admin can create admin users' });
    }
    
    if (!username || !name || !password) {
      return res.status(400).json({ error: 'Username, name, and password are required' });
    }
    
    const existing = await User.findOne({ odoo_id: username.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const avatar = name.charAt(0).toUpperCase();
    const adminCount = await User.countDocuments({ role: 'admin' });
    const empId = `ADM00${adminCount + 1}`;
    
    const user = new User({
      odoo_id: username.toLowerCase(),
      name,
      email: email || null,
      password,
      role: 'admin',
      avatar,
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      isDefaultPassword: true
    });
    
    await user.save();
    
    // Log this action
    const log = new ActivityLog({
      action: 'create_admin',
      performedBy: createdByName,
      performedByName: 'Master Admin',
      details: `Created new admin user: ${name} (${username})`,
      newValue: username,
      userRole: 'master'
    });
    await log.save();
    
    res.status(201).json({
      message: 'Admin user created successfully',
      user: {
        odoo_id: user.odoo_id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        color: user.color,
        empId
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get activity logs (master only)
app.get('/api/logs', async (req, res) => {
  try {
    const { userRole, limit = 100, offset = 0, claimNo = null } = req.query;
    
    // Only master admin can view logs
    if (userRole !== 'master') {
      return res.status(403).json({ error: 'Only master admin can view activity logs' });
    }
    
    const query = {};
    if (claimNo) {
      query.claimNo = claimNo;
    }
    
    const logs = await ActivityLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    
    const total = await ActivityLog.countDocuments(query);
    
    res.json({
      logs,
      total,
      page: Math.floor(parseInt(offset) / parseInt(limit)) + 1
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Edit claim details (master only)
app.put('/api/claims/:id/edit-details', async (req, res) => {
  try {
    const { claimData, editedByName, userRole } = req.body;
    
    // Only master admin can edit claim details
    if (userRole !== 'master') {
      return res.status(403).json({ error: 'Only master admin can edit claim details' });
    }
    
    const claim = await Claim.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    
    // Track changes
    const changes = {};
    for (const key in claimData) {
      if (claim[key] !== claimData[key]) {
        changes[key] = {
          oldValue: claim[key],
          newValue: claimData[key]
        };
        claim[key] = claimData[key];
      }
    }
    
    claim.updatedAt = new Date();
    await claim.save();
    
    // Log this action
    const log = new ActivityLog({
      action: 'edit_claim_details',
      claimId: claim._id,
      claimNo: claim.claimNo,
      performedBy: editedByName,
      performedByName: 'Master Admin',
      details: `Edited claim details: ${JSON.stringify(changes)}`,
      userRole: 'master'
    });
    await log.save();
    
    res.json({ message: 'Claim details updated successfully', claim });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get deleted claims (master only)
app.get('/api/deleted-claims', async (req, res) => {
  try {
    const { userRole } = req.query;
    
    // Only master admin can view deleted claims
    if (userRole !== 'master') {
      return res.status(403).json({ error: 'Only master admin can view deleted claims' });
    }
    
    const deletedClaims = await DeletedClaim.find()
      .sort({ deletedAt: -1 });
    
    res.json(deletedClaims);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restore deleted claim (master only)
app.post('/api/deleted-claims/:id/restore', async (req, res) => {
  try {
    const { restoredByName, userRole } = req.body;
    
    // Only master admin can restore claims
    if (userRole !== 'master') {
      return res.status(403).json({ error: 'Only master admin can restore claims' });
    }
    
    const deletedClaim = await DeletedClaim.findById(req.params.id);
    if (!deletedClaim) {
      return res.status(404).json({ error: 'Deleted claim not found' });
    }
    
    // Restore the claim
    const restoredClaim = new Claim(deletedClaim.claimData);
    await restoredClaim.save();
    
    // Update deletion record
    deletedClaim.restoredAt = new Date();
    deletedClaim.restoredBy = restoredByName;
    await deletedClaim.save();
    
    // Log this action
    const log = new ActivityLog({
      action: 'restore_claim',
      claimId: restoredClaim._id,
      claimNo: restoredClaim.claimNo,
      performedBy: restoredByName,
      performedByName: 'Master Admin',
      details: `Restored deleted claim: ${restoredClaim.claimNo}`,
      userRole: 'master'
    });
    await log.save();
    
    res.json({ message: 'Claim restored successfully', claim: restoredClaim });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== REPORTING ROUTES ====================

// Get agent daily report (claims worked today)
app.get('/api/reports/agent/daily/:userId', async (req, res) => {
  try {
    // Get today's date in EST timezone for comparison
    const estDate = new Date();
    const estFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const parts = estFormatter.formatToParts(estDate);
    const today = new Date(
      parseInt(parts.find(p => p.type === 'year').value),
      parseInt(parts.find(p => p.type === 'month').value) - 1,
      parseInt(parts.find(p => p.type === 'day').value),
      0, 0, 0, 0
    );
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const claims = await Claim.find({
      assignedTo: req.params.userId,
      dateWorked: { $gte: today, $lt: tomorrow }
    }).sort({ dateWorked: -1 });
    
    res.json({
      date: today.toISOString().split('T')[0],
      userId: req.params.userId,
      totalClaims: claims.length,
      claims
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get agent report with date range
app.get('/api/reports/agent/:userId', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { assignedTo: req.params.userId };
    
    if (startDate || endDate) {
      query.dateWorked = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.dateWorked.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.dateWorked.$lte = end;
      }
    }
    
    const claims = await Claim.find(query).sort({ dateWorked: -1 });
    
    res.json({
      userId: req.params.userId,
      period: { startDate, endDate },
      totalClaims: claims.length,
      claims
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get admin report - all claims worked by an agent in date range
app.get('/api/reports/admin/agent/:userId', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { assignedTo: req.params.userId };
    
    if (startDate || endDate) {
      query.dateWorked = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.dateWorked.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.dateWorked.$lte = end;
      }
    }
    
    const claims = await Claim.find(query).sort({ dateWorked: -1 });
    const agent = await User.findOne({ odoo_id: req.params.userId }).select('-password');
    
    res.json({
      agent: agent ? { name: agent.name, odoo_id: agent.odoo_id } : null,
      period: { startDate, endDate },
      totalClaims: claims.length,
      claims
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get admin report - filtered claims
app.get('/api/reports/admin/claims', async (req, res) => {
  try {
    const { filterType, startDate, endDate } = req.query;
    const query = {};
    
    // Filter by type
    if (filterType === 'all') {
      // All claims in portal
      query.claimNo = { $exists: true };
    } else if (filterType === 'pending') {
      // Claims not worked by any agent (no dateWorked)
      query.dateWorked = null;
      query.status = { $ne: 'paid' };
    } else if (filterType === 'paid') {
      // Claims with paid status
      query.status = 'paid';
    } else if (filterType === 'overdue') {
      // Claims where nextFollowUp date has passed (in EST timezone)
      const estDate = new Date();
      const estFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = estFormatter.formatToParts(estDate);
      const today = new Date(
        parseInt(parts.find(p => p.type === 'year').value),
        parseInt(parts.find(p => p.type === 'month').value) - 1,
        parseInt(parts.find(p => p.type === 'day').value),
        0, 0, 0, 0
      );
      query.nextFollowUp = { $lt: today };
      query.status = { $ne: 'paid' };
    }
    
    // Apply date filter if provided
    if (startDate || endDate) {
      if (!query.dateWorked) query.dateWorked = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.dateWorked.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.dateWorked.$lte = end;
      }
    }
    
    const claims = await Claim.find(query).sort({ dateWorked: -1 });
    
    res.json({
      filterType,
      period: { startDate, endDate },
      totalClaims: claims.length,
      claims
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get admin stats
app.get('/api/reports/admin/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // All claims in portal
    const allClaims = await Claim.countDocuments({ claimNo: { $exists: true } });
    
    // Pending: not worked and not paid
    const pendingClaims = await Claim.countDocuments({
      dateWorked: null,
      status: { $ne: 'paid' }
    });
    
    // Paid claims
    const paidClaims = await Claim.countDocuments({ status: 'paid' });
    
    // Overdue: nextFollowUp date has passed and not paid
    const overdueClaims = await Claim.countDocuments({
      nextFollowUp: { $lt: today },
      status: { $ne: 'paid' }
    });
    
    res.json({
      all: allClaims,
      pending: pendingClaims,
      paid: paidClaims,
      overdue: overdueClaims
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SEED DATA ====================

async function seedDatabase() {
  try {
    // Check if users exist
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱 Seeding users...');
      await User.insertMany([
        { odoo_id: 'yashpal', name: 'Yashpal', email: 'yashpal@mnyc.com', password: 'admin123', role: 'admin', avatar: 'Y', color: '#7c3aed', isDefaultPassword: true },
        { odoo_id: 'shubham', name: 'Shubham', email: 'shubham@mnyc.com', password: 'pass123', role: 'agent', avatar: 'S', color: '#3b82f6', isDefaultPassword: true },
        { odoo_id: 'ravi', name: 'Ravi', email: 'ravi@mnyc.com', password: 'pass123', role: 'agent', avatar: 'R', color: '#10b981', isDefaultPassword: true },
        { odoo_id: 'chirag', name: 'Chirag', email: 'chirag@mnyc.com', password: 'pass123', role: 'agent', avatar: 'C', color: '#f59e0b', isDefaultPassword: true }
      ]);
      console.log('✅ Users seeded');
    }

    // Check if claims exist
    const claimCount = await Claim.countDocuments();
    if (claimCount === 0) {
      console.log('🌱 Seeding sample claims...');
      await Claim.insertMany([
        { 
          claimNo: 'CLM001', 
          patient: 'John Doe', 
          balance: 750,
          dos: new Date('2025-12-15'),
          visitType: 'Office Visit',
          acctNo: 'ACC001',
          primaryPayer: 'Blue Cross',
          billedCharges: 1200,
          assignedTo: 'shubham',
          sharedWith: ['ravi'],
          status: 'waiting',
          dateWorked: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          nextFollowUp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          history: [
            {
              remarks: 'Initial follow-up call made. Patient aware of balance.',
              status: 'waiting',
              dateWorked: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
              nextFollowUp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              workedBy: 'Shubham'
            }
          ]
        },
        { 
          claimNo: 'CLM002', 
          patient: 'Jane Smith', 
          balance: 300,
          assignedTo: 'ravi',
          sharedWith: [],
          status: 'in-review',
          dateWorked: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          nextFollowUp: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          history: []
        },
        { 
          claimNo: 'CLM003', 
          patient: 'Robert Johnson', 
          balance: 1200,
          assignedTo: 'chirag',
          sharedWith: [],
          status: 'unpaid',
          dateWorked: null,
          nextFollowUp: null,
          history: []
        },
        { 
          claimNo: 'CLM004', 
          patient: 'Emily Davis', 
          balance: 450,
          assignedTo: 'shubham',
          sharedWith: [],
          status: 'paid',
          dateWorked: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          nextFollowUp: null,
          history: [
            {
              remarks: 'Payment received in full.',
              status: 'paid',
              dateWorked: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
              nextFollowUp: null,
              workedBy: 'Shubham'
            }
          ]
        },
        { 
          claimNo: 'CLM005', 
          patient: 'Michael Brown', 
          balance: 890,
          assignedTo: 'ravi',
          sharedWith: [],
          status: 'waiting',
          dateWorked: null,
          nextFollowUp: null,
          history: []
        },
        { 
          claimNo: 'CLM006', 
          patient: 'Sarah Wilson', 
          balance: 560,
          assignedTo: null,
          sharedWith: [],
          status: null,
          dateWorked: null,
          nextFollowUp: null,
          history: []
        }
      ]);
      console.log('✅ Sample claims seeded');
    }
  } catch (error) {
    console.error('Seed error:', error);
  }
}

// Run seed after connection
mongoose.connection.once('open', seedDatabase);

// ==================== STATIC ROUTES ====================
// Serve static files AFTER API routes
app.use(express.static(__dirname));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all route - serve index.html for non-API routes
app.get('*', (req, res) => {
  // Don't serve HTML for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MNYC Work Management Tool running on port ${PORT}`);
});
