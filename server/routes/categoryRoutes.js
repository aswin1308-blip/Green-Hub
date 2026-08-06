const express = require("express");
const router = express.Router();

const {
  getCategories,
  getNavCategories,
  getAllCategories,
} = require("../controllers/categoryController");

// Public: categories grouped for the navbar dropdowns
router.get("/nav", getNavCategories);

// Public: all categories (products-page filters, search tags)
router.get("/all", getAllCategories);

// Public: homepage "Shop by Category" circles (showOnHomepage only)
router.get("/", getCategories);

module.exports = router;
