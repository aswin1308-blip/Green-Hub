const Coupon = require("../models/Coupon");

// Validate a coupon code for the checkout page (public, read-only)
// Body: { code, amount } where amount is the subtotal (before discount)
const validateCoupon = async (req, res) => {
  try {
    const code = String((req.body && req.body.code) || "")
      .trim()
      .toUpperCase();
    const amount = Number((req.body && req.body.amount) || 0);

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Enter a coupon code",
      });
    }

    const coupon = await Coupon.findOne({ code });

    if (!coupon) {
      return res.status(404).json({
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

    if (amount < coupon.minOrderValue) {
      return res.status(400).json({
        success: false,
        message:
          "Minimum order value for this coupon is ₹" +
          Number(coupon.minOrderValue).toLocaleString("en-IN"),
      });
    }

    let discount = 0;
    if (coupon.discountType === "percentage") {
      discount = Math.round((amount * coupon.value) / 100);
    } else {
      discount = coupon.value;
    }
    discount = Math.min(discount, amount);

    res.status(200).json({
      success: true,
      code: coupon.code,
      discountType: coupon.discountType,
      value: coupon.value,
      discount,
      message: "Coupon applied successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { validateCoupon };
