const Order = require("../models/Order");
const Product = require("../models/Product");
const Coupon = require("../models/Coupon");
const Notification = require("../models/Notification");
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

const MAX_QTY = 99;

// Resolve a client-supplied product list against CURRENT stock. Never
// trusts client prices or quantities. Every requested quantity is clamped
// to what is actually available so the customer is never hard-blocked:
// - quantity above stock  -> reduced to stock (adjustment recorded)
// - stock is 0 / inactive -> item removed from the order (adjustment)
// Returns { items, adjustments, allOutOfStock }.
const resolveOrderItems = async (rawProducts) => {
  const requested = [];
  const qtyMap = {};
  for (const item of rawProducts || []) {
    const pid = item && item.productId;
    if (!pid || !isObjectId(pid)) continue;
    const key = String(pid);
    if (!qtyMap[key]) requested.push(pid);
    qtyMap[key] = (qtyMap[key] || 0) + (parseInt(item.quantity, 10) || 1);
  }

  const found = await Product.find({ _id: { $in: requested } });
  const byId = new Map(found.map((p) => [String(p._id), p]));

  const items = [];
  const adjustments = [];

  for (const pid of requested) {
    const product = byId.get(String(pid));
    const requestedQty = Math.min(MAX_QTY, qtyMap[String(pid)]);
    const name = product ? product.name : "Product";

    if (!product || product.status !== "active") {
      adjustments.push({
        productId: pid,
        name,
        requested: requestedQty,
        available: 0,
        finalQuantity: 0,
        removed: true,
        reason: "unavailable",
      });
      continue;
    }

    const available = Math.max(0, Number(product.stock) || 0);
    const finalQuantity = Math.min(requestedQty, available);

    if (finalQuantity <= 0) {
      adjustments.push({
        productId: pid,
        name,
        requested: requestedQty,
        available,
        finalQuantity: 0,
        removed: true,
        reason: "out of stock",
      });
      continue;
    }

    if (finalQuantity < requestedQty) {
      adjustments.push({
        productId: pid,
        name,
        requested: requestedQty,
        available,
        finalQuantity,
        removed: false,
        reason: "quantity reduced",
      });
    }

    const images = product.images || [];
    items.push({
      productId: pid,
      name,
      image: images[0] || "",
      price: itemPrice(product),
      quantity: finalQuantity,
      requested: requestedQty,
    });
  }

  const allOutOfStock = requested.length > 0 && items.length === 0;

  return { items, adjustments, allOutOfStock };
};

// Server-side totals (same rules as checkout.js so the charged amount
// equals the shown amount). A coupon that no longer qualifies is dropped
// gracefully instead of failing the whole order.
const computeTotals = async (items, couponCode) => {
  const subtotal = items.reduce(
    (sum, it) => sum + Number(it.price) * Number(it.quantity),
    0
  );

  const deliveryCharge = subtotal >= FREE_DELIVERY_MIN ? 0 : DELIVERY_FEE;
  const tax = Math.round(subtotal * GST_RATE);

  let discount = 0;
  let code = String(couponCode || "").trim().toUpperCase();
  let couponError = "";

  if (code && subtotal > 0) {
    const coupon = await Coupon.findOne({ code });
    if (!coupon || !coupon.isValid()) {
      couponError = "Coupon is no longer valid and was removed";
      code = "";
    } else if (subtotal < coupon.minOrderValue) {
      couponError =
        "Coupon no longer applies (minimum order value is ₹" +
        Number(coupon.minOrderValue).toLocaleString("en-IN") +
        ")";
      code = "";
    } else {
      discount =
        coupon.discountType === "percentage"
          ? Math.round((subtotal * coupon.value) / 100)
          : coupon.value;
      discount = Math.min(discount, subtotal);
    }
  }

  const total = subtotal + deliveryCharge + tax - discount;

  return {
    subtotal,
    deliveryCharge,
    tax,
    discount,
    total,
    couponCode: code,
    couponError,
  };
};

