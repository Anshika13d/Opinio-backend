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

// Define allowed origins
const allowedOrigins = [
  'http://localhost:5173',
  'https://opinio-pink.vercel.app'
].filter(Boolean);

// Set up Socket.io with explicit CORS configuration
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Store io instance in app locals so it can be accessed in routes
app.set('io', io);

// Middleware
app.use(cookieParser());
app.use(express.json());

// CORS configuration for Express
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Routes
app.use('/auth', authRoutes);
app.use('/events', eventRoutes);
app.use('/contact', contactRoutes);
app.get('/test', (req, res) => {
  res.send('CORS is working!');
});

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
