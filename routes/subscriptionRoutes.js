const express = require('express');
const subscriptionController = require('../controllers/subscriptionController');
const authController = require('../controllers/authController');

const router = express.Router();

// ========== PUBLIC ROUTES (No authentication required) ==========
// Get all active subscription plans
router.get('/', subscriptionController.getAllSubscriptions);

// Get a single subscription plan
router.get('/:id', subscriptionController.getSubscription);

// ========== PROTECTED ROUTES (Authentication required) ==========
// All routes below this line require authentication
router.use(authController.protect);

// ========== ADMIN-ONLY ROUTES ==========
// All routes below this line require admin privileges
router.use(authController.restrictTo('admin'));

// Create a new subscription plan
router.post('/', subscriptionController.createSubscription);

// Update a subscription plan
router.patch('/:id', subscriptionController.updateSubscription);

// Delete/deactivate a subscription plan
router.delete('/:id', subscriptionController.deleteSubscription);

// Activate a subscription plan
router.patch('/:id/activate', subscriptionController.activateSubscription);

// Get all plans (including inactive) - admin only
router.get('/admin/all', subscriptionController.getAllSubscriptionsAdmin);

// Seed default plans
router.post('/seed/default', subscriptionController.seedDefaultPlans);

module.exports = router;