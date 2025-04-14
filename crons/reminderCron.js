const cron = require('node-cron');
const admin = require('../config/firebase');
const User = require('../models/User'); 

cron.schedule('*/1 * * * *', async () => {
  try {
    const users = await User.find({ fcm_token: { $ne: null } });

    for (const user of users) {
      const message = {
        notification: {
          title: 'Subscription Reminder',
          body: 'Your subscription is active. Please check if payment is due!',
        },
        token: user.fcm_token,
      };

      await admin.messaging().send(message);
      console.log(`Notification sent to ${user.phonenumber}`);
    }
  } catch (err) {
    console.error('Error sending reminders:', err);
  }
});
