const { GoldSubscription } = require('../models/Subscription');
const { DiamondSubscription } = require('../models/Subscription');
const User = require('../models/User');
const Scheme = require('../models/Scheme');
const moment = require('moment');
const Rate = require('../models/Rate');
const admin = require('./../config/firebase');

const createGoldSubscription = async (req, res) => {
  try {
    const { user_id, scheme_id, amount, weight } = req.body;
    
    // Fetch the user from the database
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }
    
    // Ensure KYC is completed
    if (!user.kyc || !user.kyc.aadhaar_images || !user.kyc.pan_images || !user.aadhaar_number || !user.pan_number) {
      return res.status(400).json({ message: "User KYC not completed" });
    }

    // Fetch the scheme based on scheme_id
    const scheme = await Scheme.findById(scheme_id);
    if (!scheme) {
      return res.status(400).json({ message: "Scheme not found" });
    }

    // Check if the scheme type is 'gold'
    if (scheme.scheme_type !== 'gold') {
      return res.status(400).json({ message: "This is not a Gold subscription scheme" });
    }

    // Check if the scheme requires amount or weight
    const isAmountRequired = scheme.is_weight_or_amount === 'amount';
    const isWeightRequired = scheme.is_weight_or_amount === 'weight';

    let initialAmount;

    // If amount is required
    if (isAmountRequired) {
      if (!amount) {
        return res.status(400).json({ message: "Amount is required for this Gold subscription scheme" });
      }
      initialAmount = amount;
    }
    
    // If weight is required
    if (isWeightRequired) {
      if (!weight) {
        return res.status(400).json({ message: "Weight is required for this Gold subscription scheme" });
      }

      // Fetch today's gold rate from the Rate collection
      const goldRate = await Rate.findOne().sort({ created_at: -1 }); // Get the latest gold rate based on created_at
      if (!goldRate) {
        return res.status(400).json({ message: "Gold rate not found" });
      }

      // Calculate the initial amount based on weight and gold rate
      initialAmount = weight * goldRate.gold_rate;
    }

    // Create subscription data
    const subscriptionData = {
      user_id,
      scheme_id,
      subscribe_status: 'waiting',
      created_at: new Date(),
      updated_at: new Date(),
      due_date: null,
      initial_amount: initialAmount,
    };

    // Store weight if applicable
    if (isWeightRequired) {
      subscriptionData.weight = weight;
    }

    // Create and save the subscription
    const subscription = new GoldSubscription(subscriptionData);
    await subscription.save();
    
    // Fetch admin users with valid FCM tokens
    const admins = await User.find({ 
      role: 'admin', 
      fcm_token: { $nin: [null, '', undefined] } 
    });
    
    const adminTokens = admins.map(admin => admin.fcm_token).filter(Boolean);
    console.log('Admin FCM Tokens:', adminTokens);
    
    if (adminTokens.length > 0) {
      // Create a single message payload
      const notificationPayload = {
        notification: {
          title: 'New Gold Subscription',
          body: `${user.fullname} has subscribed to the Gold scheme.`,
        },
        data: {
          userId: user._id.toString(),
          subscriptionId: subscription._id.toString(),
          type: 'gold_subscription',
          timestamp: Date.now().toString()
        }
      };
      
      // Send the same notification to all admin tokens
      const messagingPromises = adminTokens.map(token => {
        return admin.messaging().send({
          ...notificationPayload,
          token: token
        });
      });
      
      // Wait for all of them at once
      const messageResults = await Promise.all(messagingPromises.map(p => 
        p.catch(err => ({ error: err.message }))
      ));
      
      const successfulMessages = messageResults.filter(result => !result.error);
      
      const notificationResult = {
        success: successfulMessages.length > 0,
        sentTo: successfulMessages.length,
        totalAdmins: adminTokens.length,
        failureCount: messageResults.length - successfulMessages.length
      };
      
      // Respond back with notification results
      res.status(201).json({
        message: "Gold subscription created successfully and admins notified",
        subscription,
        notification_result: notificationResult
      });
    } else {
      // No admin tokens found
      res.status(201).json({
        message: "Gold subscription created successfully, but no admins available for notification",
        subscription
      });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred while creating the subscription", error });
  }
};

