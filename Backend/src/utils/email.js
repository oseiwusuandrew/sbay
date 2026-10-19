import nodemailer from 'nodemailer';

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
import { env } from '../config/env.js';

let transporter = null;

/**
 * Initialize email transporter with Gmail SMTP
 */
function getTransporter() {
  if (transporter) return transporter;

  if (!env.EMAIL_USER || !env.EMAIL_PASS) {
    // eslint-disable-next-line no-console
    console.warn('[email] EMAIL_USER or EMAIL_PASS not configured. Emails will be logged only.');
    return null;
  }

  // Check if using custom SMTP or Gmail
  const transportConfig = env.EMAIL_HOST ? {
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT || 465,
    secure: env.EMAIL_SECURE !== 'false', // true for 465, false for 587
    auth: {
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASS,
    },
  } : {
    service: 'gmail',
    auth: {
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASS,
    },
  };

  transporter = nodemailer.createTransport(transportConfig);

  // Verify credentials on first init so bad config surfaces immediately.
  transporter.verify().then(() => {
    // eslint-disable-next-line no-console
    console.log('[email] SMTP transporter verified — ready to send.');
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[email] SMTP verification failed:', err.message);
    // eslint-disable-next-line no-console
    console.error('[email] Ensure EMAIL_USER is a Gmail address and EMAIL_PASS is a Google App Password (not your login password).');
  });

  return transporter;
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(user, resetUrl) {
  const transport = getTransporter();

  if (!transport) {
    // eslint-disable-next-line no-console
    console.log(`[email] Password reset link for ${user.email}: ${resetUrl}`);
    return;
  }

  const mailOptions = {
    from: `"sBay" <${env.EMAIL_USER}>`,
    to: user.email,
    subject: 'Reset Your sBay Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0A7E3E 0%, #0d9647 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 30px; background: #0A7E3E; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password</h1>
          </div>
          <div class="content">
            <p>Hi ${escapeHtml(user.name)},</p>
            <p>We received a request to reset your password for your sBay account.</p>
            <p>Click the button below to reset your password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: white; padding: 10px; border-radius: 5px; font-size: 12px;">
              ${resetUrl}
            </p>
            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>This link will expire in 30 minutes</li>
                <li>If you didn't request this, please ignore this email</li>
                <li>Never share this link with anyone</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} sBay - Campus Marketplace Reimagined</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transport.sendMail(mailOptions);
    // eslint-disable-next-line no-console
    console.log(`[email] Password reset email sent to ${user.email}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[email] Failed to send password reset email:', error.message);
    throw error;
  }
}

/**
 * Send admin reply to a support ticket — delivered to the user's email.
 */
export async function sendSupportReplyEmail({ toEmail, toName, adminReply, ticketSubject }) {
  const transport = getTransporter();
  const displayName = toName || toEmail.split('@')[0];

  if (!transport) {
    // eslint-disable-next-line no-console
    console.log(`[email] Support reply to ${toEmail}: ${adminReply}`);
    return;
  }

  const mailOptions = {
    from: `"sBay Support" <${env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Re: ${ticketSubject || 'Your support request'}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #333; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg,#0A7E3E,#0d9647); color:#fff; padding:24px; border-radius:10px 10px 0 0; }
          .content { background:#f9f9f9; padding:28px; border-radius:0 0 10px 10px; }
          .bubble { background:#fff; border-left:4px solid #0A7E3E; padding:16px 18px; border-radius:8px; font-size:15px; white-space:pre-wrap; }
          .footer { text-align:center; margin-top:24px; color:#888; font-size:12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h2 style="margin:0">sBay Support</h2></div>
          <div class="content">
            <p>Hi ${escapeHtml(displayName)},</p>
            <p>Our support team has replied to your message:</p>
            <div class="bubble">${escapeHtml(adminReply)}</div>
            <p style="margin-top:20px;color:#555;font-size:14px;">
              If you have further questions, simply reply to this email or visit our support widget on <a href="https://sbaygh.com/home">sBay</a>.
            </p>
          </div>
          <div class="footer">© ${new Date().getFullYear()} sBay — Campus Marketplace</div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transport.sendMail(mailOptions);
    // eslint-disable-next-line no-console
    console.log(`[email] Support reply sent to ${toEmail}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[email] Failed to send support reply:', error.message);
  }
}

/**
 * Send order status notification email to buyer
 */
export async function sendOrderStatusEmail(user, order, newStatus) {
  const transport = getTransporter();
  if (!transport) {
    // eslint-disable-next-line no-console
    console.log(`[email] Order status update for ${user.email}: ${order.invoiceNumber} → ${newStatus}`);
    return;
  }

  const statusMessages = {
    pending: 'Your order has been placed and payment is being processed.',
    processing: 'Your order is being prepared by the seller.',
    shipped: 'Your order has been shipped and is on its way!',
    delivered: 'Your order has been delivered.',
    completed: 'Your order is complete. Thank you for shopping with sBay!',
    canceled: 'Your order has been canceled.',
  };

  const statusColors = {
    pending: '#FFA000',
    processing: '#1976D2',
    shipped: '#7B1FA2',
    delivered: '#388E3C',
    completed: '#0A7E3E',
    canceled: '#D32F2F',
  };

  const mailOptions = {
    from: `"sBay Orders" <${env.EMAIL_USER}>`,
    to: user.email,
    subject: `Order ${order.invoiceNumber} - ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0A7E3E 0%, #0d9647 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .status-badge { display: inline-block; padding: 8px 16px; background: ${statusColors[newStatus] || '#666'}; color: white; border-radius: 20px; font-weight: bold; font-size: 14px; margin: 15px 0; }
          .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e0e0e0; }
          .order-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
          .order-row:last-child { border-bottom: none; }
          .button { display: inline-block; padding: 15px 30px; background: #0A7E3E; color: white !important; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Update</h1>
          </div>
          <div class="content">
            <p>Hi ${escapeHtml(user.name)},</p>
            <p>Your order status has been updated:</p>
            <div style="text-align: center;">
              <span class="status-badge">${newStatus.toUpperCase()}</span>
            </div>
            <p>${statusMessages[newStatus] || 'Your order status has changed.'}</p>
            <div class="order-details">
              <h3 style="margin-top: 0; color: #0A7E3E;">Order Details</h3>
              <div class="order-row">
                <span style="color: #666;">Order Number:</span>
                <strong>${order.invoiceNumber}</strong>
              </div>
              <div class="order-row">
                <span style="color: #666;">Total Amount:</span>
                <strong>GH₵ ${order.total?.toLocaleString()}</strong>
              </div>
              <div class="order-row">
                <span style="color: #666;">Items:</span>
                <strong>${order.items?.length || 0} item${order.items?.length !== 1 ? 's' : ''}</strong>
              </div>
            </div>
            <p style="text-align: center;">
              <a href="https://sbaygh.com/profile/orders" class="button">View Order Details</a>
            </p>
            ${newStatus === 'delivered' ? '<p style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;"><strong>⚠️ Action Required:</strong> Please confirm receipt of your order to release payment to the seller.</p>' : ''}
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} sBay - Campus Marketplace Reimagined</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transport.sendMail(mailOptions);
    // eslint-disable-next-line no-console
    console.log(`[email] Order status email sent to ${user.email}: ${order.invoiceNumber} → ${newStatus}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[email] Failed to send order status email:', error.message);
  }
}

/**
 * Send new order notification to seller
 */
export async function sendNewOrderEmail(seller, order) {
  const transport = getTransporter();
  if (!transport) {
    // eslint-disable-next-line no-console
    console.log(`[email] New order notification for ${seller.email}: ${order.invoiceNumber}`);
    return;
  }

  const mailOptions = {
    from: `"sBay Orders" <${env.EMAIL_USER}>`,
    to: seller.email,
    subject: `🎉 New Order Received - ${order.invoiceNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0A7E3E 0%, #0d9647 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e0e0e0; }
          .order-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
          .order-row:last-child { border-bottom: none; }
          .item-list { background: #f8f8f8; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .button { display: inline-block; padding: 15px 30px; background: #0A7E3E; color: white !important; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .highlight { background: #e8f5e9; border-left: 4px solid #0A7E3E; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 New Order!</h1>
          </div>
          <div class="content">
            <p>Hi ${escapeHtml(seller.name)},</p>
            <p>Great news! You've received a new order on sBay.</p>
            <div class="order-details">
              <h3 style="margin-top: 0; color: #0A7E3E;">Order Details</h3>
              <div class="order-row">
                <span style="color: #666;">Order Number:</span>
                <strong>${order.invoiceNumber}</strong>
              </div>
              <div class="order-row">
                <span style="color: #666;">Total Amount:</span>
                <strong style="color: #0A7E3E; font-size: 1.2em;">GH₵ ${order.total?.toLocaleString()}</strong>
              </div>
              <div class="order-row">
                <span style="color: #666;">Payment Status:</span>
                <strong style="color: #FFA000;">HELD IN ESCROW</strong>
              </div>
            </div>
            <div class="item-list">
              <h4 style="margin-top: 0;">Items Ordered:</h4>
              ${order.items?.map(item => `
                <div style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                  <strong>${escapeHtml(item.title)}</strong><br>
                  <span style="color: #666; font-size: 0.9em;">Qty: ${item.qty} × GH₵ ${item.price?.toLocaleString()} = GH₵ ${(item.qty * item.price)?.toLocaleString()}</span>
                </div>
              `).join('') || '<p>No items</p>'}
            </div>
            <div class="highlight">
              <strong>Next Steps:</strong>
              <ol style="margin: 10px 0; padding-left: 20px;">
                <li>Prepare the items for delivery</li>
                <li>Contact the buyer to arrange delivery</li>
                <li>Update the order status as you process it</li>
                <li>Funds will be released once the buyer confirms receipt</li>
              </ol>
            </div>
            <p style="text-align: center;">
              <a href="https://sbaygh.com/seller-dashboard/sales" class="button">View Order</a>
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} sBay - Campus Marketplace Reimagined</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transport.sendMail(mailOptions);
    // eslint-disable-next-line no-console
    console.log(`[email] New order email sent to seller ${seller.email}: ${order.invoiceNumber}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[email] Failed to send new order email:', error.message);
  }
}

/**
 * Send SMS notification (placeholder - integrate with SMS provider like Twilio, Africa's Talking, etc.)
 * For Ghana, popular options: Hubtel, Africa's Talking
 */
export async function sendSMS(phoneNumber, message) {
  // eslint-disable-next-line no-console
  console.log(`[SMS] Would send to ${phoneNumber}: ${message}`);
  
  // TODO: Integrate with SMS provider
  // Example for Africa's Talking or Hubtel:
  /*
  const options = {
    to: phoneNumber,
    message: message,
    from: 'sBay' // Your sender ID
  };
  
  await smsProvider.send(options);
  */
  
  return Promise.resolve();
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(user) {
  const transport = getTransporter();
  if (!transport) return;

  const mailOptions = {
    from: `"sBay" <${env.EMAIL_USER}>`,
    to: user.email,
    subject: 'Welcome to sBay! 🎉',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0A7E3E 0%, #0d9647 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 30px; background: #0A7E3E; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to sBay! 🎉</h1>
          </div>
          <div class="content">
            <p>Hi ${escapeHtml(user.name)},</p>
            <p>Welcome to sBay - Ghana's premier campus marketplace!</p>
            <p>You can now:</p>
            <ul>
              <li>Browse thousands of products from fellow students</li>
              <li>Buy textbooks, electronics, fashion, and more</li>
              <li>Sell items you no longer need</li>
              <li>Connect with buyers and sellers on campus</li>
            </ul>
            <p style="text-align: center;">
              <a href="https://sbaygh.com/home" class="button">Start Shopping</a>
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} sBay - Campus Marketplace Reimagined</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transport.sendMail(mailOptions);
    // eslint-disable-next-line no-console
    console.log(`[email] Welcome email sent to ${user.email}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[email] Failed to send welcome email:', error.message);
  }
}
