const Razorpay = require('razorpay');
const { GoldSubscription, DiamondSubscription } = require('../models/Subscription');
const Scheme = require('../models/Scheme');
const crypto = require('crypto');

// Razorpay instance initializationf
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET_KEY,
});

exports.createGoldPaymentOrder = async (req, res) => {
  const { subscription_id, amount } = req.body;

  try {
    // Step 1: Find the subscription in the database
    const subscription = await GoldSubscription.findById(subscription_id);
    if (!subscription) {
      return res.status(404).json({ message: 'Gold Subscription not found' });
    }

    // Step 2: Validate the scheme type
    const scheme = await Scheme.findById(subscription.scheme_id);
    if (!scheme) {
      return res.status(404).json({ message: 'Scheme not found for the subscription' });
    }

    if (scheme.scheme_type !== 'gold') {
      return res.status(400).json({
        message: `Invalid subscription type. Expected 'gold', received '${scheme.scheme_type}'.`,
      });
    }

    // Step 3: Prepare the Razorpay order options
    const options = {
      amount: amount * 100, // Convert to the smallest currency unit
      currency: 'INR',
      receipt: `receipt_${subscription_id}`,
      notes: { subscription_id },
    };

    // Step 4: Create the Razorpay order
    const order = await razorpayInstance.orders.create(options);

    // Step 5: Update the subscription with payment details
    subscription.payments.push({
      payment_amount: amount,
      payment_status: 'pending',
      payment_method: 'razorpay',
      razorpay_order_id: order.id,
    });

    subscription.updated_at = new Date();
    await subscription.save();

    // Step 6: Send the response with Razorpay order details and subscription details
    res.json({
      message: 'Gold Payment order created successfully',
      razorpay_response: order, // Full Razorpay order response
      subscription_id,
      currency: order.currency,
      amount: order.amount / 100, // Convert back to the original amount
      order_receipt: order.receipt,
      scheme_type: scheme.scheme_type, // Send the scheme_type in the response
    });

  } catch (error) {
    // Step 7: Handle errors
    console.error('Error creating Razorpay order for Gold:', error);

    // If the error is related to Razorpay, provide specific error message
    if (error.response) {
      return res.status(error.response.statusCode).json({
        message: error.response.error.description || 'Error in Razorpay API call',
      });
    }

    // Generic error message
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Function to create Diamond Payment Order
exports.createDiamondPaymentOrder = async (req, res) => {
  const { subscription_id, amount, weight } = req.body;

  try {
    // Step 1: Prepare the Razorpay order options
    const options = {
      amount: amount * 100, // Convert to the smallest currency unit
      currency: 'INR',
      receipt: `receipt_${subscription_id}`,
      notes: { subscription_id },
    };

    // Step 2: Create the Razorpay order
    const order = await razorpayInstance.orders.create(options);

    // Step 3: Find the subscription in the database
    const subscription = await DiamondSubscription.findById(subscription_id);

    // Check if the subscription exists
    if (!subscription) {
      return res.status(404).json({ message: 'Diamond Subscription not found' });
    }

    // Fetch the scheme and validate its type
    const scheme = await Scheme.findById(subscription.scheme_id);
    if (!scheme || scheme.scheme_type !== 'diamond') {
      return res.status(400).json({ message: 'Invalid scheme type for Diamond Subscription' });
    }

    // Step 4: Update the subscription with payment details
    subscription.payments.push({
      payment_amount: amount,
      payment_status: 'pending',
      payment_method: 'razorpay',
      razorpay_order_id: order.id,
      weight: weight, // Store the weight for Diamond subscription
    });

    subscription.updated_at = new Date();
    await subscription.save();

    // Step 5: Send the response with Razorpay order details and subscription details
    res.json({
      message: 'Diamond Payment order created successfully',
      razorpay_response: order, // Full Razorpay order response
      subscription_id,
      currency: order.currency,
      amount: order.amount / 100, // Convert back to the original amount
      order_receipt: order.receipt,
      scheme_type: scheme.scheme_type, // Send the scheme_type in the response
    });

  } catch (error) {
    // Step 6: Handle errors
    console.error('Error creating Razorpay order for Diamond:', error);

    // If the error is related to Razorpay, provide specific error message
    if (error.response) {
      return res.status(error.response.statusCode).json({
        message: error.response.error.description || 'Error in Razorpay API call',
      });
    }

    // Generic error message
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
// // Verify Razorpay payment and update subscription status
// exports.verifyPayment = async (req, res) => {
//   const { subscription_id, payment_id, order_id, signature } = req.body;

//   try {
//     const subscription = await GoldSubscription.findById(subscription_id)
//       .populate({
//         path: 'scheme_id',
//         select: 'scheme_type',
//       });

//     if (!subscription) {
//       return res.status(404).json({ message: 'Subscription not found' });
//     }

//     const { scheme_type } = subscription.scheme_id;
//     const SubscriptionModel = scheme_type === 'gold' ? GoldSubscription : DiamondSubscription;

//     const updatedSubscription = await SubscriptionModel.findById(subscription_id);

//     if (!updatedSubscription) {
//       return res.status(404).json({ message: 'Subscription not found in the model' });
//     }

//     // Verify the signature
//     const body = order_id + "|" + payment_id;
//     const expectedSignature = crypto
//       .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
//       .update(body.toString())
//       .digest('hex');

//     if (expectedSignature !== signature) {
//       return res.status(400).json({ message: 'Payment verification failed' });
//     }

//     // Payment is verified
//     updatedSubscription.payments.push({
//       payment_amount: updatedSubscription.amount,
//       payment_status: 'completed',
//       payment_method: 'razorpay',
//       razorpay_order_id: order_id,
//       razorpay_payment_id: payment_id,
//       razorpay_signature: signature,
//     });

//     // Update the subscription status
//     updatedSubscription.subscribe_status = 'active'; // Set status to active after payment
//     updatedSubscription.updated_at = new Date();

//     await updatedSubscription.save();

//     res.json({
//       message: 'Payment verified successfully',
//       subscription: updatedSubscription,
//     });
//   } catch (error) {
//     console.error('Error verifying Razorpay payment:', error);
//     res.status(500).json({ message: 'Internal Server Error' });
//   }
// };
exports.verifyPayment = async (req, res) => {
  const { subscription_id, payment_id, order_id, signature, scheme_type } = req.body;

  try {
    // Step 1: Choose model based on scheme_type
    let SubscriptionModel;
    if (scheme_type === 'gold') {
      SubscriptionModel = GoldSubscription;
    } else if (scheme_type === 'diamond') {
      SubscriptionModel = DiamondSubscription;
    } else {
      return res.status(400).json({ message: 'Invalid scheme_type provided' });
    }

    // Step 2: Fetch the subscription
    const subscription = await SubscriptionModel.findById(subscription_id).populate('scheme_id', 'scheme_type');

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    // Step 3: Verify Razorpay signature
    const body = order_id + '|' + payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_SECRET_KEY)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({ message: 'Invalid signature. Payment verification failed.' });
    }

    // Step 4: Update payment record
    const paymentRecord = subscription.payments.find(p => p.razorpay_order_id === order_id);
    if (!paymentRecord) {
      return res.status(404).json({ message: 'Payment record not found in subscription' });
    }

    paymentRecord.razorpay_payment_id = payment_id;
    paymentRecord.razorpay_signature = signature;  // Ensure the signature is saved
    paymentRecord.payment_status = 'completed';
    // paymentRecord.payment_verified_at = new Date();

    subscription.updated_at = new Date();
    await subscription.save();

    // Step 5: Return success response
    res.json({
      message: 'Payment verified successfully',
      subscription_id,
      payment_id,
      scheme_type,
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
