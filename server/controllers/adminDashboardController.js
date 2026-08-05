const Order = require("../models/Order");
const Product = require("../models/Product");

const LOW_STOCK_THRESHOLD = 10;

const toDayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

// Admin: dashboard summary
const getSummary = async (req, res, next) => {
  try {
    const activeOrderQuery = { status: { $ne: "Cancelled" } };

    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const [salesAgg, totalOrders, lowStockCount, orderStats, salesByDay] =
      await Promise.all([
        Order.aggregate([
          { $match: activeOrderQuery },
          { $group: { _id: null, total: { $sum: "$total" } } },
        ]),
        Order.countDocuments(),
        Product.countDocuments({ stock: { $lte: LOW_STOCK_THRESHOLD } }),
        Order.aggregate([
          { $match: activeOrderQuery },
          { $unwind: "$products" },
          {
            $group: {
              _id: "$products.productId",
              totalQuantity: { $sum: "$products.quantity" },
              totalSales: {
                $sum: { $multiply: ["$products.quantity", "$products.price"] },
              },
            },
          },
          { $sort: { totalQuantity: -1, totalSales: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: "products",
              localField: "_id",
              foreignField: "_id",
              as: "product",
            },
          },
          { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        ]),
        Order.aggregate([
          {
            $match: {
              ...activeOrderQuery,
              createdAt: { $gte: start },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              total: { $sum: "$total" },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

    const totalSales = salesAgg.length > 0 ? salesAgg[0].total : 0;

    const salesMap = new Map(salesByDay.map((d) => [d._id, d.total]));
    const salesOverTime = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      salesOverTime.push({ date: toDayKey(day), total: salesMap.get(toDayKey(day)) || 0 });
    }

    const topProducts = orderStats.map((o) => ({
      _id: o._id,
      name: o.product?.name || "Deleted product",
      totalQuantity: o.totalQuantity,
      totalSales: o.totalSales,
    }));

    res.status(200).json({
      success: true,
      summary: {
        totalSales,
        totalOrders,
        lowStockCount,
        lowStockThreshold: LOW_STOCK_THRESHOLD,
        topProducts,
        salesOverTime,
        days,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSummary };