const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  addToCart,
  getCart,
  updateCart,
  removeCart,
} = require("../controllers/cartController");

router.post("/add", protect, addToCart);

router.get("/", protect, getCart);

router.put("/:id", protect, updateCart);

router.delete("/:id", protect, removeCart);

module.exports = router;
