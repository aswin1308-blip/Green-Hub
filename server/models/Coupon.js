const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, "Coupon code must be at least 3 characters"],
      maxlength: [30, "Coupon code cannot exceed 30 characters"],
    },

    discountType: {
      type: String,
      required: [true, "Discount type is required"],
      enum: {
        values: ["percentage", "flat"],
        message: "Discount type must be percentage or flat",
      },
    },

    value: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"],
      validate: {
        validator: function (value) {
          if (this.discountType === "percentage") {
            return value <= 100;
          }
          return true;
        },
        message: "Percentage discount cannot exceed 100",
      },
    },

    minOrderValue: {
      type: Number,
      default: 0,
      min: [0, "Minimum order value cannot be negative"],
    },

    expiryDate: {
      type: Date,
      validate: {
        validator: function (value) {
          return value == null || value > new Date();
        },
        message: "Expiry date must be in the future",
      },
    },

    usageLimit: {
      type: Number,
      default: 0,
      min: [0, "Usage limit cannot be negative"],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

couponSchema.methods.isValid = function () {
  const notExpired =
    !this.expiryDate || this.expiryDate.getTime() > Date.now();
  return this.isActive && notExpired && !(this.usageLimit && this.usageLimit <= 0);
};

module.exports = mongoose.model("Coupon", couponSchema);