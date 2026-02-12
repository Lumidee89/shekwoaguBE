const axios = require('axios');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Initialize Paystack transaction
exports.initializePayment = async (email, amount, metadata = {}) => {
  try {
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email,
        amount: amount * 100, // Paystack amount is in kobo (multiply by 100)
        currency: 'NGN',
        metadata,
        callback_url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/subscriptions/paystack/callback`,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      authorizationUrl: response.data.data.authorization_url,
      accessCode: response.data.data.access_code,
      reference: response.data.data.reference,
    };
  } catch (error) {
    console.error('Paystack initialization error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Payment initialization failed');
  }
};

// Verify Paystack transaction
exports.verifyPayment = async (reference) => {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    return {
      success: true,
      status: response.data.data.status,
      amount: response.data.data.amount / 100, // Convert back from kobo
      currency: response.data.data.currency,
      customer: response.data.data.customer,
      metadata: response.data.data.metadata,
    };
  } catch (error) {
    console.error('Paystack verification error:', error.response?.data || error.message);
    throw new Error('Payment verification failed');
  }
};

// Charge authorization (for recurring payments)
exports.chargeAuthorization = async (authorizationCode, email, amount, metadata = {}) => {
  try {
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/charge_authorization`,
      {
        authorization_code: authorizationCode,
        email,
        amount: amount * 100,
        currency: 'NGN',
        metadata,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      reference: response.data.data.reference,
      status: response.data.data.status,
    };
  } catch (error) {
    console.error('Paystack charge error:', error.response?.data || error.message);
    throw new Error('Recurring payment failed');
  }
};