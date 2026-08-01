const express = require("express");
const router = express.Router();

const {
  addToCart,
  getCart,
  updateCart,
  removeCart,
} = require("../controllers/cartController");

router.post("/", addToCart);

router.get("/:userId", getCart);

router.put("/:id", updateCart);

router.delete("/:id", removeCart);

module.exports = router;