const express = require('express');
const movieController = require('../controllers/movieController');
const authController = require('../controllers/authController');
const subscriptionController = require('../controllers/subscriptionController');

const router = express.Router();

// Public routes
router.get('/', movieController.getAllMovies);
router.get('/:id', movieController.getMovie);

router.use(authController.protect);
router.get('/watch/:id', subscriptionController.checkSubscriptionAccess, movieController.getMovieWithVideo);

// Admin-only routes
router.use(authController.restrictTo('admin'));

router.post('/', movieController.createMovie);
router.patch('/:id', movieController.updateMovie);
router.delete('/:id', movieController.deleteMovie);

module.exports = router;