const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");
const express = require("express");
const router = express.Router();

const {
    addProduct,
    getProducts,
    searchProducts,
    getProduct,
    updateProduct,
    deleteProduct
} = require("../controllers/productController");

router.post("/", protect, adminOnly, addProduct);

router.get("/", getProducts);

router.get("/search", searchProducts);

router.get("/:id", getProduct);

router.put("/:id", protect, adminOnly, updateProduct);

router.delete("/:id", protect, adminOnly, deleteProduct);
module.exports = router;