const createDiamondSubscription = async (req, res) => {
  try {
    const { user_id, scheme_id, initial_amount } = req.body;
    
    // Fetch user
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }
    
    // Check KYC completion
    if (!user.kyc || !user.kyc.aadhaar_images || !user.kyc.pan_images || !user.aadhaar_number || !user.pan_number) {
      return res.status(400).json({ message: "User KYC not completed" });
    }
    
    // Fetch scheme
    const scheme = await Scheme.findById(scheme_id);
    if (!scheme) {
      return res.status(400).json({ message: "Scheme not found" });
    }
    
    // Validate scheme type
    if (scheme.scheme_type !== 'diamond') {
      return res.status(400).json({ message: "This is not a Diamond subscription scheme" });
    }
    
    // Check initial amount
    if (!initial_amount) {
      return res.status(400).json({ message: "Amount is required for Diamond subscription" });
    }
    
    // Create new subscription
    const subscriptionData = {
      user_id,
      scheme_id,
      initial_amount,
      payment_status: 'pending',
      subscribe_status: 'waiting',
      created_at: new Date(),
    };
    
    const subscription = new DiamondSubscription(subscriptionData);
    await subscription.save();
    
    // Fetch admin users with valid FCM tokens
    const admins = await User.find({ 
      role: 'admin', 
      fcm_token: { $nin: [null, '', undefined] } 
    });
    
    const adminTokens = admins.map(admin => admin.fcm_token).filter(Boolean);
    console.log('Admin FCM Tokens:', adminTokens);
    
    if (adminTokens.length > 0) {
      // Create a single message payload
      const notificationPayload = {
        notification: {
          title: 'New Diamond Subscription',
          body: `${user.fullname} has subscribed to the Diamond scheme.`,
        },
        data: {
          userId: user._id.toString(),
          subscriptionId: subscription._id.toString(),
          type: 'diamond_subscription',
          timestamp: Date.now().toString()
        }
      };
      
      const messagingPromises = adminTokens.map(token => {
        return admin.messaging().send({
          ...notificationPayload,
          token: token
        });
      });
      
      const messageResults = await Promise.all(messagingPromises.map(p => 
        p.catch(err => ({ error: err.message }))
      ));
      
      const successfulMessages = messageResults.filter(result => !result.error);
      
      const notificationResult = {
        success: successfulMessages.length > 0,
        sentTo: successfulMessages.length,
        totalAdmins: adminTokens.length,
        failureCount: messageResults.length - successfulMessages.length
      };
      
      // Respond back
      res.status(201).json({
        message: "Diamond subscription created successfully and admins notified",
        subscription,
        notification_result: notificationResult
      });
    } else {
      // No admin tokens found
      res.status(201).json({
        message: "Diamond subscription created successfully, but no admins available for notification",
        subscription
      });
    }
    
  } catch (error) {
    console.error('Error in createDiamondSubscription:', error);
    res.status(500).json({
      message: "An error occurred while creating the subscription",
      error: error.message
    });
  }
};


const updateGoldSubscription = async (req, res) => {
  try {
    const { subscription_id } = req.params;
    const { subscribe_status, isVerifiedKyc } = req.body;

    // Find the subscription by ID
    const subscription = await GoldSubscription.findById(subscription_id);
    if (!subscription) {
      return res.status(404).json({ message: "Gold subscription not found" });
    }

    // Extract the user_id from the subscription
    const { user_id } = subscription;

    // Handle subscription activation
    let updatedFields = { subscribe_status };
    if (subscribe_status === 'active') {
      const initialDate = moment().startOf('day').toDate();
      const endDate = moment(initialDate).add(11, 'months').toDate();

      // Generate the due dates for 11 months
      const dueDates = Array.from({ length: 11 }, (_, index) =>
        moment(initialDate).add(index + 1, 'months').toDate()
      );

      updatedFields = {
        ...updatedFields,
        initial_date: initialDate,
        end_date: endDate,
        due_date: dueDates,
      };
    }

    // Update the subscription details
    const result = await GoldSubscription.updateOne(
      { _id: subscription_id }, // Filter to match the subscription by ID
      { $set: updatedFields }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ message: "Failed to update Gold subscription" });
    }

    // Update the user's isVerifiedKyc status if provided in the request
    let userUpdateMessage = "No updates were made to the user's KYC status.";
    if (typeof isVerifiedKyc === 'boolean') {
      const userUpdateResult = await User.updateOne(
        { _id: user_id }, // Match the user by ID
        { $set: { isVerifiedKyc } }
      );

      if (userUpdateResult.modifiedCount > 0) {
        userUpdateMessage = "User's KYC status updated successfully.";
      } else {
        userUpdateMessage = "Failed to update user's KYC status.";
      }
    }

    // Fetch the updated subscription
    const updatedSubscription = await GoldSubscription.findById(subscription_id);

    res.status(200).json({
      message: "Gold subscription updated successfully",
      subscription: updatedSubscription,
      user: {
        user_id,
        isVerifiedKyc,
        userUpdateMessage,
      },
    });
  } catch (error) {
    console.error("Error updating Gold subscription:", error);
    res.status(500).json({
      message: "An error occurred while updating the Gold subscription",
      error: error.message,
    });
  }
};


