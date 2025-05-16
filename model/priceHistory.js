import mongoose from 'mongoose';

const priceHistorySchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  yesPrice: {
    type: Number,
    required: true
  },
  noPrice: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Create index for efficient queries
priceHistorySchema.index({ eventId: 1, timestamp: -1 });

const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);

export default PriceHistory; 