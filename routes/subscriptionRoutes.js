const express = require('express');
const subscriptionController = require('../controllers/subscriptionController');
const authController = require('../controllers/authController');

const router = express.Router();

// ========== PUBLIC ROUTES (No authentication required) ==========
// Get all active subscription plans
router.get('/', subscriptionController.getAllSubscriptions);

// Get a single subscription plan
router.get('/:id', subscriptionController.getSubscription);

router.post('/paystack/webhook', subscriptionController.paystackWebhook);

// ========== PROTECTED ROUTES (Authentication required) ==========
// All routes below this line require authentication
router.use(authController.protect);

router.post('/initialize-payment', subscriptionController.initializeSubscriptionPayment);

// Verify payment
router.get('/verify-payment/:reference', subscriptionController.verifySubscriptionPayment);

// ========== ADMIN-ONLY ROUTES ==========
// All routes below this line require admin privileges
router.use(authController.restrictTo('admin'));

// Create a new subscription plan
router.post('/', subscriptionController.createSubscription);

// Update a subscription plan
router.patch('/plan/:id', subscriptionController.updateSubscription);

// Delete/deactivate a subscription plan
router.delete('/:id', subscriptionController.deleteSubscription);

// Activate a subscription plan
router.patch('/:id/activate', subscriptionController.activateSubscription);

// Get all plans (including inactive) - admin only
router.get('/admin/all', subscriptionController.getAllSubscriptionsAdmin);

// Seed default plans
router.post('/seed/default', subscriptionController.seedDefaultPlans);

// ========== USER SUBSCRIPTION ROUTES ==========
// Subscribe to a plan
router.post('/subscribe', subscriptionController.subscribeToPlan);

// Get user's current active subscription
router.get('/my/current', subscriptionController.getMyCurrentSubscription);

// Get user's subscription history
router.get('/my/history', subscriptionController.getMySubscriptionHistory);

// Cancel subscription
router.patch('/my/:subscriptionId/cancel', subscriptionController.cancelSubscription);

// Toggle auto-renew
router.patch('/my/:subscriptionId/auto-renew', subscriptionController.toggleAutoRenew);

// Change subscription plan (upgrade/downgrade)
router.post('/change-plan', subscriptionController.changePlan);

// ========== ADMIN USER SUBSCRIPTION ROUTES ==========
// Get all user subscriptions
router.get('/admin/user-subscriptions', subscriptionController.getAllUserSubscriptions);

// Get subscriptions by status
router.get('/admin/status/:status', subscriptionController.getSubscriptionsByStatus);

// Get user's subscriptions by user ID
router.get('/admin/user/:userId', subscriptionController.getUserSubscriptions);

// Manually expire subscription (admin only)
router.patch('/admin/:subscriptionId/expire', subscriptionController.expireSubscription);

module.exports = router;