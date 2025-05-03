const Razorpay = require('razorpay');
const { GoldSubscription, DiamondSubscription } = require('../models/Subscription');
const Scheme = require('../models/Scheme');
const crypto = require('crypto');
const admin = require('./../config/firebase');
const User = require('../models/User');

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
    // 1. Select Subscription Model
    let SubscriptionModel;
    if (scheme_type === 'gold') {
      SubscriptionModel = GoldSubscription;
    } else if (scheme_type === 'diamond') {
      SubscriptionModel = DiamondSubscription;
    } else {
      return res.status(400).json({ message: 'Invalid scheme_type provided' });
    }

    // 2. Fetch Subscription
    const subscription = await SubscriptionModel.findById(subscription_id);
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    if (!subscription.user_id) {
      return res.status(400).json({ message: 'User not linked to subscription' });
    }

    // 3. Fetch User by ID
    const user = await User.findById(subscription.user_id, 'phonenumber fcm_token fullname role');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 4. Verify Razorpay Signature
    const body = order_id + '|' + payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_SECRET_KEY)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({ message: 'Invalid signature. Payment verification failed.' });
    }

    // 5. Update Payment Record
    const paymentRecord = subscription.payments.find(p => p.razorpay_order_id === order_id);
    if (!paymentRecord) {
      return res.status(404).json({ message: 'Payment record not found in subscription' });
    }

    paymentRecord.razorpay_payment_id = payment_id;
    paymentRecord.razorpay_signature = signature;
    paymentRecord.payment_status = 'completed';
    subscription.updated_at = new Date();

    await subscription.save();

    // 6. Get Admins with valid FCM tokens
    const admins = await User.find({
      role: 'admin',
      fcm_token: { $nin: [null, '', undefined] }
    });

    const adminTokens = admins.map(admin => admin.fcm_token).filter(Boolean);
    const userToken = user.fcm_token;

    const adminPayload = {
      notification: {
        title: 'New Subscription Payment',
        body: `${user.fullname || 'A user'} just paid for a ${scheme_type} subscription.`,
      },
      data: {
        type: 'admin_payment_alert',
        userId: user._id.toString(),
        subscriptionId: subscription._id.toString(),
        timestamp: Date.now().toString()
      }
    };

    const messagingPromises = [];
    const adminSendResults = [];

    // 7. Send admin notifications
    for (const token of adminTokens) {
      messagingPromises.push(
        admin.messaging().send({ ...adminPayload, token })
          .then(response => adminSendResults.push({ token, status: 'fulfilled', response }))
          .catch(error => {
            console.error(`❌ Failed to send admin notification to token [${token}]: ${error.message}`);
            console.debug(error); // Full error object for debugging
            adminSendResults.push({ token, status: 'rejected', error });
          })
          
      );
    }

    let userSendResult = null;

    // 8. Send user notification if token exists
    if (userToken) {
      const userPayload = {
        token: userToken,
        notification: {
          title: 'Payment Successful',
          body: `Your payment for the ${scheme_type} subscription is confirmed.`,
        },
        data: {
          type: 'user_payment_success',
          subscriptionId: subscription._id.toString(),
          timestamp: Date.now().toString()
        }
      };

      messagingPromises.push(
        admin.messaging().send(userPayload)
          .then(response => { userSendResult = { status: 'fulfilled', response }; })
          .catch(error => {
            console.error(`❌ Failed to send user notification to token [${userToken}]: ${error.message}`);
            console.debug(error); // Full error object for debugging
            userSendResult = { status: 'rejected', error };
          })          
      );
    }

    await Promise.allSettled(messagingPromises);

    const adminSuccessCount = adminSendResults.filter(r => r.status === 'fulfilled').length;
    const adminFailureCount = adminSendResults.length - adminSuccessCount;

    const userReceived = userSendResult?.status === 'fulfilled';

    // 9. Final Response
    res.json({
      message: 'Payment verified successfully, notifications sent',
      subscription_id,
      payment_id,
      scheme_type,
      notifications: {
        admin: {
          total: adminSendResults.length,
          sent: adminSuccessCount,
          failed: adminFailureCount
        },
        user: {
          attempted: !!userToken,
          received: userReceived
        }
      }
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};
