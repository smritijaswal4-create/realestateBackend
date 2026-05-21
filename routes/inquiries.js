const express = require('express');
const router = express.Router();
const Inquiry = require('../models/Inquiry');
const Property = require('../models/Property');
const { protect, authorize } = require('../middleware/auth');

// @desc    Submit an inquiry
// @route   POST /api/inquiries
// @access  Public
router.post('/', async (req, res, next) => {
  try {
    const { propertyId, name, email, phone, message } = req.body;

    if (!propertyId || !name || !email || !phone || !message) {
      return res.status(400).json({ success: false, message: 'Please provide all details' });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const inquiry = await Inquiry.create({
      property: propertyId,
      agent: property.agent,
      name,
      email,
      phone,
      message
    });

    res.status(201).json({ success: true, data: inquiry });
  } catch (error) {
    next(error);
  }
});

// @desc    Get all inquiries for the logged-in agent
// @route   GET /api/inquiries
// @access  Private (Agent only)
router.get('/', protect, authorize('agent'), async (req, res, next) => {
  try {
    const inquiries = await Inquiry.find({ agent: req.user.id })
      .populate('property', 'title price image')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: inquiries });
  } catch (error) {
    next(error);
  }
});

// @desc    Delete/Dismiss an inquiry
// @route   DELETE /api/inquiries/:id
// @access  Private (Agent only)
router.delete('/:id', protect, authorize('agent'), async (req, res, next) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }

    // Check ownership
    if (inquiry.agent.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    await inquiry.deleteOne();

    res.status(200).json({ success: true, message: 'Inquiry deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
