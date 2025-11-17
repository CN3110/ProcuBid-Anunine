// Backend/Routes/auctionRoutes.js
const express = require('express');
const router = express.Router();

// Import auction controllers
const { 
  createAuction,
  getAllAuctions,
  getAuction,
  getAllAuctionsAdmin,
  updateAuction,
  deleteAuction,
  approveAuction,
  rejectAuction
} = require('../Controllers/auctionController');

// Import live auction controllers
const {
  getLiveAuctionsForBidder,
  getLiveAuctionsForAdmin,
  getLiveAuctionDetails,
  getLiveAuctionRankings,
  checkAuctionLiveStatus,
  getAuctionStatistics,
  getActivelyParticipatingBidders
} = require('../Controllers/liveAuction');

// Import results controllers
const { 
  shortlistTopBidders,        // NEW
  awardBidder, 
  markBidderNotAwarded,       // NEW
  disqualifyBidder,  
  cancelAuction,              // NEW
  getAllAuctionBids, 
  getTopBidders,
  getAuctionResultsOverview,
  getBidderAuctionResults
} = require('../Controllers/results');

// Import middleware
const { 
  authenticateToken, 
  requireAdmin, 
  requireBidder, 
  requireSystemAdmin,
  requireAdminOrSystemAdmin 
} = require('../Middleware/auth');

// ===== AUCTION MANAGEMENT ROUTES =====

// Create auction (admin and system admin only)
router.post('/create', authenticateToken, requireAdminOrSystemAdmin, createAuction);

// Get all auctions for admin with filters and pagination
router.get('/admin/all', authenticateToken, requireAdminOrSystemAdmin, getAllAuctionsAdmin);

// Get all auctions (role-based filtering)
router.get('/all', authenticateToken, getAllAuctions);

// Approval endpoints (System Admin only)
router.post('/:auctionId/approve', authenticateToken, requireSystemAdmin, approveAuction);
router.post('/:auctionId/reject', authenticateToken, requireSystemAdmin, rejectAuction);

// Update auction details (Admin only)
router.put('/:auctionId', authenticateToken, requireAdminOrSystemAdmin, updateAuction);

// Delete auction (Admin only)
router.delete('/:auctionId', authenticateToken, requireAdminOrSystemAdmin, deleteAuction);

// Get specific auction details
router.get('/:auctionId', authenticateToken, getAuction);

// ===== LIVE AUCTION ROUTES =====

// Get live auctions for bidders (only auctions they're invited to)
router.get('/live/bidder', authenticateToken, requireBidder, getLiveAuctionsForBidder);

// Get live auctions for admin (all live auctions)
router.get('/live/admin', authenticateToken, requireAdminOrSystemAdmin, getLiveAuctionsForAdmin);

// Get specific live auction details
router.get('/live/:auctionId/details', authenticateToken, getLiveAuctionDetails);

// Get live auction rankings
router.get('/live/:auctionId/rankings', authenticateToken, getLiveAuctionRankings);

// Check auction live status
router.get('/live/:auctionId/status', authenticateToken, checkAuctionLiveStatus);

// ===== STATISTICS ROUTES =====

// Get detailed auction statistics (Admin only)
router.get('/:auctionId/statistics', authenticateToken, requireAdminOrSystemAdmin, getAuctionStatistics);

// Get actively participating bidders for an auction (Admin only)
router.get('/:auctionId/active-bidders', authenticateToken, requireAdminOrSystemAdmin, getActivelyParticipatingBidders);

// ===== RESULTS MANAGEMENT ROUTES =====

// Get top 5 bidders
router.get('/:auctionId/top-bidders', authenticateToken, getTopBidders);

// Get all bid records for an auction
router.get('/:auctionId/all-bids', authenticateToken, getAllAuctionBids);

// ===== NEW SHORTLISTING & RESULTS ROUTES =====

// Shortlist top 5 bidders (System Admin only) - NEW
router.post('/:auctionId/shortlist', authenticateToken, requireSystemAdmin, shortlistTopBidders);

// Award bidder (System Admin only) - UPDATED
router.post('/:auctionId/award/:bidderId', authenticateToken, requireSystemAdmin, awardBidder);

// Mark bidder as not awarded (System Admin only) - NEW
router.post('/:auctionId/not-award/:bidderId', authenticateToken, requireSystemAdmin, markBidderNotAwarded);

// Disqualify bidder (System Admin only) - UPDATED
router.post('/:auctionId/disqualify/:bidderId', authenticateToken, requireSystemAdmin, disqualifyBidder);

// Cancel auction (System Admin only) - NEW
router.post('/:auctionId/cancel', authenticateToken, requireSystemAdmin, cancelAuction);

// ===== RESULTS VIEWING ROUTES =====

