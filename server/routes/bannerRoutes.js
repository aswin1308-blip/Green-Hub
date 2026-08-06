const express = require("express");

const bannerController = require("../controllers/bannerController");

const router = express.Router();

// Public: active banners for the storefront hero carousel
router.get("/", bannerController.getActiveBanners);

module.exports = router;
