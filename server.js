import express from 'express';
import dotenv from 'dotenv';
import userRoutes from './src/routes/userRouters.js';
import cors from 'cors';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Enable CORS for all origins (for local testing)
app.use(cors({
  origin: '*', // Replace with specific origins in production
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

// Middleware to parse JSON for all routes
// Increase limit to 50MB to handle large base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Add routes
app.use('/api/user', userRoutes);

// Handle undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    message: err.message || 'Something went wrong'
  });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});