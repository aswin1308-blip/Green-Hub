const express = require("express");
const router = express.Router();
const { body } = require("express-validator");

const protect = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");

const {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
} = require("../controllers/authController");

const NAME_RULE = body("name")
  .optional()
  .trim()
  .isLength({ min: 2, max: 80 })
  .withMessage("Name must be between 2 and 80 characters");

const EMAIL_RULE = body("email")
  .trim()
  .toLowerCase()
  .isEmail()
  .withMessage("Please enter a valid email address");

const PASSWORD_RULE = body("password")
  .isLength({ min: 6 })
  .withMessage("Password must be at least 6 characters");

const PHONE_RULE = body("phone")
  .optional({ values: "falsy" })
  .trim()
  .matches(/^[0-9]{10}$/)
  .withMessage("Phone number must be 10 digits");

// Register User
router.post(
  "/register",
  body("name")
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage("Name must be between 2 and 80 characters"),
  EMAIL_RULE,
  PASSWORD_RULE,
  PHONE_RULE,
  validate,
  registerUser
);

// Login User
router.post(
  "/login",
  EMAIL_RULE,
  body("password").notEmpty().withMessage("Password is required"),
  validate,
  loginUser
);

// Get Current User Profile (protected)
router.get("/me", protect, getProfile);

// Update Current User Profile (protected)
router.put("/me", protect, NAME_RULE, EMAIL_RULE, PHONE_RULE, validate, updateProfile);

module.exports = router;