const express = require('express');
const https = require('https');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { testConnection } = require('./Config/database');

// Test DB connection on startup
testConnection().then(success => {
  if (!success) {
    console.error("❌ Failed to connect to database!");
    process.exit(1);
  }
  console.log("✅ Database connection verified");
});

const app = express();

// Determine if in production
const isProduction = process.env.NODE_ENV === 'production';

// SSL Configuration for HTTPS
let server;
const useHttps = process.env.USE_HTTPS === 'true';

if (useHttps) {
  try {
    let sslOptions;
    
    // Try PFX format first (Windows-friendly)
    if (process.env.SSL_PFX_PATH && fs.existsSync(process.env.SSL_PFX_PATH)) {
      sslOptions = {
        pfx: fs.readFileSync(process.env.SSL_PFX_PATH),
        passphrase: process.env.SSL_PFX_PASSWORD || 'CHAThuni123456*',
        // For self-signed certificates
        requestCert: false,
        rejectUnauthorized: false
      };
      console.log('🔒 Using PFX certificate format');
      console.log(`   PFX: ${process.env.SSL_PFX_PATH}`);
    } 
    // Fall back to PEM format (key + cert)
    else {
      const keyPath = process.env.SSL_KEY_PATH || 'C:/SSL/server.key';
      const certPath = process.env.SSL_CERT_PATH || 'C:/SSL/server.crt';
      
      if (!fs.existsSync(keyPath)) {
        throw new Error(`SSL key file not found at: ${keyPath}`);
      }
      if (!fs.existsSync(certPath)) {
        throw new Error(`SSL certificate file not found at: ${certPath}`);
      }
      
      sslOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
        // For self-signed certificates
        requestCert: false,
        rejectUnauthorized: false
      };
      console.log('🔒 Using PEM certificate format');
      console.log(`   Key: ${keyPath}`);
      console.log(`   Cert: ${certPath}`);
    }
    
    server = https.createServer(sslOptions, app);
    console.log('✅ HTTPS server created with SSL certificates');
  } catch (error) {
    console.error('⚠️  SSL certificate error:', error.message);
    console.log('\n📝 Troubleshooting steps:');
    console.log('   1. Check if SSL certificate files exist at the specified paths');
    console.log('   2. Verify paths in .env are correct');
    console.log('   3. Ensure files have proper permissions');
    console.log('   4. For PEM files, they should start with:');
    console.log('      - server.key: -----BEGIN PRIVATE KEY-----');
    console.log('      - server.crt: -----BEGIN CERTIFICATE-----');
    console.log('\n💡 Tip: Set USE_HTTPS=false in .env to run with HTTP for testing');
    process.exit(1);
  }
} else {
  server = http.createServer(app);
  console.log('🌐 HTTP server created (HTTPS disabled)');
}

// Socket.IO configuration with updated CORS
const allowedOrigins = isProduction 
  ? [
      "https://procubid-anunine.netlify.app",
      "https://procubid.anunine.com",
      "http://procubid.anunine.com",
      "https://unpetrifying-gumptious-case.ngrok-free.dev"
    ]
  : [
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ];

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// CORS Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// API Routes
app.use('/api/auth', require('./Routes/auth'));
app.use('/api/admin', require('./Routes/admin'));
app.use('/api/auction', require('./Routes/auctionRoutes'));
app.use('/api/bid', require('./Routes/bidRoutes'));

// Test route
app.get('/api/test-route', (req, res) => {
  console.log("Test route was hit!");
  res.json({ 
    message: "Backend is working!",
    environment: isProduction ? 'production' : 'development',
    protocol: useHttps ? 'HTTPS' : 'HTTP',
    timestamp: new Date().toISOString(),
    host: req.get('host')
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    protocol: useHttps ? 'HTTPS' : 'HTTP',
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'ProcuBid Backend API',
    version: '1.0.0',
    protocol: useHttps ? 'HTTPS' : 'HTTP',
    endpoints: {
      health: '/health',
      test: '/api/test-route',
      auth: '/api/auth/*',
      admin: '/api/admin/*',
      auction: '/api/auction/*',
      bid: '/api/bid/*'
    }
  });
});

