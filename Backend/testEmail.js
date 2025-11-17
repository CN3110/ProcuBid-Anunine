// testEmail.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const nodemailer = require('nodemailer');

// Possible SMTP hosts to try
const SMTP_HOSTS = [
  'procubid.anunine.com',
  'mail.procubid.anunine.com',
  'smtp.procubid.anunine.com'
];

// Test function for a specific host
async function testHost(host) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Testing: ${host}`);
  console.log('='.repeat(50));

  const transporter = nodemailer.createTransport({
    host: host,
    port: parseInt(process.env.EMAIL_PORT),
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000, // 10 seconds
    debug: false
  });

  try {
    console.log('⏳ Verifying connection...');
    await transporter.verify();
    console.log('✓ Connection successful!');
    
    console.log('⏳ Sending test email...');
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'Test Email from E-Auction System',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>✓ Test Email Successful!</h2>
          <p>Your email configuration is working correctly.</p>
          <p><strong>SMTP Host:</strong> ${host}</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
        </div>
      `
    });
    
    console.log('✓ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('\n✓✓✓ SUCCESS! ✓✓✓');
    console.log(`Use this host in your .env: EMAIL_HOST=${host}`);
    
    return { success: true, host };
    
  } catch (error) {
    console.log('✗ Failed with error:', error.code || error.message);
    return { success: false, host, error: error.code || error.message };
  }
}

// Main test function
async function runEmailTests() {
  console.log('E-AUCTION EMAIL CONFIGURATION TEST');
  console.log('='.repeat(50));
  console.log('Current Settings:');
  console.log('Port:', process.env.EMAIL_PORT);
  console.log('User:', process.env.EMAIL_USER);
  console.log('Password:', process.env.EMAIL_PASSWORD ? '****' + process.env.EMAIL_PASSWORD.slice(-4) : 'NOT SET');
  
  const results = [];
  
  for (const host of SMTP_HOSTS) {
    const result = await testHost(host);
    results.push(result);
    
    if (result.success) {
      console.log('\n🎉 WORKING CONFIGURATION FOUND!');
      console.log(`\nUpdate your .env file with:`);
      console.log(`EMAIL_HOST=${host}`);
      return;
    }
    
    // Wait a bit between attempts
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // If we get here, all hosts failed
  console.log('\n\n❌ ALL HOSTS FAILED');
  console.log('='.repeat(50));
  console.log('\nResults Summary:');
  results.forEach(r => {
    console.log(`${r.host}: ${r.error}`);
  });
  
  console.log('\n🔍 TROUBLESHOOTING STEPS:');
  console.log('1. Check if your server/network can reach procubid.anunine.com');
  console.log('2. Verify port 465 is not blocked by firewall');
  console.log('3. Confirm the email password is correct');
  console.log('4. Check if the domain is accessible from your network');
  console.log('\n💡 Try running: ping procubid.anunine.com');
  console.log('💡 Check firewall: netsh advfirewall show allprofiles');
}

// Run the tests
runEmailTests().catch(console.error);