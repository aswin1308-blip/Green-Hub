const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendPasswordResetCode } = require("../utils/email");

const RESET_CODE_TTL = 10 * 60 * 1000; // 10 minutes
const RESET_MAX_ATTEMPTS = 5; // failed verification attempts before lockout
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds between emails

const generateToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  address: user.address,
  role: user.role,
});

// Register User (default role: customer)
const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      phone,
      address,
    });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

    console.error("[register] error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

// Login User
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked. Please contact support.",
      });
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("[login] error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

/* ==========================================
        FORGOT PASSWORD FLOW
        - requestPasswordReset: email -> sends 6-digit code
        - verifyResetCode:      email + code -> unlocks password change
        - resetPassword:        email + code + new password -> saves
========================================== */

// In-memory 60s resend cooldown tracker (email -> last sent timestamp).
const lastCodeSentAt = new Map();

const emailOf = (value) => String(value || "").trim().toLowerCase();

// Generates a cryptographically secure 6-digit code, stores ONLY its bcrypt
// hash with an expiry, and returns the raw code (for the email body).
const generateAndStoreResetCode = async (user) => {
  const code = String(crypto.randomInt(100000, 1000000)); // 6 digits
  user.resetCodeHash = await bcrypt.hash(code, 10);
  user.resetCodeExpires = new Date(Date.now() + RESET_CODE_TTL);
  user.resetCodeAttempts = 0;
  user.resetCodeVerifiedAt = null;
  await user.save();
  return code;
};

const clearResetCode = async (user) => {
  user.resetCodeHash = "";
  user.resetCodeExpires = null;
  user.resetCodeAttempts = 0;
  user.resetCodeVerifiedAt = null;
  await user.save();
};

const GENERIC_RESPONSE = {
  success: true,
  message:
    "If an account exists with this email, a verification code has been sent.",
};

// STEP 1 — POST /api/auth/forgot-password  { email }
const requestPasswordReset = async (req, res) => {
  try {
    const email = emailOf(req.body.email);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    // Resend cooldown — also applied for unknown emails so the endpoint
    // cannot be used to probe which emails are registered.
    const lastSent = lastCodeSentAt.get(email) || 0;
    const waitMs = RESEND_COOLDOWN_MS - (Date.now() - lastSent);
    if (waitMs > 0) {
      return res.status(429).json({
        success: false,
        message:
          "Please wait " + Math.ceil(waitMs / 1000) +
          " seconds before requesting a new code.",
      });
    }
    lastCodeSentAt.set(email, Date.now());

    // Keep the response identical whether or not the account exists
    // (anti-enumeration). The dummy hash keeps timing similar too.
    const user = await User.findOne({ email });

    if (!user) {
      await bcrypt.hash(String(Date.now() % 1000000), 10);
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
      return res.status(200).json(GENERIC_RESPONSE);
    }

    const code = await generateAndStoreResetCode(user);

    let previewUrl = null;
    try {
      const sent = await sendPasswordResetCode(user.email, code);
      previewUrl = sent.previewUrl || null;
    } catch (error) {
      console.error("[forgot-password] email send failed:", error);
      return res.status(500).json({
        success: false,
        message: "Something went wrong. Please try again.",
      });
    }

    // Dev convenience: EMAIL_TRANSPORT=ethereal returns a preview URL so the
    // email can be inspected locally. Never enabled with real SMTP.
    const isEthereal = String(process.env.EMAIL_TRANSPORT || "smtp").toLowerCase() === "ethereal";

    res.status(200).json(isEthereal && previewUrl
      ? { ...GENERIC_RESPONSE, previewUrl }
      : GENERIC_RESPONSE);
  } catch (error) {
    console.error("[forgot-password] error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

// STEP 2 — POST /api/auth/verify-reset-code  { email, code }
const verifyResetCode = async (req, res) => {
  try {
    const email = emailOf(req.body.email);
    const code = String(req.body.code || "").trim();

    if (!/^[0-9]{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code.",
      });
    }

    const user = await User.findOne({ email });

    if (!user || !user.resetCodeHash) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code.",
      });
    }

    if (user.resetCodeVerifiedAt) {
      // Already verified — no need to verify again.
      return res.status(200).json({
        success: true,
        message: "Code verified successfully.",
      });
    }

    if (user.resetCodeExpires && Date.now() > new Date(user.resetCodeExpires).getTime()) {
      await clearResetCode(user);
      return res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new code.",
      });
    }

    if (user.resetCodeAttempts >= RESET_MAX_ATTEMPTS) {
      await clearResetCode(user);
      return res.status(400).json({
        success: false,
        message: "Too many incorrect attempts. Please request a new code.",
      });
    }

    const isValid = await bcrypt.compare(code, user.resetCodeHash);

    if (!isValid) {
      user.resetCodeAttempts += 1;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "Invalid verification code.",
      });
    }

    user.resetCodeAttempts = 0;
    user.resetCodeVerifiedAt = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: "Code verified successfully.",
    });
  } catch (error) {
    console.error("[verify-reset-code] error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

// STEP 3 — POST /api/auth/reset-password  { email, code, password }
const resetPassword = async (req, res) => {
  try {
    const email = emailOf(req.body.email);
    const code = String(req.body.code || "").trim();
    const password = String(req.body.password || "");

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const user = await User.findOne({ email });

    if (!user || !user.resetCodeHash) {
      // No pending reset request — same wording as other failures so the
      // endpoint never reveals whether an email is registered.
      return res.status(400).json({
        success: false,
        message: "Invalid verification code.",
      });
    }

    // After successful verification, the code no longer needs to be
    // re-submitted. If it was never verified (or it expired), the code must
    // still be correct.
    if (!user.resetCodeVerifiedAt) {
      if (user.resetCodeExpires && Date.now() > new Date(user.resetCodeExpires).getTime()) {
        await clearResetCode(user);
        return res.status(400).json({
          success: false,
          message: "Verification code has expired. Please request a new code.",
        });
      }

      if (user.resetCodeAttempts >= RESET_MAX_ATTEMPTS) {
        await clearResetCode(user);
        return res.status(400).json({
          success: false,
          message: "Too many incorrect attempts. Please request a new code.",
        });
      }

      if (!/^[0-9]{6}$/.test(code)) {
        return res.status(400).json({
          success: false,
          message: "Invalid verification code.",
        });
      }

      const isValid = await bcrypt.compare(code, user.resetCodeHash);

      if (!isValid) {
        user.resetCodeAttempts += 1;
        await user.save();
        return res.status(400).json({
          success: false,
          message: "Invalid verification code.",
        });
      }
    } else if (user.resetCodeExpires && Date.now() > new Date(user.resetCodeExpires).getTime()) {
      await clearResetCode(user);
      return res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new code.",
      });
    }

    // Hash the new password using the same bcrypt system as registration.
    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    await clearResetCode(user);
    lastCodeSentAt.delete(email);

    res.status(200).json({
      success: true,
      message: "Password reset successfully!",
    });
  } catch (error) {
    console.error("[reset-password] error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

// Get Current User Profile (protected)
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("[getProfile] error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

// Update Current User Profile (protected)
const updateProfile = async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;

    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (typeof name === "string" && name.trim() !== "") {
      user.name = name.trim();
    }

    if (typeof email === "string" && email.trim() !== "") {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const existing = await User.findOne({ email: normalizedEmail });
        if (existing && String(existing._id) !== String(user._id)) {
          return res.status(400).json({
            success: false,
            message: "A user with this email already exists",
          });
        }
        user.email = normalizedEmail;
      }
    }

    if (typeof phone === "string") user.phone = phone.trim();
    if (typeof address === "string") user.address = address.trim();

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile Updated Successfully",
      user: sanitizeUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

    console.error("[updateProfile] error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  requestPasswordReset,
  verifyResetCode,
  resetPassword,
};
