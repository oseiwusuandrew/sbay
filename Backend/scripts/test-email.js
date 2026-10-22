/**
 * Quick Email Test Script
 * Run with: npm run email:test (from Backend/)
 * 
 * Tests if your Gmail SMTP configuration is working
 */

import nodemailer from 'nodemailer';
import 'dotenv/config';

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT || 465;

console.log('\n🔍 Testing Email Configuration...\n');
console.log('Configuration:');
console.log('  EMAIL_USER:', EMAIL_USER || '❌ NOT SET');
console.log('  EMAIL_PASS:', EMAIL_PASS ? '✅ SET (hidden)' : '❌ NOT SET');
console.log('  EMAIL_HOST:', EMAIL_HOST || '(using Gmail)');
console.log('  EMAIL_PORT:', EMAIL_PORT);
console.log('\n');

if (!EMAIL_USER || !EMAIL_PASS) {
  console.error('❌ ERROR: EMAIL_USER and EMAIL_PASS must be set in .env file\n');
  process.exit(1);
}

// Create transporter
const transportConfig = EMAIL_HOST ? {
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: EMAIL_PORT == 465,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
} : {
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
};

console.log('📡 Creating SMTP transporter...\n');
const transporter = nodemailer.createTransport(transportConfig);

// Verify connection
console.log('🔐 Verifying SMTP connection...\n');
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Verification Failed!\n');
    console.error('Error:', error.message);
    console.error('\n💡 Common fixes:');
    console.error('  1. Check EMAIL_USER is correct Gmail address');
    console.error('  2. Check EMAIL_PASS is Google App Password (not regular password)');
    console.error('  3. Generate App Password at: https://myaccount.google.com/apppasswords');
    console.error('  4. Ensure 2FA is enabled on your Google account\n');
    process.exit(1);
  } else {
    console.log('✅ SMTP connection verified successfully!\n');
    console.log('📧 Sending test email...\n');

    // Send test email
    const mailOptions = {
      from: `"sBay Test" <${EMAIL_USER}>`,
      to: EMAIL_USER, // Send to yourself
      subject: '✅ sBay Email Test - Success!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0A7E3E 0%, #0d9647 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Email Test Successful!</h1>
            </div>
            <div class="content">
              <p>Great news! Your sBay email system is working perfectly.</p>
              <p><strong>Configuration:</strong></p>
              <ul>
                <li>From: ${EMAIL_USER}</li>
                <li>SMTP: ${EMAIL_HOST || 'Gmail'}</li>
                <li>Port: ${EMAIL_PORT}</li>
              </ul>
              <p>Your password reset, welcome emails, and order notifications will work correctly!</p>
              <p style="color: #0A7E3E; font-weight: bold;">🎉 You're all set!</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('❌ Failed to send test email!\n');
        console.error('Error:', error.message);
        process.exit(1);
      } else {
        console.log('✅ Test email sent successfully!');
        console.log('📬 Message ID:', info.messageId);
        console.log(`\n💡 Check your inbox: ${EMAIL_USER}`);
        console.log('\n🎉 Your email system is working correctly!');
        console.log('\n✨ All automated emails will work:');
        console.log('   - Welcome emails');
        console.log('   - Password reset');
        console.log('   - Order notifications');
        console.log('   - Support replies\n');
        process.exit(0);
      }
    });
  }
});
