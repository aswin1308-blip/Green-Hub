const express = require("express");
const router = express.Router();
const { validateCoupon } = require("../controllers/couponPublicController");

// Public coupon validation for the checkout page
router.post("/validate", validateCoupon);

module.exports = router;
