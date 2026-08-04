const Order = require("../models/Order");

const buildOrderQuery = (req) => {
  const { status, from, to, customer, search } = req.query;
  const query = {};

  if (status) query.orderStatus = status;
  if (customer) query.user = customer;

  if (search) {
    const mongoId = /^[0-9a-fA-F]{24}$/.test(search) ? search : null;
    const [firstName = "", lastName = ""] = search.trim().split(/\s+/);
    query.$or = [
      ...(mongoId ? [{ _id: mongoId }] : []),
      {
        "user.name": {
          $regex: search.trim(),
          $options: "i",
        },
      },
      ...(firstName && lastName
        ? [
            {
              $and: [
                { "user.name": { $regex: firstName, $options: "i" } },
                { "user.name": { $regex: lastName, $options: "i" } },
              ],
            },
          ]
        : []),
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
      Order.find(query)
        .populate("user", "name email phone")
        .populate("items.product", "name images price")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
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

// Admin: get a single order with populated details
const getAdminOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "name email phone")
      .populate("items.product", "name images price");

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

    if (order.orderStatus === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot change status of a cancelled order",
      });
    }

    order.orderStatus = req.body.status;
    await order.save();

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
