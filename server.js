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
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'agent'], default: 'agent' },
  avatar: String,
  color: String,
  createdAt: { type: Date, default: Date.now }
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
  // Assignment fields
  assignedTo: { type: String, default: null },
  sharedWith: [String],
  status: { type: String, default: null },
  dateWorked: { type: Date, default: null },
  nextFollowUp: { type: Date, default: null },
  lastWorkedBy: { type: String, default: null },
  history: [{
    remarks: String,
    status: String,
    dateWorked: Date,
    nextFollowUp: Date,
    workedBy: String
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Claim = mongoose.model('Claim', claimSchema);

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
      role: user.role,
      avatar: user.avatar,
      color: user.color
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Get all users (for admin)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({ role: 'agent' }).select('-password');
    res.json(users);
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
    req.body.updatedAt = new Date();
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
    const claim = await Claim.findByIdAndDelete(req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
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

// ==================== SEED DATA ====================

async function seedDatabase() {
  try {
    // Check if users exist
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱 Seeding users...');
      await User.insertMany([
        { odoo_id: 'yashpal', name: 'Yashpal', password: 'admin123', role: 'admin', avatar: 'Y', color: '#7c3aed' },
        { odoo_id: 'shubham', name: 'Shubham', password: 'pass123', role: 'agent', avatar: 'S', color: '#3b82f6' },
        { odoo_id: 'ravi', name: 'Ravi', password: 'pass123', role: 'agent', avatar: 'R', color: '#10b981' },
        { odoo_id: 'chirag', name: 'Chirag', password: 'pass123', role: 'agent', avatar: 'C', color: '#f59e0b' }
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
          assignedTo: 'EMP001',
          sharedWith: ['EMP002'],
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
          assignedTo: 'EMP002',
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
          assignedTo: 'EMP003',
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
          assignedTo: 'EMP001',
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
          assignedTo: 'EMP002',
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
