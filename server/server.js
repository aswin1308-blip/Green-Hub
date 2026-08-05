const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

// MUST run before any require() that reads process.env
// (e.g. middleware/upload.js checks CLOUDINARY_* at load time)
dotenv.config();

const paymentRoutes = require("./routes/paymentRoutes");
const orderRoutes = require("./routes/orderRoutes");
const cartRoutes = require("./routes/cartRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const adminRoutes = require("./routes/adminRoutes");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");

connectDB();

const app = express();

app.use(cors());
app.use(express.json());
// Legacy: serve old locally-uploaded files still referenced by "/uploads/..."
// paths in the DB. New uploads go to Cloudinary (full https:// URLs) and
// never hit this route.
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);


// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payment", paymentRoutes);

app.get("/", (req, res) => {
  res.send("🌱 Green Hub Backend API is Running...");
});

const PORT = process.env.PORT || 5000;

const errorHandler = require("./middleware/errorMiddleware");

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});