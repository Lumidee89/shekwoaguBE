const Subscription = require('../models/Subscription');

// Get all subscription plans (public)
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

// Get single subscription plan (public)
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

// Create subscription plan (admin only)
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
      currency: currency || 'NGN',
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

    // If you want to permanently delete, use this instead:
    // await Subscription.findByIdAndDelete(req.params.id);

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
        amount: 500,
        currency: 'NGN',
        billingCycle: 'monthly',
        features: ['Watch on 1 screen', 'Good video quality', '720p resolution'],
        quality: 'Good',
        resolution: '720p',
        screens: 1,
        devices: 'Phone + Tablet'
      },
      {
        name: 'Standard',
        amount: 600,
        currency: 'NGN',
        billingCycle: 'monthly',
        features: ['Watch on 2 screens', 'Better video quality', '1080p resolution', 'Download on 2 devices'],
        quality: 'Better',
        resolution: '1080p',
        screens: 2,
        devices: 'Phone + Tablet + TV'
      },
      {
        name: 'Premium',
        amount: 700,
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