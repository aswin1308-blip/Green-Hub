const Cart = require("../models/Cart");

// Add to Cart (protected - uses logged-in user from JWT)
const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "productId is required",
      });
    }

    const qty = Math.max(1, parseInt(quantity, 10) || 1);

    const existing = await Cart.findOne({
      user: req.user._id,
      product: productId,
    });

    let cart;
    if (existing) {
      existing.quantity += qty;
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
    res.status(500).json({
      success: false,
      message: error.message,
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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Quantity (protected)
const updateCart = async (req, res) => {
  try {
    const { quantity } = req.body;

    if (!quantity || parseInt(quantity, 10) < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    const cart = await Cart.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { quantity: parseInt(quantity, 10) },
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
    res.status(500).json({
      success: false,
      message: error.message,
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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  addToCart,
  getCart,
  updateCart,
  removeCart,
};
