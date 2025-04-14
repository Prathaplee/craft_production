const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');

/**
 * @swagger
 * /pending_requests:
 *   get:
 *     summary: Retrieve all pending subscription requests with user details.
 *     tags:
 *       - Subscription
 *     security:
 *       - BearerAuth: []
 *     description: Fetch all subscription requests with `subscribe_status` set to `waiting`, and for each request, retrieve the associated user details.
 *     responses:
 *       200:
 *         description: List of pending requests with user details.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Pending requests retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "subscriptionId1"
 *                       subscribe_status:
 *                         type: string
 *                         example: "waiting"
 *                       user_id:
 *                         type: string
 *                         example: "userId1"
 *                       userDetails:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "userId1"
 *                           name:
 *                             type: string
 *                             example: "John Doe"
 *                           email:
 *                             type: string
 *                             example: "john@example.com"
 *                           message:
 *                             type: string
 *                             example: "User not found"
 *       404:
 *         description: No pending requests found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "No pending requests found"
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "An error occurred while fetching the pending requests"
 *                 error:
 *                   type: string
 *                   example: "Database connection failed"
 */
router.get('/pending_requests', subscriptionController.getPendingRequests);

module.exports = router;
