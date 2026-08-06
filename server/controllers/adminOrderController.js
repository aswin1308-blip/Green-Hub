const Order = require("../models/Order");
const Product = require("../models/Product");

const buildOrderQuery = (req) => {
  const { status, from, to, customer, search } = req.query;
  const query = {};

  if (status) query.status = status;
  if (customer) query.customerId = customer;

  if (search) {
    const term = search.trim();
    const mongoId = /^[0-9a-fA-F]{24}$/.test(term) ? term : null;
    query.$or = [
      ...(mongoId ? [{ _id: mongoId }] : []),
      { customerName: { $regex: term, $options: "i" } },
      { customerEmail: { $regex: term, $options: "i" } },
    ];
  }

  if (from || to) {
    const dateFilter = {};
    if (from) {
      const start = new Date(`${from}T00:00:00`);
      if (!Number.isNaN(start.getTime())) dateFilter.$gte = start;
    }
    if (to) {
      const end = new Date(`${to}T23:59:59.999`);
      if (!Number.isNaN(end.getTime())) dateFilter.$lte = end;
    }
    if (Object.keys(dateFilter).length > 0) query.createdAt = dateFilter;
  }

  return query;
};

// Admin: list orders with filters + pagination
const getAdminOrders = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100
    );
    const query = buildOrderQuery(req);

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Order.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      orders,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: get a single order with full customer details
const getAdminOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: update order status
const updateOrderStatus = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot change status of a cancelled order",
      });
    }

    const wasNotCancelled = order.status !== "Cancelled";
    order.status = req.body.status;
    await order.save();

    // Restore stock exactly once when an order moves to Cancelled
    if (wasNotCancelled && order.status === "Cancelled") {
      await Promise.all(
        order.products.map((item) =>
          Product.updateOne(
            { _id: item.productId },
            { $inc: { stock: item.quantity } }
          )
        )
      );
    }

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminOrders,
  getAdminOrder,
  updateOrderStatus,
};