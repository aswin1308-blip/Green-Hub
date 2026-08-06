const express = require("express");
const { body, check } = require("express-validator");

const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");
const upload = require("../middleware/upload");
const validate = require("../middleware/validate");

const categoryController = require("../controllers/categoryController");
const productController = require("../controllers/productController");
const adminOrderController = require("../controllers/adminOrderController");
const adminCustomerController = require("../controllers/adminCustomerController");
const adminDashboardController = require("../controllers/adminDashboardController");
const couponController = require("../controllers/couponController");
const bannerController = require("../controllers/bannerController");

const router = express.Router();

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

router.use(protect);
router.use(adminOnly);

// ---- Categories ----
const NAV_GROUPS = ["Plants", "Pot Plants", "Bulbs & Seeds", "Planters", "Gardening Kit"];

const categoryVisibilityRules = [
  body("showOnHomepage").optional().isBoolean()
    .withMessage("showOnHomepage must be a boolean"),
  body("showInNavDropdown").optional().isBoolean()
    .withMessage("showInNavDropdown must be a boolean"),
  body("navGroup").optional().trim().custom((value) => {
    if (value !== "" && !NAV_GROUPS.includes(value)) {
      throw new Error(`navGroup must be one of: ${NAV_GROUPS.join(", ")}`);
    }
    return true;
  }),
];

router.get("/categories", categoryController.getAllCategories);

router.post(
  "/categories",
  upload.single("image"),
  [
    body("name").trim().notEmpty().withMessage("Category name is required")
      .isLength({ min: 2, max: 80 }).withMessage("Name must be 2-80 characters"),
    body("slug").optional().trim().matches(slugPattern)
      .withMessage("Slug must be lowercase with hyphens"),
    body("description").optional().isString(),
    body("image").optional().isString(),
  ].concat(categoryVisibilityRules),
  validate,
  categoryController.createCategory
);

router.put(
  "/categories/:id",
  upload.single("image"),
  [
    check("id").isMongoId().withMessage("Invalid category id"),
    body("name").optional().trim().notEmpty()
      .withMessage("Name cannot be empty").isLength({ max: 80 }),
    body("slug").optional().trim().matches(slugPattern)
      .withMessage("Slug must be lowercase with hyphens"),
    body("description").optional().isString(),
    body("image").optional().isString(),
  ].concat(categoryVisibilityRules),
  validate,
  categoryController.updateCategory
);

router.delete(
  "/categories/:id",
  [check("id").isMongoId().withMessage("Invalid category id")],
  validate,
  categoryController.deleteCategory
);

// ---- Products ----
const productCreateRules = [
  body("name").trim().notEmpty().withMessage("Product name is required")
    .isLength({ max: 120 }).withMessage("Name cannot exceed 120 characters"),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("category").notEmpty().withMessage("Category is required"),
  body("price").exists({ checkFalsy: false }).withMessage("Price is required")
    .toFloat().isFloat({ min: 0 }).withMessage("Price must be 0 or greater"),
  body("discountPrice").optional().toFloat().isFloat({ min: 0 })
    .withMessage("Discount price must be 0 or greater"),
  body("stock").optional().toInt().isInt({ min: 0 })
    .withMessage("Stock must be 0 or greater"),
  body("status").optional().isIn(["active", "inactive"])
    .withMessage("Status must be active or inactive"),
  body("slug").optional().trim().matches(slugPattern),
];

const productUpdateRules = [
  check("id").isMongoId().withMessage("Invalid product id"),
  body("name").optional().trim().notEmpty().isLength({ max: 120 }),
  body("description").optional().trim().notEmpty(),
  body("category").optional().notEmpty(),
  body("price").optional().toFloat().isFloat({ min: 0 }),
  body("discountPrice").optional().toFloat().isFloat({ min: 0 }),
  body("stock").optional().toInt().isInt({ min: 0 }),
  body("status").optional().isIn(["active", "inactive"]),
  body("slug").optional().trim().matches(slugPattern),
];

router.get("/products", productController.getAdminProducts);

router.post(
  "/products",
  upload.array("images", 6),
  productCreateRules,
  validate,
  productController.createProduct
);

router.put(
  "/products/:id",
  upload.array("images", 6),
  productUpdateRules,
  validate,
  productController.updateProduct
);

router.delete(
  "/products/:id",
  [check("id").isMongoId().withMessage("Invalid product id")],
  validate,
  productController.deleteProduct
);

router.patch(
  "/products/:id/stock",
  [
    check("id").isMongoId().withMessage("Invalid product id"),
    body("stock").exists().withMessage("Stock is required")
      .toInt().isInt({ min: 0 }).withMessage("Stock must be 0 or greater"),
  ],
  validate,
  productController.updateStock
);

