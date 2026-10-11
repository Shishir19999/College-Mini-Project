import http from 'node:http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { authenticateToken } from './middleware/auth.js';

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy .env.example to .env and set it.');
  process.exit(1);
}

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const origins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);

mongoose.connect(process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/foodshop')
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

const server = http.createServer();
// Live order updates: staff join "staff", every signed-in user joins "user:<id>" (events are emitted from shared/routes.js).
const io = new Server(server, { path: '/api/socket.io', cors: origins.length ? { origin: origins } : { origin: true } });
io.use(async (socket, next) => {
  const { user, error } = await authenticateToken(String(socket.handshake.auth?.token || ''));
  if (error) return next(new Error(error));
  socket.data.user = user;
  next();
});
io.on('connection', (socket) => {
  const { id, role } = socket.data.user;
  socket.join(`user:${id}`);
  if (role === 'kitchen' || role === 'admin') socket.join('staff');
});
server.on('request', createApp({ io }));
server.listen(PORT, HOST, () => console.log(`Server is running on ${HOST}:${PORT}`));
