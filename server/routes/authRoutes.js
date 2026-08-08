const express = require("express");
const router = express.Router();
const { body } = require("express-validator");

const protect = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const { createRateLimiter } = require("../utils/rateLimit");

const {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  requestPasswordReset,
  verifyResetCode,
  resetPassword,
} = require("../controllers/authController");

// Forgot-password abuse protection (in-memory, per instance).
const forgotPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // per email+IP in the window (emails are throttled to 1/min anyway)
  keyFn: (req) =>
    String((req.body && req.body.email) || "").trim().toLowerCase() +
    "|" +
    (req.ip || "unknown"),
  message: "Too many requests. Please try again in a few minutes.",
});

const forgotPasswordIpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyFn: (req) => "ip:" + (req.headers["x-forwarded-for"]
    ? String(req.headers["x-forwarded-for"]).split(",")[0].trim()
    : req.ip || "unknown"),
  message: "Too many requests. Please try again in a few minutes.",
});

const verifyResetLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) =>
    String((req.body && req.body.email) || "").trim().toLowerCase() +
    "|" +
    (req.ip || "unknown"),
  message: "Too many attempts. Please request a new code and try again later.",
});

const resetPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) =>
    String((req.body && req.body.email) || "").trim().toLowerCase() +
    "|" +
    (req.ip || "unknown"),
  message: "Too many attempts. Please try again later.",
});

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

// Forgot Password
router.post(
  "/forgot-password",
  forgotPasswordIpLimiter,
  forgotPasswordLimiter,
  EMAIL_RULE,
  validate,
  requestPasswordReset
);

// Verify Reset Code
router.post(
  "/verify-reset-code",
  verifyResetLimiter,
  EMAIL_RULE,
  body("code")
    .trim()
    .matches(/^[0-9]{6}$/)
    .withMessage("Verification code must be 6 digits"),
  validate,
  verifyResetCode
);

// Reset Password
router.post(
  "/reset-password",
  resetPasswordLimiter,
  EMAIL_RULE,
  body("code").optional().trim(),
  PASSWORD_RULE,
  validate,
  resetPassword
);

module.exports = router;