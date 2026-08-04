const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Order item requires a product"],
    },

    quantity: {
      type: Number,
      required: [true, "Order item quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },

    price: {
      type: Number,
      required: [true, "Order item price is required"],
      min: [0, "Price cannot be negative"],
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Order requires a user"],
    },

    items: {
      type: [orderItemSchema],
      default: [],
    },

    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: [0, "Total amount cannot be negative"],
    },

    paymentStatus: {
      type: String,
      enum: {
        values: ["pending", "paid", "failed", "refunded"],
        message: "Payment status must be pending, paid, failed or refunded",
      },
      default: "pending",
    },

    paymentId: {
      type: String,
      default: "",
    },

    orderStatus: {
      type: String,
      enum: {
        values: ["pending", "shipped", "delivered", "cancelled"],
        message: "Order status must be pending, shipped, delivered or cancelled",
      },
      default: "pending",
    },

    shippingAddress: {
      type: String,
      required: [true, "Shipping address is required"],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Order", orderSchema);