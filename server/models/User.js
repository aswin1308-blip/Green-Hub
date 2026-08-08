const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      default: "",
    },

    address: {
      type: String,
      default: "",
    },

    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    // --- Password reset (forgot-password flow) ---
    // resetCodeHash: bcrypt hash of the 6-digit verification code.
    // Never store the raw code — only the hash.
    resetCodeHash: {
      type: String,
      default: "",
    },

    resetCodeExpires: {
      type: Date,
      default: null,
    },

    // Failed verification attempts (locks the code after MAX_ATTEMPTS).
    resetCodeAttempts: {
      type: Number,
      default: 0,
    },

    // Set when the code has been verified; allows the password to be
    // changed without asking for the code a second time.
    resetCodeVerifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);