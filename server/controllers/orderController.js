const Order = require("../models/Order");
const Product = require("../models/Product");
const Coupon = require("../models/Coupon");
const mongoose = require("mongoose");

// Pricing rules — MUST mirror client/js/checkout.js (DELIVERY_FEE,
// FREE_DELIVERY_MIN, GST_RATE) so the amount charged equals the amount
// shown. The server is the source of truth; client-supplied totals are
// ignored and recomputed here.
const DELIVERY_FEE = 50;
const FREE_DELIVERY_MIN = 499;
const GST_RATE = 0.05;

const isObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value) &&
  String(new mongoose.Types.ObjectId(value)) === value;

const itemPrice = (product) =>
  Number(product.discountPrice) || Number(product.price) || 0;

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
      couponCode,
      paymentMethod,
      razorpayPaymentId,
      razorpayOrderId,
    } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product is required",
      });
    }

    if (!customerAddress || !String(customerAddress).trim()) {
      return res.status(400).json({
        success: false,
        message: "Delivery address is required",
      });
    }

    // ---- Resolve products + quantities (never trust client prices) ----

    const requested = [];
    const qtyMap = {};
    for (const item of products) {
      const pid = item && item.productId;
      if (!pid || !isObjectId(pid)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product in order",
        });
      }
      const key = String(pid);
      if (!qtyMap[key]) requested.push(pid);
      qtyMap[key] = (qtyMap[key] || 0) + (parseInt(item.quantity, 10) || 1);
    }

    const found = await Product.find({ _id: { $in: requested } });
    const byId = new Map(found.map((p) => [String(p._id), p]));

    for (const pid of requested) {
      const product = byId.get(String(pid));
      if (!product || product.status !== "active") {
        return res.status(400).json({
          success: false,
          message: "One or more products are no longer available",
        });
      }
      const qty = qtyMap[String(pid)];
      if (qty > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} unit(s) of "${product.name}" left in stock`,
        });
      }
    }

    // ---- Compute totals server-side ----

    let subtotal = 0;
    for (const pid of requested) {
      subtotal += itemPrice(byId.get(String(pid))) * qtyMap[String(pid)];
    }

    const deliveryCharge = subtotal >= FREE_DELIVERY_MIN ? 0 : DELIVERY_FEE;
    const tax = Math.round(subtotal * GST_RATE);

    // ---- Coupon enforcement (validated again at order time) ----

    let discount = 0;
    let code = String(couponCode || "").trim().toUpperCase();
    if (code) {
      const coupon = await Coupon.findOne({ code });
      if (!coupon) {
        return res.status(400).json({
          success: false,
          message: "Invalid coupon code",
        });
      }
      if (!coupon.isValid()) {
        return res.status(400).json({
          success: false,
          message: "Coupon has expired or is no longer active",
        });
      }
      if (subtotal < coupon.minOrderValue) {
        return res.status(400).json({
          success: false,
          message:
            "Minimum order value for this coupon is ₹" +
            Number(coupon.minOrderValue).toLocaleString("en-IN"),
        });
      }
      discount =
        coupon.discountType === "percentage"
          ? Math.round((subtotal * coupon.value) / 100)
          : coupon.value;
      discount = Math.min(discount, subtotal);
    }

    const total = subtotal + deliveryCharge + tax - discount;

    // ---- Payment must be completed for online methods ----

    const isOnlinePayment = String(paymentMethod || "") !== "Cash on Delivery";
    if (isOnlinePayment && !razorpayPaymentId) {
      return res.status(400).json({
        success: false,
        message: "Payment was not completed. Please try again.",
      });
    }

    // ---- Snapshot products for the order record ----

    const orderProducts = requested.map((pid) => {
      const product = byId.get(String(pid));
      const images = product.images || [];
      return {
        productId: pid,
        name: product.name,
        image: images[0] || "",
        price: itemPrice(product),
        quantity: qtyMap[String(pid)],
      };
    });

    // ---- Decrement stock ----

    await Promise.all(
      requested.map((pid) => {
        const product = byId.get(String(pid));
        return Product.updateOne(
          { _id: pid },
          { $inc: { stock: -qtyMap[String(pid)] } }
        );
      })
    );

    // ---- Consume the coupon (once per use) ----

    if (code) {
      await Coupon.updateOne(
        { code },
        { $inc: { usageLimit: -1 } }
      ).then(() => {}).catch(() => {});
    }

    const order = await Order.create({
      customerId: user._id,
      customerName: (customerName || user.name || "").trim(),
      customerEmail: (customerEmail || user.email || "").trim().toLowerCase(),
      customerPhone: (customerPhone || user.phone || "").trim(),
      customerAddress: String(customerAddress).trim(),
      products: orderProducts,
      subtotal,
      deliveryCharge,
      tax,
      discount,
      couponCode: code,
      total,
      paymentMethod: (paymentMethod || "").trim(),
      paymentStatus: isOnlinePayment ? "Paid" : "Pending",
      razorpayPaymentId: razorpayPaymentId || "",
      razorpayOrderId: razorpayOrderId || "",
      status: "Pending",
    });

    res.status(201).json({
      success: true,
      message: "Order Placed Successfully",
      order,
    });
  } catch (error) {
    console.error("[placeOrder] error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
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