// Preflight (protected): validate the cart against CURRENT stock BEFORE
// any payment is initiated. Auto-adjusts quantities, removes out-of-stock
// items and returns the corrected order summary so the frontend can show
// the customer what changed and get approval before charging.
const preflightOrder = async (req, res) => {
  try {
    const { products, couponCode } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product is required",
      });
    }

    const { items, adjustments, allOutOfStock } = await resolveOrderItems(
      products
    );

    const totals = await computeTotals(items, couponCode);

    res.status(200).json({
      success: true,
      items,
      adjustments,
      adjusted: adjustments.length > 0,
      allOutOfStock,
      totals,
    });
  } catch (error) {
    console.error("[preflightOrder] error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

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

    // ---- Resolve products + clamp quantities to current stock ----
    // Source of truth. If stock changed since preflight (someone else
    // bought the last one), we adjust here too instead of hard-failing.

    const { items, adjustments } = await resolveOrderItems(products);

    // ---- Atomic stock deduction (stock can never go negative) ----
    // Each decrement is a findOneAndUpdate with a stock >= qty guard. If it
    // matches nothing, the stock moved in the last milliseconds — re-read
    // and clamp down to the live amount (or drop the item if now empty).

    const decremented = [];
    const placementAdjustments = [];

    for (const item of items) {
      let qty = item.quantity;
      let placed = null;
      let reduced = false;

      for (let attempt = 0; attempt < 4; attempt++) {
        placed = await Product.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: qty } },
          { $inc: { stock: -qty } },
          { new: true }
        );
        if (placed) break;

        const fresh = await Product.findById(item.productId);
        const available =
          fresh && fresh.status === "active"
            ? Math.max(0, Number(fresh.stock) || 0)
            : 0;

        if (available < 1) {
          qty = 0;
          break;
        }
        if (qty > available) {
          qty = available;
          if (!reduced) {
            reduced = true;
            placementAdjustments.push({
              productId: item.productId,
              name: item.name,
              requested: item.quantity,
              available,
              finalQuantity: qty,
              removed: false,
              reason: "reduced at placement",
            });
          }
        }
      }

      if (!placed || qty < 1) {
        placementAdjustments.push({
          productId: item.productId,
          name: item.name,
          requested: item.quantity,
          available: 0,
          finalQuantity: 0,
          removed: true,
          reason: "out of stock at placement",
        });
        continue;
      }

      decremented.push({ pid: item.productId, qty });
      item.quantity = qty;
    }

    const finalItems = items.filter((i) => Number(i.quantity) > 0);

    if (finalItems.length === 0) {
      // Everything is gone — restore anything already decremented (none in
      // practice) and give the customer an actionable message.
      await Promise.all(
        decremented.map((d) =>
          Product.updateOne({ _id: d.pid }, { $inc: { stock: d.qty } })
        )
      );
      return res.status(400).json({
        success: false,
        message:
          "The items in your order are out of stock. Please review your cart or choose something else.",
      });
    }

    // ---- Totals recomputed from the FINAL quantities ----

    const totals = await computeTotals(finalItems, couponCode);

    // ---- Payment must be completed for online methods ----

    const isOnlinePayment = String(paymentMethod || "") !== "Cash on Delivery";
    if (isOnlinePayment && !razorpayPaymentId) {
      return res.status(400).json({
        success: false,
        message: "Payment was not completed. Please try again.",
      });
    }

    // ---- Snapshot products for the order record (already clamped) ----

    const orderProducts = finalItems.map((item) => ({
      productId: item.productId,
      name: item.name,
      image: item.image,
      price: item.price,
      quantity: item.quantity,
    }));

    const allAdjustments = adjustments.concat(placementAdjustments);

    // ---- Consume the coupon (once per use) ----

    if (totals.couponCode) {
      await Coupon.updateOne(
        { code: totals.couponCode },
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
      subtotal: totals.subtotal,
      deliveryCharge: totals.deliveryCharge,
      tax: totals.tax,
      discount: totals.discount,
      couponCode: totals.couponCode,
      total: totals.total,
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
      adjustments: allAdjustments,
      adjusted: allAdjustments.length > 0,
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

// Cancel My Order (protected - owner only, Pending orders only)
const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;

    if (!isObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order id",
      });
    }

    const existing = await Order.findById(orderId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (String(existing.customerId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this order",
      });
    }

    if (existing.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "This order has already been cancelled",
      });
    }

    if (existing.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message:
          "This order can no longer be cancelled (it has already been " +
          existing.status.toLowerCase() +
          ")",
      });
    }

    // Atomic status flip — if the order moved past Pending between the
    // read above and here (e.g. admin started fulfilment), this matches
    // nothing and cancellation fails cleanly.
    const refundRequired = existing.paymentStatus === "Paid";
    const order = await Order.findOneAndUpdate(
      { _id: orderId, status: "Pending" },
      { $set: { status: "Cancelled", refundRequired } },
      { new: true }
    );

    if (!order) {
      return res.status(400).json({
        success: false,
        message: "This order can no longer be cancelled",
      });
    }

    // Restore the stock that was deducted when the order was placed
    // (reverse of the atomic decrement in placeOrder).
    if (order.products && order.products.length > 0) {
      await Promise.all(
        order.products.map((item) =>
          Product.updateOne(
            { _id: item.productId },
            { $inc: { stock: Number(item.quantity) || 0 } }
          )
        )
      );
    }

    // Notify the admin that a customer cancelled an order.
    const shortId = "#" + String(order._id).slice(-8).toUpperCase();
    await Notification.create({
      type: "order_cancelled",
      message: `Order ${shortId} was cancelled by ${order.customerName || "a customer"}`,
      orderId: order._id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order,
      refundRequired,
    });
  } catch (error) {
    console.error("[cancelOrder] error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
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
  preflightOrder,
  getMyOrders,
  getOrder,
  updateOrder,
  cancelOrder,
  deleteOrder,
};