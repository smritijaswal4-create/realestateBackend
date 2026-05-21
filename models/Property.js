const mongoose = require('mongoose');

const PropertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a property title'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Please add a price'],
    },
    description: {
      type: String,
      required: [true, 'Please add a description'],
    },
    location: {
      type: String,
      required: [true, 'Please add a location/address'],
    },
    beds: {
      type: Number,
      default: 0,
    },
    baths: {
      type: Number,
      default: 0,
    },
    sqft: {
      type: Number,
      default: 0,
    },
    type: {
      type: String,
      required: [true, 'Please select property type'],
      enum: ['flat', 'house', 'plot', 'pg'],
    },
    category: {
      type: String,
      required: [true, 'Please select category (buy/rent)'],
      enum: ['buy', 'rent'],
    },
    status: {
      type: String,
      required: true,
      default: 'For Sale',
    },
    amenities: {
      type: [String],
      default: [],
    },
    image: {
      type: String,
      required: [true, 'Please upload or provide a property image'],
    },
    lat: {
      type: Number,
      default: 40.7128, // Default coordinates if not provided
    },
    lng: {
      type: Number,
      default: -74.0060,
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Property', PropertySchema);
