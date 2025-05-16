import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/authRoute.js';
import eventRoutes from './routes/eventsRoute.js';
import contactRoutes from './routes/contactRoute.js';
import connectToDB from './connect.js';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 4001;

// Create HTTP server
const server = http.createServer(app);

// Set up Socket.io
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true,
  },
});

// Store io instance in app locals so it can be accessed in routes
app.set('io', io);

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Routes
app.use('/auth', authRoutes);
app.use('/events', eventRoutes);
app.use('/contact', contactRoutes);

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Connect to DB and start server
connectToDB().then(() => {
  server.listen(port, () => {
    console.log('Server is running on port ' + port);
  });
}).catch((err) => {
  console.log('Error with DB:', err);
});