const updateDiamondSubscription = async (req, res) => {
  try {
    const { subscription_id } = req.params; 
    const { subscribe_status, isVerifiedKyc } = req.body;

    // Find the subscription by ID
    const subscription = await DiamondSubscription.findById(subscription_id);
    if (!subscription) {
      return res.status(404).json({ message: "Diamond subscription not found" });
    }

    // Extract the user_id from the subscription
    const { user_id } = subscription;

    // Handle subscription activation
    let updatedFields = { subscribe_status };
    if (subscribe_status === 'active') {
      const initialDate = moment().startOf('day').toDate();
      const endDate = moment(initialDate).add(11, 'months').toDate();

      // Generate the due dates for 11 months
      const dueDates = Array.from({ length: 11 }, (_, index) =>
        moment(initialDate).add(index + 1, 'months').toDate()
      );

      updatedFields = {
        ...updatedFields,
        initial_date: initialDate,
        end_date: endDate,
        due_date: dueDates,
      };
    }

    // Update the subscription details
    const result = await DiamondSubscription.updateOne(
      { _id: subscription_id }, // Filter to match the subscription by ID
      { $set: updatedFields }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ message: "Failed to update Diamond subscription" });
    }

    // Update the user's isVerifiedKyc status if provided in the request
    let userUpdateMessage = "No updates were made to the user's KYC status.";
    if (typeof isVerifiedKyc === 'boolean') {
      const userUpdateResult = await User.updateOne(
        { _id: user_id }, // Match the user by ID
        { $set: { isVerifiedKyc } }
      );

      if (userUpdateResult.modifiedCount > 0) {
        userUpdateMessage = "User's KYC status updated successfully.";
      } else {
        userUpdateMessage = "Failed to update user's KYC status.";
      }
    }

    // Fetch the updated subscription
    const updatedSubscription = await DiamondSubscription.findById(subscription_id);

    res.status(200).json({
      message: "Diamond subscription updated successfully",
      subscription: updatedSubscription,
      user: {
        user_id,
        isVerifiedKyc,
        userUpdateMessage,
      },
    });
  } catch (error) {
    console.error("Error updating Diamond subscription:", error);
    res.status(500).json({
      message: "An error occurred while updating the Diamond subscription",
      error: error.message,
    });
  }
};


const getSubscriptionReport = async (req, res) => {
  try {
    const goldSubscriptions = await GoldSubscription.find({});
    const diamondSubscriptions = await DiamondSubscription.find({});

    const fetchSchemeAndUserDetails = async (subscriptions) => {
      return Promise.all(
        subscriptions.map(async (subscription) => {
          let scheme = null;
          let userPhone = null;
          let fcmToken = null;

          if (subscription.scheme_id) {
            scheme = await Scheme.findById(subscription.scheme_id);
          }

          if (subscription.user_id) {
            const user = await User.findById(subscription.user_id, 'phonenumber fcm_token');
            userPhone = user?.phonenumber || null;
            fcmToken = user?.fcm_token || null;
          }

          const monthlyAmount = subscription.initial_amount; // Assuming fixed amount per month
          const dueDates = subscription.due_date || [];

          // Filter completed payments
          const completedPayments = (subscription.payments || []).filter(p => p.payment_status === 'completed');

          // Total amount paid
          const totalPaid = completedPayments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);

          // Number of dues fully covered by payment
          const fullyPaidCount = Math.floor(totalPaid / monthlyAmount);

          // Status array: true for paid, false for unpaid
          const due_dates_status = dueDates.map((_, index) => index < fullyPaidCount);

          return {
            ...subscription.toObject(),
            schemeDetails: scheme || null,
            phonenumber: userPhone,
            fcm_token: fcmToken,
            due_dates_status
          };
        })
      );
    };

    const goldSubscriptionsWithDetails = await fetchSchemeAndUserDetails(goldSubscriptions);
    const diamondSubscriptionsWithDetails = await fetchSchemeAndUserDetails(diamondSubscriptions);

    const subscriptionReport = {
      gold: goldSubscriptionsWithDetails,
      diamond: diamondSubscriptionsWithDetails,
    };

    res.status(200).json({
      message: "Subscription report retrieved successfully",
      data: subscriptionReport,
    });
  } catch (error) {
    console.error("Error fetching subscription report:", error);
    res.status(500).json({
      message: "An error occurred while fetching the subscription report",
      error: error.message,
    });
  }
};


