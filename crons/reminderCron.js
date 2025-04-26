const moment = require('moment');  
const admin = require('firebase-admin'); 
const { GoldSubscription } = require('../models/Subscription');
const { DiamondSubscription } = require('../models/Subscription');
const User = require('../models/User');

const sendReminderNotifications = async () => {
  try {
    const today = moment().startOf('day'); 

    const diamondSubscriptions = await DiamondSubscription.find({ subscribe_status: 'active' });
    const goldSubscriptions = await GoldSubscription.find({ subscribe_status: 'active' });

    const allSubscriptions = [...diamondSubscriptions, ...goldSubscriptions];

    for (const subscription of allSubscriptions) {
      for (const dueDate of subscription.due_date) {
        const now = moment(); 
        const due = moment(dueDate);
        const daysLeft = due.diff(today, 'days');

        // console.log(`Checking due date: ${due.format('YYYY-MM-DD')}, Today: ${today.format('YYYY-MM-DD')}, Days Left: ${daysLeft}`);

        if ([7, 3, 1, 0].includes(daysLeft)) {
          const user = await User.findById(subscription.user_id);
          if (!user) {
            console.log(`User not found for subscription ${subscription._id}`);
            continue;
          }
          if (!user.fcm_token) {
            console.log(`No FCM token for user ${user.fullname || user.name}`);
            continue;
          }

          let reminderText = '';
          if (daysLeft === 7) reminderText = '7 days left';
          else if (daysLeft === 3) reminderText = '3 days left';
          else if (daysLeft === 1) reminderText = '1 day left';
          else if (daysLeft === 0) reminderText = 'Today is your due date';

          let session = '';
          const currentHour = now.hour();
          if (currentHour < 12) {
            session = 'Morning Reminder'; 
          } else {
            session = 'Evening Reminder'; 
          }

          const messageTitle = 'Upcoming Payment Reminder';
          const messageBody = `Hi ${user.fullname || user.name}, ${session}: Your payment is due on ${due.format('YYYY-MM-DD')} (${reminderText}). Please pay to continue your subscription.`;
          
          // console.log(`Sending Message to ${user.fullname || user.name}:`, messageBody);

          const message = {
            token: user.fcm_token,
            notification: {
              title: messageTitle,
              body: messageBody,
            },
            data: {
              subscriptionId: subscription._id.toString(),
              dueDate: due.toISOString(),
            },
          };
     
          try {
            const response = await admin.messaging().send(message);
            console.log(`${session} sent to ${user.fullname || user.name}:`, response);
          } catch (notifErr) {
            console.error(`Error sending ${session} to ${user.fullname || user.name}:`, notifErr.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in sending reminder notifications:', error.message);
  }
};

module.exports = sendReminderNotifications;
