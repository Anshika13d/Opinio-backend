import cron from 'node-cron';
import Event from '../model/events.js';

export const initScheduler = () => {
  // Run cleanup every minute
  cron.schedule('* * * * *', async () => {
    try {
      console.log('Running event cleanup...');
      await Event.processEndedEvents();
      console.log('Event cleanup completed');
    } catch (error) {
      console.error('Error in scheduled event cleanup:', error);
    }
  });
}; 