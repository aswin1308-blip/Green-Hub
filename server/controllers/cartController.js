const Cart = require("../models/Cart");
const Product = require("../models/Product");
const mongoose = require("mongoose");

const MAX_QTY = 99;

const isObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value) &&
  String(new mongoose.Types.ObjectId(value)) === value;

// Shared helper: full populated cart for a user. Every endpoint returns this
// same shape ({ success, cart }) so the frontend can replace its local state
// with the response directly.
const getUserCart = async (userId) =>
  Cart.find({ user: userId }).populate("product");

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

    const pQty = Math.min(MAX_QTY, Math.max(1, parseInt(quantity, 10) || 1));

    // Never allow adding more than the available stock.
    const available = Math.max(0, Number(product.stock) || 0);
    if (available <= 0) {
      return res.status(400).json({
        success: false,
        message: "This product is currently out of stock.",
      });
    }

    const qty = Math.min(pQty, available);

    const existing = await Cart.findOne({
      user: req.user._id,
      product: productId,
    });

    if (existing) {
      existing.quantity = Math.min(MAX_QTY, Math.min(existing.quantity + qty, available));
      await existing.save();
    } else {
      await Cart.create({
        user: req.user._id,
        product: productId,
        quantity: qty,
      });
    }

    const cart = await getUserCart(req.user._id);

    res.status(200).json({
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
    const cart = await getUserCart(req.user._id);

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
// NOTE: req.params.id is the cart ITEM's _id (the Cart document id), not the
// product id — it is matched against the Cart document's own _id below.
const updateCart = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (!isObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid cart item id",
      });
    }

    const qty = parseInt(quantity, 10);

    if (Number.isNaN(qty)) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a valid number",
      });
    }

    // Quantity <= 0 means the item should be removed from the cart.
    if (qty <= 0) {
      const removed = await Cart.findOneAndDelete({
        _id: id,
        user: req.user._id,
      });

      if (!removed) {
        return res.status(404).json({
          success: false,
          message: "Cart item not found",
        });
      }

      const cart = await getUserCart(req.user._id);

      return res.status(200).json({
        success: true,
        message: "Item Removed from Cart",
        cart,
      });
    }

    const cartItem = await Cart.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { quantity: Math.min(MAX_QTY, qty) },
      { new: true }
    );

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    const cart = await getUserCart(req.user._id);

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
// NOTE: req.params.id is the cart ITEM's _id (the Cart document id), not the
// product id — matched against the Cart document's own _id below.
const removeCart = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid cart item id",
      });
    }

    const removed = await Cart.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    const cart = await getUserCart(req.user._id);

    res.status(200).json({
      success: true,
      message: "Item Removed",
      cart,
    });
  } catch (error) {
    console.error("[removeCart] error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

// Clear Cart (protected) — removes every item for the current user.
const clearCart = async (req, res) => {
  try {
    await Cart.deleteMany({ user: req.user._id });

    res.status(200).json({
      success: true,
      message: "Cart cleared",
      cart: [],
    });
  } catch (error) {
    console.error("[clearCart] error:", error);
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
  clearCart,
};
