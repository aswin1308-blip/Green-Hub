const mongoose = require("mongoose");

const orderProductSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Order item requires a product"],
    },

    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },

    image: {
      type: String,
      default: "",
    },

    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },

    quantity: {
      type: Number,
      required: [true, "Product quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Order requires a customer"],
    },

    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },

    customerEmail: {
      type: String,
      required: [true, "Customer email is required"],
      lowercase: true,
      trim: true,
    },

    customerPhone: {
      type: String,
      default: "",
      trim: true,
    },

    customerAddress: {
      type: String,
      required: [true, "Delivery address is required"],
      trim: true,
    },

    products: {
      type: [orderProductSchema],
      default: [],
    },

    subtotal: {
      type: Number,
      default: 0,
      min: [0, "Subtotal cannot be negative"],
    },

    deliveryCharge: {
      type: Number,
      default: 0,
      min: [0, "Delivery charge cannot be negative"],
    },

    total: {
      type: Number,
      required: [true, "Total amount is required"],
      min: [0, "Total amount cannot be negative"],
    },

    paymentMethod: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: {
        values: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
        message:
          "Order status must be Pending, Processing, Shipped, Delivered or Cancelled",
      },
      default: "Pending",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Order", orderSchema);