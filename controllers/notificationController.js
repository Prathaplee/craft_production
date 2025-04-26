const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const User = require('../models/User');

router.post('/send-custom-notification', async (req, res) => {
  try {
    const { title, message, userIds } = req.body;

    if (!title || !message || !Array.isArray(userIds)) {
      return res.status(400).json({ error: 'Missing or invalid title, message, or userIds' });
    }

    const users = await User.find({ _id: { $in: userIds } });

    if (!users.length) {
      return res.status(404).json({ error: 'No users found with provided IDs' });
    }

    const notifications = [];

    for (const user of users) {
      if (!user.fcm_token) {
        console.log(`User ${user.fullname || user.name} has no FCM token`);
        continue;
      }

      const notification = {
        token: user.fcm_token,
        notification: {
          title,
          body: message,
        },
        data: {
          userId: user._id.toString(),
        },
      };

      notifications.push(notification);
    }

    const responses = [];
    for (const notif of notifications) {
      try {
        const response = await admin.messaging().send(notif);
        responses.push({ token: notif.token, status: 'sent', response });
      } catch (error) {
        responses.push({ token: notif.token, status: 'failed', error: error.message });
      }
    }

    res.json({ message: 'Notifications processed', details: responses });
  } catch (error) {
    console.error('Error sending custom notifications:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