// const getSubscriptionReport = async (req, res) => {
//   try {
//     const goldSubscriptions = await GoldSubscription.find({});
//     const diamondSubscriptions = await DiamondSubscription.find({});
//     const fetchSchemeDetails = async (subscriptions) => {
//       return Promise.all(
//         subscriptions.map(async (subscription) => {
//           if (subscription.scheme_id) {
//             const scheme = await Scheme.findById(subscription.scheme_id);
//             return {
//               ...subscription.toObject(),
//               schemeDetails: scheme || null,
//             };
//           }
//           return subscription;
//         })
//       );
//     };
//     const goldSubscriptionsWithSchemes = await fetchSchemeDetails(goldSubscriptions);
//     const diamondSubscriptionsWithSchemes = await fetchSchemeDetails(diamondSubscriptions);
//     const subscriptionReport = {
//       gold: goldSubscriptionsWithSchemes,
//       diamond: diamondSubscriptionsWithSchemes,
//     };

//     res.status(200).json({
//       message: "Subscription report retrieved successfully",
//       data: subscriptionReport,
//     });
//   } catch (error) {
//     console.error("Error fetching subscription report:", error);
//     res.status(500).json({
//       message: "An error occurred while fetching the subscription report",
//       error: error.message,
//     });
//   }
// };


const { getKYC } = require('./UserController'); 


const getPendingRequests = async (req, res) => {
  try {
    const goldPendingRequests = await GoldSubscription.find({ subscribe_status: "waiting" });
    const diamondPendingRequests = await DiamondSubscription.find({ subscribe_status: "waiting" });

    const allPendingRequests = [...goldPendingRequests, ...diamondPendingRequests];
    if (allPendingRequests.length === 0) {
      return res.status(404).json({ message: "No pending requests found" });
    }

    const serverUrl = `${req.protocol}://${req.get("host")}`;

    const enrichedRequests = await Promise.all(
      allPendingRequests.map(async (request) => {
        try {
          const user = await User.findById(request.user_id);
          let schemeName = null;
          if (request.scheme_id) {
            const scheme = await Scheme.findById(request.scheme_id);
            schemeName = scheme ? scheme.scheme_name : "Scheme not found";
          }

          if (user) {
            const userDetails = { ...user.toObject() };
            delete userDetails.kyc; 

            if (user.kyc && user.kyc.aadhaar_images && user.kyc.pan_images) {
              return {
                ...request.toObject(),
                userDetails,
                schemeName, 
                kyc: {
                  aadhaar_images: user.kyc.aadhaar_images.map((id) => ({
                    fileId: id,
                    url: `${serverUrl}/kyc/image/${id}`,
                  })),
                  pan_images: user.kyc.pan_images.map((id) => ({
                    fileId: id,
                    url: `${serverUrl}/kyc/image/${id}`,
                  })),
                },
              };
            }
            return {
              ...request.toObject(),
              userDetails,
              schemeName,
              message: "KYC data not available",
            };
          }

          return {
            ...request.toObject(),
            userDetails: { message: "User not found" },
            schemeName,
          };
        } catch (err) {
          return {
            ...request.toObject(),
            userDetails: { message: "Error retrieving user details", error: err.message },
            schemeName: "Error fetching scheme",
          };
        }
      })
    );

    res.status(200).json({
      message: "Pending requests retrieved successfully",
      data: enrichedRequests,
    });
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    res.status(500).json({
      message: "An error occurred while fetching the pending requests",
      error: error.message,
    });
  }
};

const getSubscriptionReporUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }
    const goldSubscriptions = await GoldSubscription.find({ user_id });
    const diamondSubscriptions = await DiamondSubscription.find({ user_id });
    const subscriptionReport = {
      gold: goldSubscriptions,
      diamond: diamondSubscriptions,
    };
    res.status(200).json({
      message: "Subscription report retrieved successfully",
      data: subscriptionReport,
    });
  } catch (error) {
    console.error("Error fetching subscription report:", error);
    res.status(500).json({
      message: "An error occurred while fetching the subscription report",
      error: error.message,
    });
  }
};

module.exports = { createGoldSubscription, createDiamondSubscription, updateGoldSubscription,updateDiamondSubscription, getSubscriptionReport, getSubscriptionReporUser,getPendingRequests };
