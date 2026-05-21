const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Property = require('../models/Property');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// @desc    Get all properties (with filtering)
// @route   GET /api/properties
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { search, category, type, priceMin, priceMax, amenities } = req.query;
    
    let query = {};

    // Text search (title or location)
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    // Category filter
    if (category && category !== 'all') {
      query.category = category;
    }

    // Type filter
    if (type && type !== 'all') {
      query.type = type;
    }

    // Price filter
    if (priceMin || priceMax) {
      query.price = {};
      if (priceMin) query.price.$gte = Number(priceMin);
      if (priceMax) query.price.$lte = Number(priceMax);
    }

    // Amenities filter (must contain all specified amenities)
    if (amenities) {
      const amenitiesList = Array.isArray(amenities)
        ? amenities
        : amenities.split(',');
      if (amenitiesList.length > 0) {
        query.amenities = { $all: amenitiesList };
      }
    }

    const properties = await Property.find(query).populate('agent', 'name email phone role');
    res.json({ success: true, count: properties.length, data: properties });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get logged in agent's property listings
// @route   GET /api/properties/agent
// @access  Private (Agent only)
router.get('/agent', protect, authorize('agent'), async (req, res) => {
  try {
    const properties = await Property.find({ agent: req.user._id });
    res.json({ success: true, count: properties.length, data: properties });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get single property details
// @route   GET /api/properties/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate('agent', 'name email phone role');
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    res.json({ success: true, data: property });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Create a new property listing
// @route   POST /api/properties
// @access  Private (Agent only)
router.post(
  '/',
  protect,
  authorize('agent'),
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Please upload an image' });
      }

      // Construct image URL (path from client perspective)
      // Serving static files in express, so we'll serve "/uploads"
      const imagePath = `/uploads/${req.file.path}`;

      // Convert amenities back to array if it was sent as string/JSON string
      let amenitiesArr = [];
      if (req.body.amenities) {
        try {
          amenitiesArr = JSON.parse(req.body.amenities);
        } catch (e) {
          amenitiesArr = Array.isArray(req.body.amenities) 
            ? req.body.amenities 
            : [req.body.amenities];
        }
      }

      const propertyData = {
        title: req.body.title,
        price: Number(req.body.price),
        description: req.body.description,
        location: req.body.location,
        beds: req.body.beds ? Number(req.body.beds) : 0,
        baths: req.body.baths ? Number(req.body.baths) : 0,
        sqft: req.body.sqft ? Number(req.body.sqft) : 0,
        type: req.body.type,
        category: req.body.category,
        status: req.body.category === 'rent' ? 'For Rent' : 'For Sale',
        amenities: amenitiesArr,
        image: imagePath,
        lat: req.body.lat ? Number(req.body.lat) : 40.7128,
        lng: req.body.lng ? Number(req.body.lng) : -74.0060,
        agent: req.user._id,
      };

      const property = await Property.create(propertyData);

      res.status(201).json({ success: true, data: property });
    } catch (error) {
      // If error occurred and file was uploaded, clean it up
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// @desc    Update a property listing
// @route   PUT /api/properties/:id
// @access  Private (Agent only)
router.put(
  '/:id',
  protect,
  authorize('agent'),
  upload.single('image'),
  async (req, res) => {
    try {
      let property = await Property.findById(req.params.id);

      if (!property) {
        return res.status(404).json({ success: false, message: 'Property not found' });
      }

      // Check if user is owner of the property
      if (property.agent.toString() !== req.user._id.toString()) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized to update this listing',
        });
      }

      let updatedData = { ...req.body };

      // Convert amenities back to array if it was sent as string/JSON string
      if (req.body.amenities) {
        try {
          updatedData.amenities = JSON.parse(req.body.amenities);
        } catch (e) {
          updatedData.amenities = Array.isArray(req.body.amenities) 
            ? req.body.amenities 
            : [req.body.amenities];
        }
      }

      // Handle file upload if new image is provided
      if (req.file) {
        updatedData.image = `/uploads/${req.file.path}`;

        // Attempt to delete old image if it's local
        if (property.image && property.image.startsWith('/uploads/')) {
          const oldImagePath = path.join(
            __dirname,
            '../',
            property.image
          );
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
      }

      // Ensure stats and numbers are formatted
      if (updatedData.price) updatedData.price = Number(updatedData.price);
      if (updatedData.beds) updatedData.beds = Number(updatedData.beds);
      if (updatedData.baths) updatedData.baths = Number(updatedData.baths);
      if (updatedData.sqft) updatedData.sqft = Number(updatedData.sqft);
      if (updatedData.lat) updatedData.lat = Number(updatedData.lat);
      if (updatedData.lng) updatedData.lng = Number(updatedData.lng);

      if (updatedData.category) {
        updatedData.status = updatedData.category === 'rent' ? 'For Rent' : 'For Sale';
      }

      property = await Property.findByIdAndUpdate(req.params.id, updatedData, {
        new: true,
        runValidators: true,
      });

      res.json({ success: true, data: property });
    } catch (error) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// @desc    Delete a property listing
// @route   DELETE /api/properties/:id
// @access  Private (Agent only)
router.delete('/:id', protect, authorize('agent'), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    // Check if user is owner of the property
    if (property.agent.toString() !== req.user._id.toString()) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to delete this listing',
      });
    }

    // Delete associated image file from uploads folder
    if (property.image && property.image.startsWith('/uploads/')) {
      const imagePath = path.join(__dirname, '../', property.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Property.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
