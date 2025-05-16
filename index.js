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

// Function to check if origin is allowed
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  
  const allowedDomains = [
    'localhost',
    'opinio-pink.vercel.app',
    'anshika13ds-projects.vercel.app'
  ];
  
  return allowedDomains.some(domain => 
    origin.includes(domain) || 
    origin === 'http://localhost:5173'
  );
};

// Set up Socket.io with explicit CORS configuration
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Store io instance in app locals so it can be accessed in routes
app.set('io', io);

// Middleware
app.use(cookieParser());
app.use(express.json());

// CORS configuration for Express
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Add CORS headers for all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/events', eventRoutes);
app.use('/contact', contactRoutes);

// Test route for CORS
app.get('/test', (req, res) => {
  res.json({ message: 'CORS is working!' });
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
    console.log('CORS is configured for the following domains:');
    console.log('- http://localhost:5173');
    console.log('- *.vercel.app');
  });
}).catch((err) => {
  console.log('Error with DB:', err);
});
