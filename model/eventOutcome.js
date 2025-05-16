import mongoose from 'mongoose';

const eventOutcomeSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vote: {
    type: String,
    enum: ['yes', 'no'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  costAmount: {
    type: Number,
    required: true
  },
  potentialReward: {
    type: Number,
    required: true
  },
  isWinner: {
    type: Boolean,
    default: null
  },
  processed: {
    type: Boolean,
    default: false
  },
  processedAt: {
    type: Date,
    default: null
  }
});

// Method to process outcome and distribute rewards
eventOutcomeSchema.methods.processReward = async function() {
  if (this.processed) return;

  const event = await mongoose.model('Event').findById(this.eventId);
  const user = await mongoose.model('User').findById(this.userId);

  if (!event || !user) return;

  // Check if event has ended
  if (event.status !== 'ended' || !event.outcome) return;

  // Determine if user won
  this.isWinner = this.vote === event.outcome;

  // Update user balance
  if (this.isWinner) {
    user.balance += this.potentialReward;
  }

  // Mark as processed
  this.processed = true;
  this.processedAt = new Date();

  await Promise.all([this.save(), user.save()]);

  // Emit balance updated event
  const io = global.io;
  if (io) {
    io.emit('userBalanceUpdated', {
      userId: user._id,
      newBalance: user.balance
    });
  }
};

// Static method to process all unprocessed outcomes
eventOutcomeSchema.statics.processAllOutcomes = async function() {
  const unprocessedOutcomes = await this.find({ processed: false });
  
  for (const outcome of unprocessedOutcomes) {
    await outcome.processReward();
  }
};

const EventOutcome = mongoose.model('EventOutcome', eventOutcomeSchema);

export default EventOutcome; 