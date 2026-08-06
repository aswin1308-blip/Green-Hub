const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Legacy stub — kept so any old clients hitting POST /api/payment still work.
const { payment } = require('../controllers/paymentController');
router.post('/', payment);

// 1. Create a Razorpay order
// Body: { amount } — amount in rupees (INR). Converted to paise for Razorpay.
router.post('/create-order', async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'A valid amount in INR is required' });
    }

    const options = {
      amount: Math.round(Number(amount) * 100), // rupees -> paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);

    // key_id is needed by the client to open the checkout modal,
    // so we attach it to the response instead of hardcoding it in JS.
    res.json({ ...order, key_id: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error('Razorpay order creation failed:', err);
    res.status(500).json({ error: 'Order creation failed' });
  }
});

// 2. Verify the payment signature after checkout completes
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
router.post('/verify-payment', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, error: 'Missing payment details' });
  }

  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (generatedSignature === razorpay_signature) {
    // TODO: mark the order as paid in your DB here
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: 'Invalid signature' });
  }
});

module.exports = router;
