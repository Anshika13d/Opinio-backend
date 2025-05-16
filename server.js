import { initScheduler } from './utils/scheduler.js';
import { Server } from 'socket.io';
import mongoose from 'mongoose';

// Add this after your other initializations
initScheduler();

// After creating your HTTP server


// Make io globally available
global.io = io;

io.on('connection', (socket) => {
  console.log('Client connected');
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB Connected');
  // Log the available collections
  mongoose.connection.db.listCollections().toArray((err, collections) => {
    if (err) {
      console.error('Error listing collections:', err);
    } else {
      console.log('Available collections:', collections.map(c => c.name));
    }
  });
}).catch(err => {
  console.error('MongoDB connection error:', err);
}); 