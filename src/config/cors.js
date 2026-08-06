// src/config/cors.js

const allowedOrigins = [
  // Web
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
  
  // Production
  'https://dtrack-frontend.onrender.com',
  'https://dtrack-backend.onrender.com',
  
  // Mobile app - Android emulator
  'http://10.0.2.2:5000',
  'http://10.0.2.2:8081',
  
  // Mobile app - iOS simulator
  'http://localhost:5000',
  
  // Mobile app - Physical devices (add your computer's IP)
  'http://192.168.1.100:5000', // 👈 REPLACE WITH YOUR IP
  'http://192.168.1.100:8081',
  
  // Allow any localhost with any port (for mobile testing)
  'http://localhost:*',
  'http://127.0.0.1:*',
  'http://10.0.2.2:*',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // For development, allow all origins (safe for testing)
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        console.warn('Origin not allowed by CORS:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Methods',
  ],
  exposedHeaders: [
    'Content-Range',
    'X-Content-Range',
    'Access-Control-Allow-Origin',
  ],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

module.exports = { corsOptions, allowedOrigins };
