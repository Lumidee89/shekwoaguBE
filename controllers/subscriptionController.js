const Subscription = require('../models/Subscription');
const UserSubscription = require('../models/UserSubscription');
const paystackService = require('../services/paystackService');

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

exports.createSubscription = async (req, res) => {
  try {
    const { name, amount, currency, billingCycle, features, quality, resolution, screens, devices } = req.body;

    // Check if plan already exists
    const existingPlan = await Subscription.findOne({ name });
    if (existingPlan) {
      return res.status(400).json({
        status: 'fail',
        message: 'A subscription plan with this name already exists'
      });
    }

    // Set default features based on plan
    let planFeatures = features || [];
    let planQuality = quality;
    let planResolution = resolution;
    let planScreens = screens;
    let planDevices = devices;

    // Auto-configure based on plan name if not provided
    if (!features || !quality || !resolution || !screens || !devices) {
      switch(name) {
        case 'Basic':
          planFeatures = planFeatures.length ? planFeatures : ['Watch on 1 screen', 'Good video quality', '720p resolution'];
          planQuality = planQuality || 'Good';
          planResolution = planResolution || '720p';
          planScreens = planScreens || 1;
          planDevices = planDevices || 'Phone + Tablet';
          break;
        case 'Standard':
          planFeatures = planFeatures.length ? planFeatures : ['Watch on 2 screens', 'Better video quality', '1080p resolution', 'Download on 2 devices'];
          planQuality = planQuality || 'Better';
          planResolution = planResolution || '1080p';
          planScreens = planScreens || 2;
          planDevices = planDevices || 'Phone + Tablet + TV';
          break;
        case 'Premium':
          planFeatures = planFeatures.length ? planFeatures : ['Watch on 4 screens', 'Best video quality', '4K+HDR resolution', 'Download on 4 devices', 'Dolby Atmos'];
          planQuality = planQuality || 'Best';
          planResolution = planResolution || '4K+HDR';
          planScreens = planScreens || 4;
          planDevices = planDevices || 'All Devices';
          break;
      }
    }

    const newSubscription = await Subscription.create({
      name,
      amount,
      currency: currency || 'USD',
      billingCycle: billingCycle || 'monthly',
      features: planFeatures,
      quality: planQuality,
      resolution: planResolution,
      screens: planScreens,
      devices: planDevices,
      isActive: true
    });

    res.status(201).json({
      status: 'success',
      data: {
        subscription: newSubscription
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Update subscription plan (admin only)
exports.updateSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedAt: Date.now()
      },
      {
        new: true,
        runValidators: true
      }
    );

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
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Delete subscription plan (admin only)
exports.deleteSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);

    if (!subscription) {
      return res.status(404).json({
        status: 'fail',
        message: 'No subscription plan found with that ID'
      });
    }

    // Soft delete - set isActive to false instead of actually deleting
    subscription.isActive = false;
    subscription.updatedAt = Date.now();
    await subscription.save();

    res.status(200).json({
      status: 'success',
      message: 'Subscription plan deactivated successfully',
      data: null
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Activate subscription plan (admin only)
exports.activateSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);

    if (!subscription) {
      return res.status(404).json({
        status: 'fail',
        message: 'No subscription plan found with that ID'
      });
    }

    subscription.isActive = true;
    subscription.updatedAt = Date.now();
    await subscription.save();

    res.status(200).json({
      status: 'success',
      message: 'Subscription plan activated successfully',
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

// Get all subscription plans (including inactive) - admin only
exports.getAllSubscriptionsAdmin = async (req, res) => {
  try {
    const subscriptions = await Subscription.find().sort({ amount: 1 });
    
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

// Seed default subscription plans (admin only)
exports.seedDefaultPlans = async (req, res) => {
  try {
    const defaultPlans = [
      {
        name: 'Basic',
        amount: 9.99,
        currency: 'USD',
        billingCycle: 'monthly',
        features: ['Watch on 1 screen', 'Good video quality', '720p resolution'],
        quality: 'Good',
        resolution: '720p',
        screens: 1,
        devices: 'Phone + Tablet'
      },
      {
        name: 'Standard',
        amount: 14.99,
        currency: 'USD',
        billingCycle: 'monthly',
        features: ['Watch on 2 screens', 'Better video quality', '1080p resolution', 'Download on 2 devices'],
        quality: 'Better',
        resolution: '1080p',
        screens: 2,
        devices: 'Phone + Tablet + TV'
      },
      {
        name: 'Premium',
        amount: 19.99,
        currency: 'USD',
        billingCycle: 'monthly',
        features: ['Watch on 4 screens', 'Best video quality', '4K+HDR resolution', 'Download on 4 devices', 'Dolby Atmos'],
        quality: 'Best',
        resolution: '4K+HDR',
        screens: 4,
        devices: 'All Devices'
      }
    ];

    let createdPlans = [];

    for (const plan of defaultPlans) {
      const existingPlan = await Subscription.findOne({ name: plan.name });
      if (!existingPlan) {
        const newPlan = await Subscription.create(plan);
        createdPlans.push(newPlan);
      }
    }

    res.status(200).json({
      status: 'success',
      message: `${createdPlans.length} default plans created successfully`,
      data: {
        subscriptions: createdPlans
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

exports.initializeSubscriptionPayment = async (req, res) => {
  try {
    const { planId, billingCycle = 'monthly', autoRenew = true } = req.body;
    const userId = req.user.id;
    const user = req.user;

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

    // Create pending subscription
    const startDate = new Date();
    let endDate = new Date();
    
    if (billingCycle === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Initialize Paystack payment
    const metadata = {
      userId,
      planId,
      planName: plan.name,
      billingCycle,
      amount: plan.amount,
      autoRenew
    };

    const paymentInit = await paystackService.initializePayment(
      user.email,
      plan.amount,
      metadata
    );

    // Create user subscription with pending status
    const userSubscription = await UserSubscription.create({
      user: userId,
      plan: planId,
      planName: plan.name,
      amount: plan.amount,
      currency: 'NGN',
      billingCycle,
      status: 'pending',
      startDate,
      endDate,
      autoRenew,
      paymentMethod: 'paystack',
      paymentDetails: {
        reference: paymentInit.reference,
        accessCode: paymentInit.accessCode,
        authorizationUrl: paymentInit.authorizationUrl
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Payment initialized successfully',
      data: {
        authorizationUrl: paymentInit.authorizationUrl,
        reference: paymentInit.reference,
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

// Verify Paystack payment
exports.verifySubscriptionPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    const userId = req.user.id;

    // Find subscription with this reference
    const subscription = await UserSubscription.findOne({
      'paymentDetails.reference': reference,
      user: userId
    });

    if (!subscription) {
      return res.status(404).json({
        status: 'fail',
        message: 'Subscription not found'
      });
    }

    // Verify payment with Paystack
    const paymentVerification = await paystackService.verifyPayment(reference);

    if (paymentVerification.status === 'success') {
      // Update subscription status to active
      subscription.status = 'active';
      subscription.paymentDetails.authorizationCode = paymentVerification.metadata?.authorization_code;
      
      // Add to payment history
      subscription.paymentHistory.push({
        amount: subscription.amount,
        reference: reference,
        status: 'success',
        date: new Date()
      });

      await subscription.save();

      res.status(200).json({
        status: 'success',
        message: 'Payment verified successfully',
        data: {
          subscription
        }
      });
    } else {
      subscription.status = 'expired';
      await subscription.save();

      res.status(400).json({
        status: 'fail',
        message: 'Payment verification failed',
        data: {
          subscription
        }
      });
    }
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Paystack webhook (for payment callbacks)
exports.paystackWebhook = async (req, res) => {
  try {
    const event = req.body;

    // Verify webhook signature (implement security)
    if (event.event === 'charge.success') {
      const { reference, metadata, authorization } = event.data;
      
      // Find subscription with this reference
      const subscription = await UserSubscription.findOne({
        'paymentDetails.reference': reference
      });

      if (subscription) {
        subscription.status = 'active';
        subscription.paymentDetails.authorizationCode = authorization.authorization_code;
        subscription.paymentDetails.cardType = authorization.card_type;
        subscription.paymentDetails.last4 = authorization.last4;
        subscription.paymentDetails.expMonth = authorization.exp_month;
        subscription.paymentDetails.expYear = authorization.exp_year;
        subscription.paymentDetails.bank = authorization.bank;
        subscription.paymentDetails.accountName = authorization.account_name;

        subscription.paymentHistory.push({
          amount: subscription.amount,
          reference: reference,
          status: 'success',
          date: new Date()
        });

        await subscription.save();
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(500);
  }
};

// Check if user has active subscription (for access control)
exports.checkSubscriptionAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const activeSubscription = await UserSubscription.findOne({
      user: userId,
      status: 'active'
    });

    if (!activeSubscription) {
      return res.status(403).json({
        status: 'fail',
        message: 'You need an active subscription to access this content',
        requiresSubscription: true
      });
    }

    // Check if subscription is expired
    if (new Date() > activeSubscription.endDate) {
      activeSubscription.status = 'expired';
      await activeSubscription.save();
      
      return res.status(403).json({
        status: 'fail',
        message: 'Your subscription has expired. Please renew to continue watching.',
        requiresSubscription: true
      });
    }

    // Attach subscription to request for use in other routes
    req.subscription = activeSubscription;
    next();
  } catch (err) {
    res.status(500).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Get user's subscription status
exports.getMySubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const activeSubscription = await UserSubscription.findOne({
      user: userId,
      status: 'active'
    }).populate('plan');

    res.status(200).json({
      status: 'success',
      data: {
        hasActiveSubscription: !!activeSubscription,
        subscription: activeSubscription || null
      }
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Renew subscription (charge authorization)
exports.renewSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscriptionId } = req.params;

    const subscription = await UserSubscription.findOne({
      _id: subscriptionId,
      user: userId,
      status: 'active'
    }).populate('plan');

    if (!subscription) {
      return res.status(404).json({
        status: 'fail',
        message: 'Active subscription not found'
      });
    }

    if (!subscription.autoRenew) {
      return res.status(400).json({
        status: 'fail',
        message: 'Auto-renew is disabled for this subscription'
      });
    }

    if (!subscription.paymentDetails.authorizationCode) {
      return res.status(400).json({
        status: 'fail',
        message: 'No payment authorization found. Please resubscribe.'
      });
    }

    // Charge the saved authorization
    const charge = await paystackService.chargeAuthorization(
      subscription.paymentDetails.authorizationCode,
      req.user.email,
      subscription.amount,
      {
        userId,
        subscriptionId: subscription._id,
        planId: subscription.plan._id,
        renewal: true
      }
    );

    // Update subscription dates
    const newEndDate = new Date();
    if (subscription.billingCycle === 'monthly') {
      newEndDate.setMonth(newEndDate.getMonth() + 1);
    } else {
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);
    }

    subscription.startDate = new Date();
    subscription.endDate = newEndDate;
    
    subscription.paymentHistory.push({
      amount: subscription.amount,
      reference: charge.reference,
      status: 'success',
      date: new Date()
    });

    await subscription.save();

    res.status(200).json({
      status: 'success',
      message: 'Subscription renewed successfully',
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