const Coupon = require("../models/Coupon");

// Admin: list coupons
const getCoupons = async (req, res, next) => {
  try {
    const { search, isActive, page: pageQuery = "1", limit: limitQuery = "100" } = req.query;

    const page = Math.max(parseInt(pageQuery, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(limitQuery, 10) || 100, 1), 200);

    const query = {};
    if (search && search.trim()) {
      query.code = { $regex: search.trim(), $options: "i" };
    }
    if (isActive === "true" || isActive === "false") {
      query.isActive = isActive === "true";
    }

    const [coupons, total] = await Promise.all([
      Coupon.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Coupon.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      coupons,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: get single coupon
const getCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }
    res.status(200).json({ success: true, coupon });
  } catch (error) {
    next(error);
  }
};

// Admin: create coupon
const createCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      coupon,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Coupon code already exists",
      });
    }
    next(error);
  }
};

// Admin: update coupon
const updateCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    const fields = ["code", "discountType", "value", "minOrderValue", "expiryDate", "usageLimit", "isActive"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) coupon[f] = req.body[f];
    });

    await coupon.save();
    res.status(200).json({
      success: true,
      message: "Coupon updated successfully",
      coupon,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Coupon code already exists",
      });
    }
    next(error);
  }
};

// Admin: delete coupon
const deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }
    await coupon.deleteOne();
    res.status(200).json({ success: true, message: "Coupon deleted successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCoupons, getCoupon, createCoupon, updateCoupon, deleteCoupon };