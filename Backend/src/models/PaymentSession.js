import mongoose from 'mongoose';

const paymentSessionSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },

    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        qty: { type: Number, required: true, min: 1 },
        _id: false,
      },
    ],

    deliveryLocation: { type: String, trim: true },

    amountPesewas: { type: Number, min: 0 },

    status: {
      type: String,
      // needs_refund: charged by Paystack but could not be fulfilled
      // (e.g. sold out mid-payment) — an admin must refund it.
      enum: ['pending', 'processing', 'paid', 'failed', 'needs_refund'],
      default: 'pending',
      index: true,
    },
    failureReason: String,

    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],

    paystackData: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

paymentSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export const PaymentSession = mongoose.model('PaymentSession', paymentSessionSchema);
