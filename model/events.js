// models/Event.js
import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  yes: {
    type: Number,
    default: 1
  },
  no: {
    type: Number,
    default: 1
  },
  yesVotes: {
    type: Number,
    default: 0
  },
  noVotes: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  endingAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active'
  },
  outcome: {
    type: String,
    enum: ['yes', 'no', null],
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  category:{
    type: String,
    required: true
  }
});

// Calculate prices based on votes
eventSchema.methods.calculatePrices = function() {
  const totalVotes = this.yesVotes + this.noVotes;
  if (totalVotes === 0) {
    this.yes = 1;
    this.no = 1;
  } else {
    // Calculate probabilities
    const yesProbability = this.yesVotes / totalVotes;
    const noProbability = this.noVotes / totalVotes;

    // Higher probability should result in higher price
    // Using a base price of 10 rupees
    this.yes = (10 * (0.2 + 0.8 * yesProbability)).toFixed(1);
    this.no = (10 * (0.2 + 0.8 * noProbability)).toFixed(1);
  }
  return { yes: this.yes, no: this.no };
};

// Method to check if event has ended and process outcome
eventSchema.methods.processOutcome = async function() {
  const now = new Date();
  if (now >= this.endingAt && this.status === 'active') {
    this.status = 'ended';
    this.outcome = this.yesVotes > this.noVotes ? 'yes' : 'no';
    await this.save();

    // Process all outcomes for this event immediately
    const EventOutcome = mongoose.model('EventOutcome');
    const outcomes = await EventOutcome.find({ eventId: this._id, processed: false });
    
    for (const outcome of outcomes) {
      await outcome.processReward();
    }

    // Emit event ended signal
    const io = global.io; // Make sure you have access to the io instance
    if (io) {
      io.emit('eventEnded', this._id);
      io.emit('balanceUpdated'); // Add this event for real-time balance updates
    }

    return true;
  }
  return false;
};

// Static method to process all ended events
eventSchema.statics.processEndedEvents = async function() {
  const events = await this.find({
    status: 'active',
    endingAt: { $lte: new Date() }
  });

  for (const event of events) {
    await event.processOutcome();
  }

  // After processing ended events, clean up old ones
  await this.cleanupEndedEvents();
};

// Add this to the existing eventSchema
eventSchema.statics.cleanupEndedEvents = async function() {
  const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const cutoffDate = new Date(Date.now() - ONE_DAY); // Events older than 24 hours

  try {
    // Find ended events older than the cutoff date
    const oldEndedEvents = await this.find({
      status: 'ended',
      endingAt: { $lt: cutoffDate }
    });

    for (const event of oldEndedEvents) {
      // Delete associated records first
      await Promise.all([
        mongoose.model('UserVote').deleteMany({ eventId: event._id }),
        mongoose.model('EventOutcome').deleteMany({ eventId: event._id }),
        mongoose.model('PriceHistory').deleteMany({ eventId: event._id })
      ]);

      // Then delete the event itself
      await event.deleteOne();
    }

    return oldEndedEvents.length; // Return number of deleted events
  } catch (error) {
    console.error('Error cleaning up ended events:', error);
    throw error;
  }
};

const Event = mongoose.model('Event', eventSchema);

export default Event;