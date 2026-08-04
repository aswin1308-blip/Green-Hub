const User = require("../models/User");
const Order = require("../models/Order");

// Admin: list customers with search + pagination + order counts
const getCustomers = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100
    );
    const { search } = req.query;

    const query = { role: "customer" };
    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(query),
    ]);

    const orderCounts = await Order.aggregate([
      { $group: { _id: "$user", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(orderCounts.map((o) => [String(o._id), o.count]));

    const customers = users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      address: u.address,
      isBlocked: u.isBlocked,
      createdAt: u.createdAt,
      orderCount: countMap.get(String(u._id)) || 0,
    }));

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      customers,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: block / unblock a customer
const toggleCustomerBlock = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "admin") {
      return res.status(400).json({
        success: false,
        message: "Cannot block an admin account",
      });
    }

    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot block your own account",
      });
    }

    user.isBlocked = req.body.blocked;
    await user.save();

    res.status(200).json({
      success: true,
      message: user.isBlocked ? "Customer blocked" : "Customer unblocked",
      customer: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isBlocked: user.isBlocked,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomers,
  toggleCustomerBlock,
};
