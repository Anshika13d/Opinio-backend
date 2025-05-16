import express from 'express';
import { createEvent, voteEvent, getEvents, getEventById, voting, recalculateAllPrices, deleteEvent, getUserVotedEvents, cleanupEvents, getEventsByCategory } from '../controllers/eventController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticate, createEvent);
router.get('/', getEvents);
router.get('/user/voted', authenticate, getUserVotedEvents);
router.get('/:id', getEventById);
router.get('/:category', getEventsByCategory);
router.get('/vote', authenticate, voting);
router.get('/recalculate', authenticate, recalculateAllPrices);
router.patch('/:id/vote', authenticate, voteEvent);
router.delete('/:id', authenticate, deleteEvent);
router.post('/cleanup', authenticate, cleanupEvents);

export default router;

