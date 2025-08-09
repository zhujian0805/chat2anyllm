import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'chat2anyllm-default-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Middleware to verify JWT token
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Generate JWT token for a user
export const generateToken = (user) => {
  return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Simple login endpoint (in a real app, this would check credentials against a database)
export const login = (req, res) => {
  const { username, password } = req.body;
  
  // In a real application, you would validate credentials against a database
  // For this example, we'll accept any non-empty username and password
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  // Create a user object (in a real app, this would come from the database)
  const user = {
    id: 1,
    username: username,
    role: 'user'
  };
  
  const token = generateToken(user);
  res.json({ token, user });
};