// Get auction results overview for admin dashboard
router.get('/results/overview', authenticateToken, requireAdminOrSystemAdmin, getAuctionResultsOverview);

// Get bidder's auction results - UPDATED endpoint
router.get('/results/bidder/results', authenticateToken, requireBidder, getBidderAuctionResults);


// Add this to your routes file
const { sendEmail } = require('../Config/email');

router.post('/test-email-direct', async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    
    console.log('\n=== DIRECT EMAIL TEST ===');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Environment Config:');
    console.log('  EMAIL_HOST:', process.env.EMAIL_HOST);
    console.log('  EMAIL_PORT:', process.env.EMAIL_PORT);
    console.log('  EMAIL_USER:', process.env.EMAIL_USER);
    console.log('  EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '***SET***' : 'NOT SET');
    
    const htmlContent = `
      <html>
        <body>
          <h2>Test Email from ProcuBid System</h2>
          <p>${message}</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Sent from: ${process.env.EMAIL_USER}<br>
            Server: ${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT}<br>
            Time: ${new Date().toISOString()}
          </p>
        </body>
      </html>
    `;
    
    const result = await sendEmail(to, subject, htmlContent);
    
    console.log('Email Result:', result);
    console.log('=== END TEST ===\n');
    
    res.json({
      success: result.success,
      message: result.success ? 'Email sent successfully!' : 'Email failed',
      error: result.error ? result.error.message : null,
      config: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        from: process.env.EMAIL_USER,
        to: to
      }
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});


// Add to your auctionRoutes.js
router.post('/test-approval-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { sendEmail } = require('../Config/email');
    const { to } = req.body;
    
    // Test 1: Simple subject, no emoji
    console.log('\n=== Test 1: Simple subject ===');
    const result1 = await sendEmail(
      to || 'chathuni.n@anunine.com',
      'New Auction Created - Approval Required: Test',
      '<h1>Test Email 1</h1><p>Simple subject, no emoji</p>'
    );
    console.log('Result 1:', result1.success);
    
    // Test 2: With emoji
    console.log('\n=== Test 2: With emoji ===');
    const result2 = await sendEmail(
      to || 'chathuni.n@anunine.com',
      '🔔 New Auction Created - Approval Required: Test',
      '<h1>Test Email 2</h1><p>With emoji in subject</p>'
    );
    console.log('Result 2:', result2.success);
    
    // Test 3: Complex HTML
    console.log('\n=== Test 3: Complex HTML ===');
    const complexHTML = `
<div style="font-family: Arial, sans-serif;">
  <div style="background-color: #fafaf8ff; padding: 20px; border-left: 4px solid #c8c8c8ff;">
    <h3>Test Content</h3>
    <table style="width: 100%;">
      <tr><td style="font-weight: bold;">Field:</td><td>Value</td></tr>
    </table>
  </div>
  <div style="background-color: #e8f6ff; padding: 15px;">
    <p><strong>⚠️ Warning</strong></p>
  </div>
</div>
    `;
    const result3 = await sendEmail(
      to || 'chathuni.n@anunine.com',
      'Test Complex HTML Email',
      complexHTML
    );
    console.log('Result 3:', result3.success);
    
    res.json({
      success: true,
      tests: {
        simpleSubject: result1.success,
        withEmoji: result2.success,
        complexHTML: result3.success
      },
      message: 'Check your email inbox and spam folder'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add this to your server.js or create a new test route file



const { testEmailConnection } = require('../Config/email');

// Test email configuration
router.get('/test-email-config', async (req, res) => {
  const isValid = await testEmailConnection();
  res.json({ 
    success: isValid, 
    message: isValid ? 'Email configuration is valid' : 'Email configuration failed'
  });
});

// Send test email
router.post('/test-email-send', async (req, res) => {
  try {
    const { to } = req.body;
    
    if (!to) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide recipient email address' 
      });
    }

    const testSubject = '🧪 Test Email from ProcuBid E-Auction System';
    const testHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Email Configuration Test</h2>
        <p>This is a test email from the ProcuBid E-Auction System.</p>
        <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Test Details:</strong></p>
          <ul>
            <li>From: ${process.env.EMAIL_USER}</li>
            <li>To: ${to}</li>
            <li>Timestamp: ${new Date().toISOString()}</li>
          </ul>
        </div>
        <p>If you received this email, your email configuration is working correctly! ✅</p>
      </div>
    `;

    console.log(`\n🧪 Sending test email to: ${to}\n`);
    
    const result = await sendEmail(to, testSubject, testHTML);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: `Test email sent successfully to ${to}`,
        messageId: result.messageId 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to send test email',
        details: result.error.message 
      });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});




module.exports = router;