// Real-time handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-auction', (auctionId) => {
    socket.join(`auction-${auctionId}`);
    console.log(`User ${socket.id} joined auction room: auction-${auctionId}`);
  });
  
  socket.on('place-bid', async (data) => {
    io.to(`auction-${data.auctionId}`).emit('bid-update', data);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  const protocol = useHttps ? 'https' : 'http';
  console.log('\n===========================================');
  console.log(`🚀 Server running at ${protocol}://${HOST}:${PORT}`);
  console.log(`📍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`🔒 SSL: ${useHttps ? 'ENABLED ✅' : 'DISABLED ⚠️'}`);
  console.log(`🌐 CORS enabled for: ${allowedOrigins.join(', ')}`);
  console.log('===========================================\n');
  console.log('Available endpoints:');
  console.log(`  ${protocol}://localhost:${PORT}/health`);
  console.log(`  ${protocol}://localhost:${PORT}/api/test-route`);
  console.log(`  ${protocol}://23.101.29.218:${PORT}/health`);
  console.log('===========================================\n');
});

// Import required modules for real-time auction management
const { query } = require('./Config/database');
const moment = require('moment-timezone');
const { 
  updateAuctionStatuses, 
  isAuctionLive 
} = require('./Controllers/auctionController');

const getCurrentSLTime = () => {
  return moment().tz('Asia/Colombo');
};

const updateLiveAuctionRankings = async () => {
  try {
    const nowSL = getCurrentSLTime();
    const { data: auctions, error } = await query(
      'SELECT id, auction_date, start_time, duration_minutes, status FROM auctions'
    );
    
    if (error) {
      console.error('Error fetching auctions for ranking update:', error);
      return;
    }
    
    const liveAuctions = auctions.filter(auction => {
      return isAuctionLive(auction);
    });
    
    for (const auction of liveAuctions) {
      await updateAuctionRankings(auction.id);
    }
    
    await updateAuctionStatuses();
  } catch (error) {
    console.error('Error in updateLiveAuctionRankings:', error);
  }
};

const updateAuctionRankings = async (auctionId) => {
  try {
    const { data: allBids, error } = await query(`
      SELECT b.id, b.bidder_id, b.amount, b.bid_time,
             u.user_id, u.name, u.company
      FROM bids b
      JOIN users u ON b.bidder_id = u.id
      WHERE b.auction_id = ? 
      ORDER BY b.amount ASC, b.bid_time ASC
    `, [auctionId]);
    
    if (error) {
      console.error(`Error fetching bids for auction ${auctionId}:`, error);
      return;
    }
    
    if (!allBids || allBids.length === 0) {
      io.to(`auction-${auctionId}`).emit('ranking-update', {
        auctionId,
        rankings: [],
        totalBidders: 0,
        timestamp: getCurrentSLTime().format('YYYY-MM-DD HH:mm:ss')
      });
      return;
    }
    
    const bidderLowestBids = {};
    allBids.forEach(bid => {
      const bidderId = bid.bidder_id;
      if (!bidderLowestBids[bidderId] || bid.amount < bidderLowestBids[bidderId].amount) {
        bidderLowestBids[bidderId] = {
          bidder_id: bidderId,
          amount: bid.amount,
          bid_time: bid.bid_time,
          user_id: bid.user_id,
          name: bid.name,
          company: bid.company,
          bidId: bid.id
        };
      }
    });
    
    const sortedBidders = Object.values(bidderLowestBids)
      .sort((a, b) => {
        if (a.amount !== b.amount) {
          return a.amount - b.amount;
        }
        return new Date(a.bid_time) - new Date(b.bid_time);
      });
    
    const rankings = sortedBidders.map((bidder, index) => ({
      rank: index + 1,
      bidder_id: bidder.bidder_id,
      user_id: bidder.user_id,
      name: bidder.name,
      company: bidder.company,
      amount: bidder.amount,
      bid_time: bidder.bid_time,
      is_leader: index === 0
    }));
    
    io.to(`auction-${auctionId}`).emit('ranking-update', {
      auctionId,
      rankings,
      totalBidders: sortedBidders.length,
      lowestBid: rankings.length > 0 ? rankings[0].amount : null,
      leader: rankings.length > 0 ? rankings[0] : null,
      timestamp: getCurrentSLTime().format('YYYY-MM-DD HH:mm:ss')
    });
    
    rankings.forEach(ranking => {
      io.to(`auction-${auctionId}`).emit('individual-rank-update', {
        auctionId,
        bidderId: ranking.bidder_id,
        rank: ranking.rank,
        amount: ranking.amount,
        totalBidders: rankings.length,
        isLeading: ranking.rank === 1,
        timestamp: getCurrentSLTime().format('YYYY-MM-DD HH:mm:ss')
      });
    });
    
    console.log(`📊 Rankings updated for auction ${auctionId}`);
  } catch (error) {
    console.error(`Error updating rankings for auction ${auctionId}:`, error);
  }
};

const checkAndUpdateAuctionStatuses = async () => {
  try {
    const { data: auctions, error } = await query(
      'SELECT id, auction_id, auction_date, start_time, duration_minutes, status FROM auctions WHERE status != "ended"'
    );
    
    if (error) {
      console.error('Error fetching auctions for status update:', error);
      return;
    }
    
    let updatedCount = 0;
    
    for (const auction of auctions) {
      const nowSL = getCurrentSLTime();
      const startDateTime = moment.tz(`${auction.auction_date} ${auction.start_time}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Colombo');
      const endDateTime = startDateTime.clone().add(auction.duration_minutes, 'minutes');
      
      let newStatus = auction.status;
      
      if (auction.status === 'approved') {
        if (nowSL.isBetween(startDateTime, endDateTime, null, '[]')) {
          newStatus = 'live';
          io.emit('auction-status-change', {
            auctionId: auction.id,
            auction_id: auction.auction_id,
            status: 'live',
            message: 'Auction is now live!',
            timestamp: nowSL.format('YYYY-MM-DD HH:mm:ss')
          });
        } else if (nowSL.isAfter(endDateTime)) {
          newStatus = 'ended';
          io.emit('auction-status-change', {
            auctionId: auction.id,
            auction_id: auction.auction_id,
            status: 'ended',
            message: 'Auction has ended!',
            timestamp: nowSL.format('YYYY-MM-DD HH:mm:ss')
          });
        }
      } else if (auction.status === 'live') {
        if (nowSL.isAfter(endDateTime)) {
          newStatus = 'ended';
          io.emit('auction-status-change', {
            auctionId: auction.id,
            auction_id: auction.auction_id,
            status: 'ended',
            message: 'Auction has ended!',
            timestamp: nowSL.format('YYYY-MM-DD HH:mm:ss')
          });
        }
      }
      
      if (newStatus !== auction.status) {
        await query(
          'UPDATE auctions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newStatus, auction.id]
        );
        updatedCount++;
        console.log(`🔄 Auction ${auction.auction_id}: ${auction.status} → ${newStatus}`);
      }
    }
    
    if (updatedCount > 0) {
      console.log(`✅ Updated ${updatedCount} auction statuses`);
    }
  } catch (error) {
    console.error('Error checking auction statuses:', error);
  }
};

const startAuctionScheduler = () => {
  const nowSL = getCurrentSLTime();
  console.log(`🚀 Scheduler started at ${nowSL.format('YYYY-MM-DD HH:mm:ss')} SL time`);
  
  checkAndUpdateAuctionStatuses();
  updateLiveAuctionRankings();
  
  setInterval(checkAndUpdateAuctionStatuses, 30000);
  setInterval(updateLiveAuctionRankings, 5000);
  
  console.log('⏰ Status updates: Every 30s | Ranking updates: Every 5s');
};

startAuctionScheduler();

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = {
  updateLiveAuctionRankings,
  updateAuctionRankings,
  checkAndUpdateAuctionStatuses,
  io
};