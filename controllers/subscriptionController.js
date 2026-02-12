const Subscription = require('../models/Subscription');
const UserSubscription = require('../models/UserSubscription');

// Get all active subscription plans
exports.getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ isActive: true }).sort({ amount: 1 });
    
    res.status(200).json({
      status: 'success',
      results: subscriptions.length,
      data: {
        subscriptions
      }
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Get single subscription plan
exports.getSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    
    if (!subscription) {
      return res.status(404).json({
        status: 'fail',
        message: 'No subscription plan found with that ID'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        subscription
      }
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err.message
    });
  }
};

// ========== USER SUBSCRIPTION ROUTES (Requires Authentication) ==========

// Subscribe to a plan
exports.subscribeToPlan = async (req, res) => {
  try {
    const { planId, billingCycle = 'monthly', paymentMethod = 'credit_card', autoRenew = true } = req.body;
    const userId = req.user.id;

    // Check if plan exists and is active
    const plan = await Subscription.findById(planId);
    if (!plan) {
      return res.status(404).json({
        status: 'fail',
        message: 'Subscription plan not found'
      });
    }

    if (!plan.isActive) {
      return res.status(400).json({
        status: 'fail',
        message: 'This subscription plan is not available'
      });
    }

    // Check if user already has an active subscription
    const activeSubscription = await UserSubscription.findOne({
      user: userId,
      status: 'active'
    });

    if (activeSubscription) {
      return res.status(400).json({
        status: 'fail',
        message: 'You already have an active subscription. Please cancel it first or wait for it to expire.'
      });
    }

    // Calculate end date based on billing cycle
    const startDate = new Date();
    let endDate = new Date();
    
    if (billingCycle === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Create user subscription
    const userSubscription = await UserSubscription.create({
      user: userId,
      plan: planId,
      planName: plan.name,
      amount: plan.amount,
      currency: plan.currency,
      billingCycle,
      status: 'active',
      startDate,
      endDate,
      autoRenew,
      paymentMethod
    });

    // Populate plan details
    await userSubscription.populate('plan');

    res.status(201).json({
      status: 'success',
      message: `Successfully subscribed to ${plan.name} plan`,
      data: {
        subscription: userSubscription
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Get user's current active subscription
exports.getMyCurrentSubscription = async (req, res) => {
  try {
    const userId = req.user.id;

    const subscription = await UserSubscription.findOne({
      user: userId,
      status: 'active'
    }).populate('plan');

    if (!subscription) {
      return res.status(404).json({
        status: 'fail',
        message: 'You do not have an active subscription'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        subscription
      }
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Get user's subscription history
exports.getMySubscriptionHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const subscriptions = await UserSubscription.find({ user: userId })
      .populate('plan')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: subscriptions.length,
      data: {
        subscriptions
      }
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Cancel subscription
exports.cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscriptionId } = req.params;

    const subscription = await UserSubscription.findOne({
      _id: subscriptionId,
      user: userId,
      status: 'active'
    });

    if (!subscription) {
      return res.status(404).json({
        status: 'fail',
        message: 'Active subscription not found'
      });
    }

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.autoRenew = false;
    await subscription.save();

    res.status(200).json({
      status: 'success',
      message: 'Subscription cancelled successfully',
      data: {
        subscription
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Toggle auto-renew
exports.toggleAutoRenew = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscriptionId } = req.params;
    const { autoRenew } = req.body;

    const subscription = await UserSubscription.findOne({
      _id: subscriptionId,
      user: userId,
      status: 'active'
    });

    if (!subscription) {
      return res.status(404).json({
        status: 'fail',
        message: 'Active subscription not found'
      });
    }

    subscription.autoRenew = autoRenew;
    await subscription.save();

    res.status(200).json({
      status: 'success',
      message: `Auto-renew ${autoRenew ? 'enabled' : 'disabled'} successfully`,
      data: {
        subscription
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Change subscription plan (upgrade/downgrade)
exports.changePlan = async (req, res) => {
  try {
    const userId = req.user.id;
    const { newPlanId, billingCycle } = req.body;

    // Get current active subscription
    const currentSubscription = await UserSubscription.findOne({
      user: userId,
      status: 'active'
    });

    if (!currentSubscription) {
      return res.status(404).json({
        status: 'fail',
        message: 'No active subscription found'
      });
    }

    // Get new plan
    const newPlan = await Subscription.findById(newPlanId);
    if (!newPlan || !newPlan.isActive) {
      return res.status(404).json({
        status: 'fail',
        message: 'New subscription plan not available'
      });
    }

    // Cancel current subscription
    currentSubscription.status = 'cancelled';
    currentSubscription.cancelledAt = new Date();
    currentSubscription.autoRenew = false;
    await currentSubscription.save();

    // Calculate end date for new subscription
    const startDate = new Date();
    let endDate = new Date();
    
    if (billingCycle === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Create new subscription
    const newSubscription = await UserSubscription.create({
      user: userId,
      plan: newPlanId,
      planName: newPlan.name,
      amount: newPlan.amount,
      currency: newPlan.currency,
      billingCycle: billingCycle || currentSubscription.billingCycle,
      status: 'active',
      startDate,
      endDate,
      autoRenew: true,
      paymentMethod: currentSubscription.paymentMethod
    });

    await newSubscription.populate('plan');

    res.status(200).json({
      status: 'success',
      message: `Successfully changed to ${newPlan.name} plan`,
      data: {
        previousSubscription: currentSubscription,
        currentSubscription: newSubscription
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// ========== ADMIN ROUTES ==========

// Get all user subscriptions (admin only)
exports.getAllUserSubscriptions = async (req, res) => {
  try {
    const subscriptions = await UserSubscription.find()
      .populate('user', 'username email')
      .populate('plan')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: subscriptions.length,
      data: {
        subscriptions
      }
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Get subscriptions by status (admin only)
exports.getSubscriptionsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    
    const subscriptions = await UserSubscription.find({ status })
      .populate('user', 'username email')
      .populate('plan')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: subscriptions.length,
      data: {
        subscriptions
      }
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Get user's subscription by user ID (admin only)
exports.getUserSubscriptions = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const subscriptions = await UserSubscription.find({ user: userId })
      .populate('plan')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: subscriptions.length,
      data: {
        subscriptions
      }
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Manually expire subscriptions (admin only - for testing)
exports.expireSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    const subscription = await UserSubscription.findById(subscriptionId);
    
    if (!subscription) {
      return res.status(404).json({
        status: 'fail',
        message: 'Subscription not found'
      });
    }

    subscription.status = 'expired';
    subscription.endDate = new Date();
    await subscription.save();

    res.status(200).json({
      status: 'success',
      message: 'Subscription expired successfully',
      data: {
        subscription
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// ========== CRON JOB FUNCTION ==========
// Check for expired subscriptions and update their status
exports.checkExpiredSubscriptions = async () => {
  try {
    const now = new Date();
    
    const expiredSubscriptions = await UserSubscription.updateMany(
      {
        status: 'active',
        endDate: { $lt: now },
        autoRenew: false
      },
      {
        status: 'expired',
        updatedAt: now
      }
    );

    console.log(`[CRON] Expired ${expiredSubscriptions.modifiedCount} subscriptions`);

    // Auto-renew for those with autoRenew enabled
    const renewSubscriptions = await UserSubscription.find({
      status: 'active',
      endDate: { $lt: now },
      autoRenew: true
    });

    for (const subscription of renewSubscriptions) {
      // Calculate new end date
      const newEndDate = new Date();
      if (subscription.billingCycle === 'monthly') {
        newEndDate.setMonth(newEndDate.getMonth() + 1);
      } else {
        newEndDate.setFullYear(newEndDate.getFullYear() + 1);
      }

      subscription.startDate = new Date();
      subscription.endDate = newEndDate;
      await subscription.save();
    }

    console.log(`[CRON] Auto-renewed ${renewSubscriptions.length} subscriptions`);
  } catch (err) {
    console.error('[CRON] Error checking expired subscriptions:', err);
  }
};