import express from 'express';
import cors from 'cors';
import eventRoutes from './routes/eventsRoute.js';

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Make sure the route prefix matches what your frontend is expecting
app.use('/events', eventRoutes);

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default app; 