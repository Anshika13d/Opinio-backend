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
  process.env.CLIENT_URL,
].filter(Boolean);

// Set up Socket.io
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS (Socket.io)'), false);
    },
    credentials: true
  }
});


// Store io instance in app locals so it can be accessed in routes
app.set('io', io);

// Middleware
app.use(cookieParser());
app.use(express.json());

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
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