// ---- Orders ----
router.get("/orders", adminOrderController.getAdminOrders);

router.get(
  "/orders/:id",
  [check("id").isMongoId().withMessage("Invalid order id")],
  validate,
  adminOrderController.getAdminOrder
);

router.patch(
  "/orders/:id/status",
  [
    check("id").isMongoId().withMessage("Invalid order id"),
    body("status").exists().withMessage("Status is required")
      .isIn(["Pending", "Processing", "Shipped", "Delivered", "Cancelled"])
      .withMessage("Status must be Pending, Processing, Shipped, Delivered or Cancelled"),
  ],
  validate,
  adminOrderController.updateOrderStatus
);

// ---- Customers ----
router.get("/customers", adminCustomerController.getCustomers);

router.patch(
  "/customers/:id",
  [
    check("id").isMongoId().withMessage("Invalid customer id"),
    body("blocked").exists().withMessage("blocked is required")
      .isBoolean().withMessage("blocked must be a boolean"),
  ],
  validate,
  adminCustomerController.toggleCustomerBlock
);

// ---- Dashboard ----
router.get("/dashboard/summary", adminDashboardController.getSummary);

// ---- Coupons ----
const couponCreateRules = [
  body("code").trim().notEmpty().withMessage("Coupon code is required")
    .isLength({ min: 3, max: 30 }).withMessage("Code must be 3-30 characters"),
  body("discountType").isIn(["percentage", "flat"])
    .withMessage("Discount type must be percentage or flat"),
  body("value").exists({ checkFalsy: false }).withMessage("Discount value is required")
    .toFloat().isFloat({ min: 0 }).withMessage("Value must be 0 or greater"),
  body("minOrderValue").optional().toFloat().isFloat({ min: 0 })
    .withMessage("Minimum order value must be 0 or greater"),
  body("expiryDate").optional().isISO8601().withMessage("Expiry must be a valid date"),
  body("usageLimit").optional().toInt().isInt({ min: 0 })
    .withMessage("Usage limit must be 0 or greater"),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
];

const couponUpdateRules = [
  check("id").isMongoId().withMessage("Invalid coupon id"),
  body("code").optional().trim().notEmpty()
    .withMessage("Code cannot be empty").isLength({ min: 3, max: 30 }),
  body("discountType").optional().isIn(["percentage", "flat"])
    .withMessage("Discount type must be percentage or flat"),
  body("value").optional().toFloat().isFloat({ min: 0 })
    .withMessage("Value must be 0 or greater"),
  body("minOrderValue").optional().toFloat().isFloat({ min: 0 }),
  body("expiryDate").optional().isISO8601().withMessage("Expiry must be a valid date"),
  body("usageLimit").optional().toInt().isInt({ min: 0 }),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
];

router.get("/coupons", couponController.getCoupons);

router.get(
  "/coupons/:id",
  [check("id").isMongoId().withMessage("Invalid coupon id")],
  validate,
  couponController.getCoupon
);

router.post("/coupons", couponCreateRules, validate, couponController.createCoupon);

router.put(
  "/coupons/:id",
  couponUpdateRules,
  validate,
  couponController.updateCoupon
);

router.delete(
  "/coupons/:id",
  [check("id").isMongoId().withMessage("Invalid coupon id")],
  validate,
  couponController.deleteCoupon
);

// ---- Banners ----
router.get("/banners", bannerController.getBanners);

router.post(
  "/banners",
  upload.single("image"),
  [
    body("order").optional().toInt().isInt({ min: 0 })
      .withMessage("Order must be 0 or greater"),
    body("isActive").optional().isBoolean()
      .withMessage("isActive must be a boolean"),
  ],
  validate,
  bannerController.createBanner
);

// NOTE: must be registered before PATCH /banners/:id so "reorder"
// is not matched as an id.
router.patch(
  "/banners/reorder",
  [body("ids").isArray().withMessage("ids must be an array")],
  validate,
  bannerController.reorderBanners
);

router.patch(
  "/banners/:id",
  upload.single("image"),
  [
    check("id").isMongoId().withMessage("Invalid banner id"),
    body("order").optional().toInt().isInt({ min: 0 })
      .withMessage("Order must be 0 or greater"),
    body("isActive").optional().isBoolean()
      .withMessage("isActive must be a boolean"),
  ],
  validate,
  bannerController.updateBanner
);

router.delete(
  "/banners/:id",
  [check("id").isMongoId().withMessage("Invalid banner id")],
  validate,
  bannerController.deleteBanner
);

module.exports = router;
