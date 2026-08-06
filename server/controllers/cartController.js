const Cart = require("../models/Cart");
const Product = require("../models/Product");
const mongoose = require("mongoose");

const MAX_QTY = 99;

const isObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value) &&
  String(new mongoose.Types.ObjectId(value)) === value;

// Add to Cart (protected - uses logged-in user from JWT)
const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    if (!productId || !isObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product selected",
      });
    }

    const product = await Product.findById(productId);

    if (!product || product.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Product not found or no longer available",
      });
    }

    const qty = Math.min(MAX_QTY, Math.max(1, parseInt(quantity, 10) || 1));

    const existing = await Cart.findOne({
      user: req.user._id,
      product: productId,
    });

    let cart;
    if (existing) {
      existing.quantity = Math.min(MAX_QTY, existing.quantity + qty);
      cart = await existing.save();
    } else {
      cart = await Cart.create({
        user: req.user._id,
        product: productId,
        quantity: qty,
      });
    }

    res.status(201).json({
      success: true,
      message: "Product Added to Cart",
      cart,
    });
  } catch (error) {
    console.error("[addToCart] error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

// Get User Cart (protected)
const getCart = async (req, res) => {
  try {
    const cart = await Cart.find({ user: req.user._id }).populate("product");

    res.status(200).json({
      success: true,
      cart,
    });
  } catch (error) {
    console.error("[getCart] error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

// Update Quantity (protected)
const updateCart = async (req, res) => {
  try {
    const { quantity } = req.body;

    if (parseInt(quantity, 10) < 1 || Number.isNaN(parseInt(quantity, 10))) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    const qty = Math.min(MAX_QTY, parseInt(quantity, 10));

    const cart = await Cart.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { quantity: qty },
      { new: true }
    );

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Cart Updated",
      cart,
    });
  } catch (error) {
    console.error("[updateCart] error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

// Remove Item (protected)
const removeCart = async (req, res) => {
  try {
    const cart = await Cart.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Item Removed",
    });
  } catch (error) {
    console.error("[removeCart] error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

module.exports = {
  addToCart,
  getCart,
  updateCart,
  removeCart,
};
