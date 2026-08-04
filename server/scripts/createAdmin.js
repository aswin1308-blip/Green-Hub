const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const name = process.env.ADMIN_NAME || "Admin User";
    const email = (process.env.ADMIN_EMAIL || "admin@greenhub.com").toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "";

    if (!password || password.length < 8) {
      console.error(
        "Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars) via environment variables."
      );
      return;
    }

    const existing = await User.findOne({ email });

    if (existing) {
      console.log(`Admin already exists: ${email} (role: ${existing.role})`);
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
    });

    console.log(`Admin created: ${name} <${email}>`);
  } catch (error) {
    console.error("Failed to create admin:", error.message);
  } finally {
    await mongoose.disconnect();
  }
};

run();