const Download = require('../models/Download');
const Movie = require('../models/Movie');

// Download a movie (add to My Downloads)
exports.downloadMovie = async (req, res) => {
  try {
    const { movieId } = req.params;
    const userId = req.user.id;

    // Check if movie exists
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({
        status: 'fail',
        message: 'Movie not found'
      });
    }

    // Check if already downloaded
    const existingDownload = await Download.findOne({
      user: userId,
      movie: movieId
    });

    if (existingDownload) {
      // Update expiry date
      existingDownload.expiresAt = new Date(+new Date() + 30*24*60*60*1000);
      existingDownload.isExpired = false;
      await existingDownload.save();

      return res.status(200).json({
        status: 'success',
        message: 'Movie already in your downloads',
        data: {
          download: existingDownload
        }
      });
    }

    // Create new download
    const download = await Download.create({
      user: userId,
      movie: movieId,
      movieDetails: {
        title: movie.title,
        thumbnailUrl: movie.thumbnailUrl,
        duration: movie.duration,
        releaseYear: movie.releaseYear,
        genre: movie.genre,
        description: movie.description
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Movie added to your downloads',
      data: {
        download
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Get user's downloads
exports.getMyDownloads = async (req, res) => {
  try {
    const userId = req.user.id;

    // Clean up expired downloads first
    await Download.updateMany(
      {
        user: userId,
        expiresAt: { $lt: new Date() },
        isExpired: false
      },
      {
        isExpired: true
      }
    );

    // Get active downloads
    const downloads = await Download.find({
      user: userId,
      isExpired: false
    }).sort({ downloadDate: -1 });

    res.status(200).json({
      status: 'success',
      results: downloads.length,
      data: {
        downloads
      }
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Remove download
exports.removeDownload = async (req, res) => {
  try {
    const { downloadId } = req.params;
    const userId = req.user.id;

    const download = await Download.findOneAndDelete({
      _id: downloadId,
      user: userId
    });

    if (!download) {
      return res.status(404).json({
        status: 'fail',
        message: 'Download not found'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Movie removed from downloads',
      data: null
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Update play progress
exports.updatePlayProgress = async (req, res) => {
  try {
    const { downloadId } = req.params;
    const { progress } = req.body;
    const userId = req.user.id;

    const download = await Download.findOneAndUpdate(
      {
        _id: downloadId,
        user: userId
      },
      {
        playProgress: progress,
        lastPlayed: new Date()
      },
      {
        new: true
      }
    );

    if (!download) {
      return res.status(404).json({
        status: 'fail',
        message: 'Download not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        download
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Check if movie is downloaded
exports.checkDownloadStatus = async (req, res) => {
  try {
    const { movieId } = req.params;
    const userId = req.user.id;

    const download = await Download.findOne({
      user: userId,
      movie: movieId,
      isExpired: false
    });

    res.status(200).json({
      status: 'success',
      data: {
        isDownloaded: !!download,
        download: download || null
      }
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err.message
    });
  }
};