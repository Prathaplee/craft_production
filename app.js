// app.js
const express = require('express');
const cors = require('cors');
const app = express();
const mongoose = require('./config/database'); // Import the database connection
const userRoutes = require('./routes/userRoutes');
const schemeRoutes = require('./routes/schemeRoutes');
const subscribeRoutes = require('./routes/subscriptionRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const referralRoutes = require('./routes/referralRoutes');
const rateRoutes = require('./routes/rateRoutes');
const versionRoutes = require('./routes/versionRoutes');
const authRoutes=require('./routes/authRoutes.js')
const routes=require('./routes/routes.js')
const os = require('os'); 
const cron = require('node-cron');
const notification = require('./controllers/notificationController');
const sendReminderNotifications = require('./crons/reminderCron.js');

const { swaggerUi, swaggerDocs } = require('./swagger'); 
const verifyToken = require('./auth.js'); 
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocs); 
});

app.use('/', authRoutes);

// Apply the token verification middleware to protected routes
// app.use('/',  verifyToken, userRoutes);
// app.use('/', verifyToken, schemeRoutes);
// app.use('/', verifyToken, subscribeRoutes);
// app.use('/', verifyToken, paymentRoutes);
// app.use('/', verifyToken, referralRoutes);
// app.use('/', verifyToken, rateRoutes);
// app.use('/', verifyToken, versionRoutes);
// app.use('/',  routes);

app.use('/', userRoutes, cors());
app.use('/', schemeRoutes);
app.use('/', subscribeRoutes);
app.use('/',  paymentRoutes);
app.use('/',  referralRoutes);
app.use('/',  rateRoutes);
app.use('/',  versionRoutes);
app.use('/',  notification);


const getLocalIp = () => {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    for (const iface of interfaces[interfaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1'; // Default to localhost if no external IP is found
};

// Start server
const port = process.env.PORT || 3000;
const ipAddress = getLocalIp(); // Use the function to get the IP address
app.listen(port, () => {
  console.log(`Server started on http://${ipAddress}:${port}`);
  console.log(`Swagger Docs available at http://${ipAddress}:${port}/api-docs`);
});


cron.schedule('0 10 * * *', async () => {
  console.log('Morning Reminder Triggered');
  await sendReminderNotifications();
});

cron.schedule('0 17 * * *', async () => {
  console.log('Evening Reminder Triggered');
  await sendReminderNotifications();
});
