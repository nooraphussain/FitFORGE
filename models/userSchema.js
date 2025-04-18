const mongoose = require("mongoose")
const { Schema } = require("mongoose")

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phoneNumber: {
    type: String,
    required: false,
    sparse: true,
    default: null,
  },
  password: {
    type: String,
    required: false,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  googleId: {
    type: String,
    unique: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  cart: [
    {
      type: Schema.Types.ObjectId,
      ref: "Cart",
    },
  ],
  wallet: {
    balance: {
      type: Number,
      default: 0,
    },
    transactions: [
      {
        type: {
          type: String,
          enum: ["credit", "debit"],
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
        description: String,
        date: {
          type: Date,
          default: Date.now,
        },
        paymentId: String,
        transactionId: String,
      },
    ],
  },
  wishlist: [
    {
      type: Schema.Types.ObjectId,
      ref: "wishlist",
    },
  ],
  orderHistory: [
    {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  referralBalance: {
    type: Number,
    default: 0,
    required: true
  },
  redeemedReferrals: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ]
})

const User = mongoose.model("User", userSchema)

module.exports = User
