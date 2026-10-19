import mongoose from 'mongoose';

/**
 * Append-only log of admin actions. Used for accountability — every
 * verify/restrict/escrow-release/plan-edit call writes a row here.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actor:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, index: true },
    target: {
      kind: { type: String, enum: ['user', 'product', 'order', 'plan', 'settings', 'chat', 'ticket', 'payment'] },
      id:   { type: mongoose.Schema.Types.ObjectId },
    },
    detail: mongoose.Schema.Types.Mixed,
    ip:     String,
    ua:     String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
