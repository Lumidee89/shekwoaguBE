const Movie = require('../models/Movie');
const fs = require('fs');
const path = require('path');

exports.getAllMovies = async (req, res) => {
  try {
    const movies = await Movie.find();
    res.status(200).json({
      status: 'success',
      results: movies.length,
      data: {
        movies
      }
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err.message
    });
  }
};

exports.getMovie = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    res.status(200).json({
      status: 'success',
      data: {
        movie
      }
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err.message
    });
  }
};

exports.createMovie = async (req, res) => {
  try {
    const { title, description, genre, releaseYear, duration, isFeatured } = req.body;
    
    if (!req.files || !req.files.video || !req.files.thumbnail) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please upload both video and thumbnail'
      });
    }

    // Use temporary paths
    const videoFile = req.files.video;
    const thumbnailFile = req.files.thumbnail;

    // Store file references instead of moving files
    const newMovie = await Movie.create({
      title,
      description,
      genre: genre.split(',').map(g => g.trim()),
      releaseYear,
      duration,
      videoUrl: videoFile.tempFilePath, // Store temp path
      thumbnailUrl: thumbnailFile.tempFilePath, // Store temp path
      isFeatured: isFeatured === 'true'
    });

    res.status(201).json({
      status: 'success',
      data: {
        movie: newMovie
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

exports.updateMovie = async (req, res) => {
  try {
    const movie = await Movie.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      status: 'success',
      data: {
        movie
      }
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err.message
    });
  }
};

exports.deleteMovie = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    
    if (!movie) {
      return res.status(404).json({
        status: 'fail',
        message: 'No movie found with that ID'
      });
    }

    // Delete associated files
    const videoPath = path.join(__dirname, '..', movie.videoUrl);
    const thumbnailPath = path.join(__dirname, '..', movie.thumbnailUrl);

    fs.unlink(videoPath, err => {
      if (err) console.error('Error deleting video file:', err);
    });
    fs.unlink(thumbnailPath, err => {
      if (err) console.error('Error deleting thumbnail file:', err);
    });

    await Movie.findByIdAndDelete(req.params.id);

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err.message
    });
  }
};