const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");
const mongoose = require("mongoose");

const isObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value) &&
  String(new mongoose.Types.ObjectId(value)) === value;

// Add to Wishlist (protected - uses logged-in user from JWT)
const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

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

    const existing = await Wishlist.findOne({
      user: req.user._id,
      product: productId,
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Already in Wishlist",
        wishlist: existing,
      });
    }

    const item = await Wishlist.create({
      user: req.user._id,
      product: productId,
    });

    res.status(201).json({
      success: true,
      message: "Added to Wishlist",
      wishlist: item,
    });
  } catch (error) {
    console.error("[addToWishlist] error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

// Get User Wishlist (protected)
const getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.find({ user: req.user._id })
      .populate("product")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      wishlist,
    });
  } catch (error) {
    console.error("[getWishlist] error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

// Remove Item (protected - by productId, like the Wishlist model stores)
const removeFromWishlist = async (req, res) => {
  try {
    const item = await Wishlist.findOneAndDelete({
      user: req.user._id,
      product: req.params.productId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found in wishlist",
      });
    }

    res.status(200).json({
      success: true,
      message: "Removed from Wishlist",
    });
  } catch (error) {
    console.error("[removeFromWishlist] error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

module.exports = {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
};
