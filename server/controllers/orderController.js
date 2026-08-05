const Order = require("../models/Order");

// Place Order (protected - customer comes from JWT / MongoDB)
const placeOrder = async (req, res) => {
  try {
    const user = req.user;

    const {
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      products,
      subtotal,
      deliveryCharge,
      tax,
      discount,
      couponCode,
      total,
      paymentMethod,
    } = req.body;

    if (
      !products ||
      !Array.isArray(products) ||
      products.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one product is required",
      });
    }

    if (total === undefined || total === null || isNaN(total)) {
      return res.status(400).json({
        success: false,
        message: "Total amount is required",
      });
    }

    const order = await Order.create({
      customerId: user._id,
      customerName: (customerName || user.name || "").trim(),
      customerEmail: (customerEmail || user.email || "").trim().toLowerCase(),
      customerPhone: (customerPhone || user.phone || "").trim(),
      customerAddress: (customerAddress || user.address || "").trim(),
      products,
      subtotal: Number(subtotal) || 0,
      deliveryCharge: Number(deliveryCharge) || 0,
      tax: Number(tax) || 0,
      discount: Number(discount) || 0,
      couponCode: (couponCode || "").trim(),
      total: Number(total) || 0,
      paymentMethod: (paymentMethod || "").trim(),
      status: "Pending",
    });

    res.status(201).json({
      success: true,
      message: "Order Placed Successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get My Orders (protected - only the logged-in customer's orders)
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.user._id }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get One Order (protected - owner or admin)
const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (
      req.user.role !== "admin" &&
      String(order.customerId) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this order",
      });
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Order Status (protected - owner or admin)
const updateOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (
      req.user.role !== "admin" &&
      String(order.customerId) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this order",
      });
    }

    if (req.body.status) order.status = req.body.status;
    if (typeof req.body.customerPhone === "string") {
      order.customerPhone = req.body.customerPhone.trim();
    }
    if (typeof req.body.customerAddress === "string") {
      order.customerAddress = req.body.customerAddress.trim();
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order Updated",
      order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Order (protected - owner or admin)
const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (
      req.user.role !== "admin" &&
      String(order.customerId) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this order",
      });
    }

    await Order.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Order Deleted",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  placeOrder,
  getMyOrders,
  getOrder,
  updateOrder,
  deleteOrder,
};