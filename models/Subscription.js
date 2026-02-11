const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Subscription plan name is required'],
    unique: true,
    trim: true,
    enum: {
      values: ['Basic', 'Standard', 'Premium'],
      message: '{VALUE} is not a valid plan. Please choose Basic, Standard, or Premium'
    }
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'NGN']
  },
  billingCycle: {
    type: String,
    default: 'monthly',
    enum: ['monthly', 'yearly']
  },
  features: {
    type: [String],
    default: []
  },
  quality: {
    type: String,
    enum: ['Good', 'Better', 'Best'],
    default: 'Good'
  },
  resolution: {
    type: String,
    enum: ['720p', '1080p', '4K+HDR'],
    default: '720p'
  },
  screens: {
    type: Number,
    default: 1,
    min: 1,
    max: 4
  },
  devices: {
    type: String,
    default: 'Phone + Tablet'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field on save
subscriptionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Ensure only one active plan per name
subscriptionSchema.index({ name: 1, isActive: 1 }, { unique: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);