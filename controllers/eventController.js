// Updated backend code for voting system

import Event from '../model/events.js';
import User from '../model/user.js'; // Assuming you have a User model
import PriceHistory from '../model/priceHistory.js';
import UserVote from '../model/userVote.js';
import { startOfDay, subDays } from 'date-fns';
import EventOutcome from '../model/eventOutcome.js';
import mongoose from 'mongoose';

// Get event by ID with current data
export const getEventById = async (req, res) => {
  console.log('Backend: getEventById called');
  
  try {
    const { id } = req.params;
    console.log('Backend: Fetching event with ID:', id);

    // Use the direct MongoDB query since we know it works
    const event = await mongoose.connection.collection('events').findOne({
      _id: new mongoose.Types.ObjectId(id)
    });

    if (!event) {
      console.log('Backend: Event not found');
      return res.status(404).json({ message: 'Event not found' });
    }

    // Get price history
    const sevenDaysAgo = subDays(startOfDay(new Date()), 7);
    const priceHistory = await PriceHistory.find({
      eventId: new mongoose.Types.ObjectId(id),
      timestamp: { $gte: sevenDaysAgo }
    }).sort({ timestamp: 1 }).lean();

    // Get user vote if authenticated
    let userVote = null;
    if (req.user) {
      userVote = await UserVote.findOne({
        userId: req.user.userId,
        eventId: new mongoose.Types.ObjectId(id)
      }).lean();
    }

    // Populate creator information
    const creator = await mongoose.connection.collection('users').findOne({
      _id: new mongoose.Types.ObjectId(event.createdBy)
    }, { projection: { username: 1 } });

    const responseData = {
      event: {
        ...event,
        createdBy: creator ? { _id: creator._id, username: creator.username } : null,
        userVote
      },
      priceHistory
    };

    console.log('Backend: Sending response:', responseData);
    return res.status(200).json(responseData);

  } catch (err) {
    console.error('Backend Error in getEventById:', err);
    return res.status(500).json({ 
      message: 'Server error while fetching event',
      error: err.message 
    });
  }
};

