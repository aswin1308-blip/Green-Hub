const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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
};