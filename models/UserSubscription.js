const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true
  },
  planName: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'NGN'
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly'
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'pending'],
    default: 'pending'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  paymentMethod: {
    type: String,
    enum: ['paystack', 'credit_card', 'bank_transfer'],
    default: 'paystack'
  },
  paymentDetails: {
    reference: { type: String },
    accessCode: { type: String },
    authorizationUrl: { type: String },
    authorizationCode: { type: String },
    cardType: { type: String },
    last4: { type: String },
    expMonth: { type: String },
    expYear: { type: String },
    bank: { type: String },
    accountName: { type: String }
  },
  paymentHistory: [
    {
      amount: { type: Number },
      reference: { type: String },
      status: { type: String },
      date: { type: Date, default: Date.now }
    }
  ],
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
userSubscriptionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster queries
userSubscriptionSchema.index({ user: 1, status: 1 });
userSubscriptionSchema.index({ endDate: 1 });
userSubscriptionSchema.index({ 'paymentDetails.reference': 1 });

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);