const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
} = require("../controllers/authController");

// Register User
router.post("/register", registerUser);

// Login User
router.post("/login", loginUser);

// Get Current User Profile (protected)
router.get("/me", protect, getProfile);

// Update Current User Profile (protected)
router.put("/me", protect, updateProfile);

module.exports = router;