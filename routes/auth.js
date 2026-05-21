const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Property = require('../models/Property');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Helper to generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'seeker',
      phone,
      avatar: ''
    });

    if (user) {
      res.status(201).json({
        success: true,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user and select password (since it is hidden by default)
    const user = await User.findOne({ email }).select('+password');

    if (user && (await user.matchPassword(password))) {
      res.json({
        success: true,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar || '',
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      res.json({
        success: true,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar || '',
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', protect, upload.single('avatar'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.phone = req.body.phone || user.phone;

      if (req.body.password) {
        user.password = req.body.password;
      }

      if (req.file) {
        // If there was an old avatar, delete it from storage
        if (user.avatar && user.avatar.startsWith('')) {
          const oldAvatarPath = path.join(__dirname, '../', user.avatar);
          if (fs.existsSync(oldAvatarPath)) {
            try {
              fs.unlinkSync(oldAvatarPath);
            } catch (err) {
              console.error('Failed to delete old avatar:', err);
            }
          }
        }
        user.avatar = `${req.file.path}`;
      }

      const updatedUser = await user.save();

      res.json({
        success: true,
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone,
        avatar: updatedUser.avatar || '',
        token: generateToken(updatedUser._id),
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Failed to cleanup uploaded file on error:', err);
      }
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get all agents
// @route   GET /api/auth/agents
// @access  Public
router.get('/agents', async (req, res) => {
  try {
    const agents = await User.find({ role: 'agent' });
    
    const agentsWithCount = await Promise.all(
      agents.map(async (agent) => {
        const propertyCount = await Property.countDocuments({ agent: agent._id });
        return {
          _id: agent._id,
          name: agent.name,
          email: agent.email,
          phone: agent.phone,
          role: agent.role,
          avatar: agent.avatar || '',
          properties: propertyCount,
        };
      })
    );

    res.json({ success: true, data: agentsWithCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
