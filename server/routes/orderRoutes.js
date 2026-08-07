const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  placeOrder,
  preflightOrder,
  getMyOrders,
  getOrder,
  updateOrder,
  cancelOrder,
  deleteOrder,
} = require("../controllers/orderController");

router.post("/preflight", protect, preflightOrder);

router.post("/", protect, placeOrder);

router.get("/mine", protect, getMyOrders);

router.get("/:id", protect, getOrder);

router.put("/:id", protect, updateOrder);

router.patch("/:id/cancel", protect, cancelOrder);

router.delete("/:id", protect, deleteOrder);

module.exports = router;