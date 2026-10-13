require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { createOriginPolicy } = require('./config/cors');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { activeDriverContext } = require('./services/bookingService');

const app = express();
const server = http.createServer(app);
const isAllowedOrigin = createOriginPolicy();
const corsOptions = {
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  credentials: true,
};
const io = new Server(server, {
  cors: corsOptions,
  // CORS alone does not restrict WebSocket upgrades.
  allowRequest: (req, callback) => callback(null, isAllowedOrigin(req.headers.origin)),
});

app.use((req, res, next) => {
  if (!isAllowedOrigin(req.headers.origin)) return res.status(403).json({ message: 'Origin not allowed' });
  next();
});
app.use(cors(corsOptions));
// Defaults skip small bodies, non-compressible MIME types, already encoded
// resources and Cache-Control: no-transform responses.
app.use(compression());
app.use(express.json({ limit: '2mb' }));

// Make io accessible inside controllers via req.app.get('io')
app.set('io', io);

app.get('/', (req, res) => {
  res.json({ message: 'Smart Public Transit Tracking System API is running' });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/routes', require('./routes/routeRoutes'));
app.use('/api/stops', require('./routes/stopRoutes'));
app.use('/api/buses', require('./routes/busRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/route-alerts', require('./routes/routeAlertRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/safety', require('./routes/safetyRoutes'));

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('watchBus', (busId) => {
    socket.join(`bus:${busId}`);
  });

  socket.on('watchDriverBookings', async (payload = {}, acknowledge) => {
    try {
      const suppliedToken =
        typeof payload.token === 'string' ? payload.token : socket.handshake.auth?.token;
      const token = suppliedToken?.replace(/^Bearer\s+/i, '');
      if (!token) throw new Error('Missing token.');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { driver, bus } = await activeDriverContext(decoded.id);
      const room = `driver:${driver._id}`;

      if (socket.data.driverBookingRoom) {
        await socket.leave(socket.data.driverBookingRoom);
      }
      await socket.join(room);
      socket.data.driverBookingRoom = room;

      if (typeof acknowledge === 'function') {
        acknowledge({ ok: true, busId: bus._id.toString() });
      }
    } catch (_error) {
      if (typeof acknowledge === 'function') {
        acknowledge({ ok: false, message: 'Driver authentication and an active shift are required.' });
      }
    }
  });

  socket.on('unwatchDriverBookings', async (acknowledge) => {
    if (socket.data.driverBookingRoom) {
      await socket.leave(socket.data.driverBookingRoom);
      delete socket.data.driverBookingRoom;
    }
    if (typeof acknowledge === 'function') acknowledge({ ok: true });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

if (require.main === module) startServer();

// Tests can use the actual app and Socket.IO server with an isolated database.
module.exports = { app, server, io, startServer };
