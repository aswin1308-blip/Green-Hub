const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  placeOrder,
  getMyOrders,
  getOrder,
  updateOrder,
  deleteOrder,
} = require("../controllers/orderController");

router.post("/", protect, placeOrder);

router.get("/mine", protect, getMyOrders);

router.get("/", protect, getMyOrders);

router.get("/:id", protect, getOrder);

router.put("/:id", protect, updateOrder);

router.delete("/:id", protect, deleteOrder);

module.exports = router;