import { escapeRegex } from '../utils/regex.js';
import { SupportTicket } from '../models/SupportTicket.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { audit } from '../utils/audit.js';
import { emitToAdmins, emitToUser } from '../socket.js';
import { sendSupportReplyEmail } from '../utils/email.js';

/* ============================================================
   Public intake — used by the customer-service chat widget.
   Anyone can post (rate-limited) but registered users have
   their account stitched onto the ticket automatically.
   ============================================================ */

/**
 * POST /support/tickets — open a ticket OR append a message to an
 * existing open ticket from the same email. Idempotent enough that
 * a user double-tapping send doesn't create twins.
 */
export const submitSupport = asyncHandler(async (req, res) => {
  const { email, phone, message, name } = req.body;
  if (!message?.trim()) throw new HttpError(400, 'Message is required.');
  if (!email?.trim()) throw new HttpError(400, 'Email is required.');
  if (!phone?.trim()) throw new HttpError(400, 'Contact number is required.');

  const lowerEmail = email.toLowerCase().trim();
  const contactName = req.user?.name || name?.trim() || lowerEmail.split('@')[0] || 'Customer';
  const trimmedMessage = message.trim();

  // Reuse an existing open ticket if the same email has one — keeps
  // back-and-forth threaded into a single conversation.
  let ticket = await SupportTicket.findOne({ email: lowerEmail, status: 'open' });
  if (!ticket) {
    ticket = new SupportTicket({
      name: contactName,
      email: lowerEmail,
      phone: phone.trim(),
      subject: trimmedMessage.slice(0, 80),
      user: req.user?._id,
      ip: req.ip,
      messages: [],
    });
  } else {
    if (!ticket.name) ticket.name = contactName;
    if (!ticket.phone) ticket.phone = phone.trim();
  }

  ticket.messages.push({ body: trimmedMessage, fromAdmin: false, sender: req.user?._id });
  ticket.lastMessage = trimmedMessage.slice(0, 240);
  ticket.lastMessageAt = new Date();
  await ticket.save();

  // Notify admins of new support ticket/message.
  emitToAdmins('support:new', { ticketId: ticket._id, subject: ticket.subject, email: ticket.email });

  // Only acknowledge — the endpoint is public and keyed by email, so
  // returning the ticket would let anyone read someone else's thread
  // (including admin replies) just by knowing their address.
  res.status(201).json({ ok: true, ticketId: ticket._id });
});

/* ============================================================
   Admin-side handlers. Mounted under the obfuscated admin prefix.
   ============================================================ */

export const listTickets = asyncHandler(async (req, res) => {
  const { status, q } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (q) {
    const escaped = escapeRegex(q);
    filter.$or = [
      { name:    { $regex: escaped, $options: 'i' } },
      { email:   { $regex: escaped, $options: 'i' } },
      { subject: { $regex: escaped, $options: 'i' } },
      { lastMessage: { $regex: escaped, $options: 'i' } },
    ];
  }
  const items = await SupportTicket.find(filter)
    .sort({ lastMessageAt: -1 })
    .limit(200)
    .populate('user', 'name email');
  res.json({ items });
});

export const replyTicket = asyncHandler(async (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) throw new HttpError(400, 'Reply body is required.');

  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) throw new HttpError(404, 'Ticket not found.');

  ticket.messages.push({ body: body.trim(), fromAdmin: true, sender: req.user._id });
  ticket.lastMessage   = body.trim().slice(0, 240);
  ticket.lastMessageAt = new Date();
  if (ticket.status === 'resolved') ticket.status = 'open';
  await ticket.save();

  audit(req, 'support.reply', { kind: 'ticket', id: ticket._id });

  // Notify the user if they're connected.
  if (ticket.user) emitToUser(ticket.user.toString(), 'support:reply', { ticketId: ticket._id });

  // Send email reply to the ticket's email address (non-blocking).
  sendSupportReplyEmail({
    toEmail: ticket.email,
    toName:  ticket.name,
    adminReply: body.trim(),
    ticketSubject: ticket.subject,
  }).catch(() => { /* swallow email failures — reply is already saved */ });

  res.json({ ticket });
});

export const closeTicket = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) throw new HttpError(404, 'Ticket not found.');
  ticket.status = 'resolved';
  await ticket.save();
  audit(req, 'support.close', { kind: 'ticket', id: ticket._id });
  res.json({ ticket });
});
