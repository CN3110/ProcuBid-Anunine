// Backend/Routes/emailTestRoutes.js
const express = require('express');
const router = express.Router();
const { sendEmail } = require('../Config/email');
const nodemailer = require('nodemailer');

// Test 1: Check email configuration
router.get('/config', async (req, res) => {
  try {
    console.log('\n🔍 Testing Email Configuration...');
    console.log('================================');
    console.log(`Host: ${process.env.EMAIL_HOST}`);
    console.log(`Port: ${process.env.EMAIL_PORT}`);
    console.log(`User: ${process.env.EMAIL_USER}`);
    console.log(`Password: ${process.env.EMAIL_PASSWORD ? '****' + process.env.EMAIL_PASSWORD.slice(-4) : 'NOT SET'}`);
    console.log('================================\n');

    // Create transporter for testing
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify connection
    await transporter.verify();
    
    console.log('✅ Email configuration is VALID!\n');
    
    res.json({ 
      success: true, 
      message: 'Email configuration is valid and ready to send emails',
      config: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        user: process.env.EMAIL_USER,
        secure: true
      }
    });
  } catch (error) {
    console.error('❌ Email configuration FAILED!');
    console.error(`Error: ${error.message}\n`);
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack
    });
  }
});

// Test 2: Send test email to any address
router.post('/send', async (req, res) => {
  try {
    const { to, testType } = req.body;
    
    if (!to) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide recipient email address in request body: { "to": "email@example.com" }' 
      });
    }

    console.log(`\n📧 Sending test email...`);
    console.log('================================');
    console.log(`From: ${process.env.EMAIL_USER}`);
    console.log(`To: ${to}`);
    console.log(`Test Type: ${testType || 'Basic Test'}`);
    console.log('================================\n');

    let subject, html;

    // Different test email types
    if (testType === 'auction-approval') {
      subject = '🔔 Test: Auction Approval Notification';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Test: Auction Approval Notification</h2>
          
          <p>This is a test email simulating an auction approval notification.</p>
          
          <div style="background-color: #fafaf8ff; padding: 20px; border-radius: 5px; border-left: 4px solid #c8c8c8ff; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #555;">📋 Test Auction Details:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 40%;">Auction ID:</td>
                <td style="padding: 8px 0;">TEST-001</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Title:</td>
                <td style="padding: 8px 0;">Test Auction Title</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Status:</td>
                <td style="padding: 8px 0;">Test - Email Configuration Check</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #28a745; font-weight: bold;">✅ If you received this email, the configuration is working!</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px;">
            Test email sent at: ${new Date().toISOString()}<br>
            From: ${process.env.EMAIL_USER}<br>
            Server: ${process.env.EMAIL_HOST}
          </p>
        </div>
      `;
    } else {
      subject = '🧪 Test Email from ProcuBid E-Auction System';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #007bff; color: white; padding: 20px; text-align: center;">
            <h1>✅ Email Configuration Test</h1>
          </div>
          
          <div style="padding: 20px; background-color: #f9f9f9;">
            <h2 style="color: #333;">Success! Email System is Working</h2>
            
            <p>This is a test email from the <strong>ProcuBid E-Auction System</strong>.</p>
            
            <div style="background-color: white; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #28a745;">Test Details:</h3>
              <ul style="list-style: none; padding: 0;">
                <li><strong>From:</strong> ${process.env.EMAIL_USER}</li>
                <li><strong>To:</strong> ${to}</li>
                <li><strong>Server:</strong> ${process.env.EMAIL_HOST}</li>
                <li><strong>Port:</strong> ${process.env.EMAIL_PORT}</li>
                <li><strong>Timestamp:</strong> ${new Date().toLocaleString('en-GB', { 
                  timeZone: 'Asia/Colombo',
                  dateStyle: 'full',
                  timeStyle: 'long'
                })}</li>
              </ul>
            </div>
            
            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; color: #155724;">
                <strong>✅ Configuration Status:</strong> Working correctly!
              </p>
            </div>
            
            <p>If you received this email, your email configuration is set up properly and ready to send auction notifications.</p>
          </div>
          
          <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">This is a test email from ProcuBid E-Auction System</p>
            <p style="margin: 5px 0 0 0;">Do not reply to this email</p>
          </div>
        </div>
      `;
    }

    const result = await sendEmail(to, subject, html);
    
    if (result.success) {
      console.log('✅ Test email sent successfully!\n');
      res.json({ 
        success: true, 
        message: `Test email sent successfully to ${to}`,
        messageId: result.messageId,
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('❌ Failed to send test email!\n');
      res.status(500).json({ 
        success: false, 
        error: 'Failed to send test email',
        details: result.error.message 
      });
    }
  } catch (error) {
    console.error('❌ Test email error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
});

// Test 3: Send to multiple addresses at once
router.post('/send-multiple', async (req, res) => {
  try {
    const { recipients } = req.body;
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide array of recipient emails: { "recipients": ["email1@example.com", "email2@example.com"] }' 
      });
    }

    console.log(`\n📧 Sending test emails to ${recipients.length} recipients...`);
    
    const results = [];
    
    for (const email of recipients) {
      console.log(`\nSending to: ${email}`);
      
      const result = await sendEmail(
        email,
        '🧪 Test Email from ProcuBid E-Auction System',
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Email Configuration Test</h2>
            <p>This test email was sent to: <strong>${email}</strong></p>
            <p>Timestamp: ${new Date().toISOString()}</p>
            <p style="color: #28a745; font-weight: bold;">✅ If you received this, the configuration works!</p>
          </div>
        `
      );
      
      results.push({
        email,
        success: result.success,
        messageId: result.messageId,
        error: result.error?.message
      });
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    console.log(`\n✅ Sent: ${successCount}, ❌ Failed: ${failCount}\n`);
    
    res.json({
      success: true,
      summary: {
        total: recipients.length,
        successful: successCount,
        failed: failCount
      },
      results
    });
    
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;

// ============================================
// ADD THIS TO YOUR server.js FILE:
// ============================================
// 
// IMPORTANT: Add this line BEFORE your auction routes
// to prevent conflicts:
//
// app.use('/api/email-test', require('./Routes/emailTestRoutes'));
//
// The complete routes section should look like:
//
// app.use('/api/auth', require('./Routes/auth'));
// app.use('/api/email-test', require('./Routes/emailTestRoutes'));  // Add this!
// app.use('/api/admin', require('./Routes/admin'));
// app.use('/api/auction', require('./Routes/auctionRoutes'));
// app.use('/api/bid', require('./Routes/bidRoutes'));