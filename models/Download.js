const mongoose = require('mongoose');

const downloadSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  movie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true
  },
  movieDetails: {
    title: { type: String, required: true },
    thumbnailUrl: { type: String, required: true },
    duration: { type: Number },
    releaseYear: { type: Number },
    genre: { type: [String] },
    description: { type: String }
  },
  downloadDate: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 30*24*60*60*1000) 
  },
  isExpired: {
    type: Boolean,
    default: false
  },
  lastPlayed: {
    type: Date
  },
  playProgress: {
    type: Number,
    default: 0 
  }
});

downloadSchema.index({ user: 1, movie: 1 }, { unique: true }); 
downloadSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Download', downloadSchema);