const express = require('express');
const downloadController = require('../controllers/downloadController');
const authController = require('../controllers/authController');
const subscriptionController = require('../controllers/subscriptionController');

const router = express.Router();

// All download routes require authentication AND active subscription
router.use(authController.protect);
router.use(subscriptionController.checkSubscriptionAccess);

// Download a movie
router.post('/movie/:movieId', downloadController.downloadMovie);

// Get user's downloads
router.get('/my', downloadController.getMyDownloads);

// Remove download
router.delete('/:downloadId', downloadController.removeDownload);

// Update play progress
router.patch('/:downloadId/progress', downloadController.updatePlayProgress);

// Check if movie is downloaded
router.get('/check/:movieId', downloadController.checkDownloadStatus);

module.exports = router;