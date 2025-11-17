const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  },
  // Add these additional options for cPanel
  debug: true, // Enable debug output
  logger: true // Log information to console
});

const sendEmail = async (to, subject, html) => {
  try {
    console.log(`📧 Attempting to send email...`);
    console.log(`   From: ${process.env.EMAIL_USER}`);
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   SMTP Host: ${process.env.EMAIL_HOST}`);
    console.log(`   SMTP Port: ${process.env.EMAIL_PORT}`);
    
    // Verify connection configuration
    await transporter.verify();
    console.log('✓ SMTP connection verified successfully');
    
    const info = await transporter.sendMail({
      from: `"ProcuBid E-Auction System" <${process.env.EMAIL_USER}>`, // Sender name and address
      to,
      subject,
      html
    });
    
    console.log(`✓ Email sent successfully!`);
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('✗ Email sending failed:');
    console.error(`   Error Code: ${error.code}`);
    console.error(`   Error Message: ${error.message}`);
    console.error(`   Error Stack: ${error.stack}`);
    
    // More detailed error information
    if (error.response) {
      console.error(`   SMTP Response: ${error.response}`);
    }
    if (error.responseCode) {
      console.error(`   Response Code: ${error.responseCode}`);
    }
    
    return { success: false, error };
  }
};

// Test email configuration function
const testEmailConnection = async () => {
  try {
    console.log('🔍 Testing email configuration...');
    console.log(`   Host: ${process.env.EMAIL_HOST}`);
    console.log(`   Port: ${process.env.EMAIL_PORT}`);
    console.log(`   User: ${process.env.EMAIL_USER}`);
    console.log(`   Password: ${process.env.EMAIL_PASSWORD ? '****' + process.env.EMAIL_PASSWORD.slice(-4) : 'NOT SET'}`);
    
    await transporter.verify();
    console.log('✓ Email configuration is valid and ready to send emails');
    return true;
  } catch (error) {
    console.error('✗ Email configuration test failed:');
    console.error(`   Error: ${error.message}`);
    return false;
  }
};

module.exports = { sendEmail, testEmailConnection };