// Create event (keep as is)
export const createEvent = async (req, res) => {
  try {
    const { question, description, yes, no, createdAt, endingAt, quantity, category } = req.body;
    if(!question){
      return res.status(400).json({ message: 'Question is required' });
    }
    if(!description){
      return res.status(400).json({ message: 'Description is required' });
    }
    if(!endingAt){
      return res.status(400).json({ message: 'Ending at is required' });
    }
    if(!quantity){
      return res.status(400).json({ message: 'Quantity is required' });
    }
    if(!category){
      return res.status(400).json({ message: 'Category is required' });
    }
    
    const existingEvent = await Event.findOne({ question });
    if (existingEvent) {
      return res.status(400).json({ message: 'Event with this question already exists' });
    }
    const newEvent = new Event({ 
      question, 
      description, 
      yes: 1, 
      no: 1, 
      createdAt: new Date(),
      endingAt,
      quantity,
      createdBy: req.user.userId,
      category
    });
    const savedEvent = await newEvent.save();
    console.log('Saved Event:', savedEvent);
    res.status(201).json(newEvent);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



// Get all events with optional category filter
export const getEvents = async (req, res) => {
  try {
    const events = await Event.find()
    .populate('createdBy', 'username') // Only populate username from creator
    .sort({ createdAt: -1 });
    res.status(200).json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get user's voted events
export const getUserVotedEvents = async (req, res) => {
  try {
    const userVotes = await UserVote.find({ userId: req.user.userId })
      .sort({ timestamp: -1 })
      .populate({
        path: 'eventId',
        populate: { path: 'createdBy', select: 'username' }
      });

    // Transform the data to include vote information
    const votedEvents = userVotes
      .filter(vote => vote.eventId !== null)
      .map(vote => ({
        ...vote.eventId.toObject(),
        userVote: {
          vote: vote.vote,
          quantity: vote.quantity,
          timestamp: vote.timestamp
        }
      }));

    // Process any ended events that haven't been processed yet
    await Event.processEndedEvents();

    res.status(200).json(votedEvents);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Modified voting function to track user votes and potential rewards
export const voteEvent = async (req, res) => {
  const { id } = req.params;
  const { vote, quantity, isUpdate } = req.body;
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  try {
    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Check if event has ended
    if (event.status === 'ended') {
      return res.status(400).json({ message: 'This event has ended' });
    }

    // Check for existing vote if not an update
    if (!isUpdate) {
      const existingVote = await UserVote.findOne({ userId: user._id, eventId: event._id });
      if (existingVote) {
        return res.status(400).json({ 
          message: 'You have already voted on this event. Please use the update vote feature from your profile.',
          hasVoted: true
        });
      }
    }

    const cost = vote === 'yes' ? event.yes * quantity : event.no * quantity;
    const potentialWinnings = 10 * quantity; // Fixed return of 10 rupees per quantity

    if (user.balance < cost) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    let userVote;
    if (isUpdate) {
      // For updates, find and update the existing vote
      userVote = await UserVote.findOne({ userId: user._id, eventId: event._id });
      if (!userVote) {
        return res.status(404).json({ message: 'No existing vote found to update' });
      }

      // Revert previous vote counts
      if (userVote.vote === 'yes') {
        event.yesVotes -= userVote.quantity;
      } else {
        event.noVotes -= userVote.quantity;
      }

      // Update the vote record
      userVote.vote = vote;
      userVote.quantity = quantity;
      userVote.timestamp = new Date();
      await userVote.save();
    } else {
      // Create new vote record
      userVote = await UserVote.create({
        userId: user._id,
        eventId: event._id,
        vote,
        quantity
      });
    }

    // Create or update event outcome record
    await EventOutcome.findOneAndUpdate(
      { userId: user._id, eventId: event._id },
      {
        vote,
        quantity,
        costAmount: cost,
        potentialReward: potentialWinnings,
        processed: false,
        isWinner: null
      },
      { upsert: true, new: true }
    );

    // Deduct initial cost from user's balance
    user.balance -= cost;
    await user.save();

    // Update vote counts
    if (vote === 'yes') {
      event.yesVotes += parseInt(quantity);
    } else if (vote === 'no') {
      event.noVotes += parseInt(quantity);
    }

    const newPrices = event.calculatePrices();

    // Save price history
    await new PriceHistory({
      eventId: event._id,
      yesPrice: event.yes,
      noPrice: event.no
    }).save();

    await event.save();

    // Process event outcome if it has ended
    await event.processOutcome();

    // Emit updated data to clients
    const io = req.app.get('io');
    if (io) {
      io.emit('voteUpdated', {
        eventId: event._id,
        yesVotes: event.yesVotes,
        noVotes: event.noVotes,
        yesPrice: event.yes,
        noPrice: event.no,
      });
    }

    res.status(200).json({
      event,
      transaction: {
        cost,
        potentialWinnings,
        vote,
        quantity,
        isUpdate: !!isUpdate
      }
    });

  } catch (err) {
    console.error('Vote error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Recalculate all prices (keep as is)
export const recalculateAllPrices = async (req, res) => {
  try {
    const events = await Event.find();
    
    for (const event of events) {
      event.calculatePrices();
      await event.save();
    }
    
    res.status(200).json({ message: 'All event prices recalculated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Keep original voting function for backward compatibility
export const voting = async (req, res) => {
  const { id, vote, quantity } = req.body;
  
  try {
    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    
    // Calculate cost based on the current price and quantity
    const cost = vote === 'yes' ? event.yes * quantity : event.no * quantity;
    
    // Calculate potential winnings (always 10 rupees per quantity)
    const potentialWinnings = 10 * quantity;
    
    // Update vote counts
    if (vote === 'yes') {
      event.yesVotes += parseInt(quantity);
    } else if (vote === 'no') {
      event.noVotes += parseInt(quantity);
    }
    
    // Recalculate prices after voting
    const newPrices = event.calculatePrices();
    
    await event.save();
    
    // Emit updated vote counts and prices via socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('voteUpdated', { 
        eventId: event._id, 
        yesVotes: event.yesVotes, 
        noVotes: event.noVotes, 
        yesPrice: event.yes,
        noPrice: event.no 
      });
    }
    
    // Return the updated event along with the transaction details
    res.status(200).json({
      event,
      transaction: {
        cost,
        potentialWinnings,
        vote,
        quantity
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete event
export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if the user is the creator of the event
    if (event.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this event' });
    }

    await Event.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ message: 'Event deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add new endpoint to process event outcomes
export const processEventOutcomes = async (req, res) => {
  try {
    // Process ended events
    await Event.processEndedEvents();
    
    // Process outcomes and distribute rewards
    await EventOutcome.processAllOutcomes();

    res.status(200).json({ message: 'Event outcomes processed successfully' });
  } catch (err) {
    console.error('Error processing outcomes:', err);
    res.status(500).json({ message: err.message });
  }
};

// Add this new controller function
export const cleanupEvents = async (req, res) => {
  try {
    await Event.processEndedEvents();
    res.status(200).json({ message: 'Event cleanup completed successfully' });
  } catch (err) {
    console.error('Cleanup error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Get events by category
export const getEventsByCategory = async (req, res) => {
  const { category } = req.params;
  try {
    const events = await Event.find({ category });

    res.status(200).json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
