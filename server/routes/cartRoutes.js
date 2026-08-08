const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  addToCart,
  getCart,
  updateCart,
  removeCart,
  clearCart,
} = require("../controllers/cartController");

router.post("/add", protect, addToCart);

router.get("/", protect, getCart);

router.put("/:id", protect, updateCart);

// Must be registered BEFORE "/:id" or Express would treat "clear" as an id.
router.delete("/clear", protect, clearCart);

router.delete("/:id", protect, removeCart);

module.exports = router;
