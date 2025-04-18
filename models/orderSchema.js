const mongoose = require("mongoose")
const { v4: uuidv4 } = require("uuid")
const { Schema } = mongoose

const orderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
    },
    orderedItems: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          default: 0,
        },
        status: {
          type: String,
          enum: [
            "Pending",
            "Processing",
            "Shipped",
            "Delivered",
            "Cancelled",
            "Return Request",
            "Return Processing",
            "Return Denied",
            "Returned",
          ],
          default: "Pending",
        },
        refunded: { type: Boolean, default: false } ,
        cancellationReason: {
          type: String,
          default: null,
        },
        cancelledAt: {
          type: Date,
          default: null,
        },
        _id: {
          type: Schema.Types.ObjectId,
          default: () => new mongoose.Types.ObjectId(),
        },
      },
    ],
    totalPrice: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    finalAmount: {
      type: Number,
      required: true,
    },
    address: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    invoiceDate: {
      type: Date,
    },
    status: {
      type: String,
      required: true,
      enum: [
        "Pending",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled",
        "Return Request",
        "Return Processing",
        "Return Denied",
        "Returned",
      ],
    },
    createdOn: {
      type: Date,
      default: Date.now,
      required: true,
    },
    couponApplied: {
      type: Boolean,
      default: false,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["COD", "Razorpay", "Wallet", "Card"],
      default: "COD",
    },
    paymentDetails: {
      method: String,
      razorpayOrderId: String,
      razorpayPaymentId: String,
      razorpaySignature: String,
      walletTransactionId: String,
    },
    cancellationDate: {
      type: Date,
    },
  },
  { timestamps: true },
)

const Order = mongoose.model("Order", orderSchema)

module.exports = Order

