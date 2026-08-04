const Product = require("../models/Product");
const Category = require("../models/Category");
const mongoose = require("mongoose");
const slugify = require("../utils/slugify");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value) &&
  String(new mongoose.Types.ObjectId(value)) === value;

const parseAttributes = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const uniqueSlug = async (base) => {
  let slug = slugify(base) || "product";
  let suffix = 1;
  while (await Product.findOne({ slug })) {
    const tail = String(suffix++);
    slug = `${slugify(base) || "product"}-${tail}`;
  }
  return slug;
};

const resolveCategoryId = async (value) => {
  if (!value) return null;

  if (isObjectId(value)) return new mongoose.Types.ObjectId(value);

  const category = await Category.findOne({ slug: value.toLowerCase() });
  return category ? category._id : null;
};

// Public: list products with filters + pagination
const getProducts = async (req, res, next) => {
  try {
    const {
      category,
      search,
      minPrice,
      maxPrice,
      status,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (category) {
      const categoryId = await resolveCategoryId(category);
      if (!categoryId) {
        return res.status(200).json({
          success: true,
          count: 0,
          total: 0,
          page: Number(page),
          pages: 0,
          products: [],
        });
      }
      filter.category = categoryId;
    }

    if (search) {
      const keyword = escapeRegex(search.trim());
      filter.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
      ];
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
      if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
    }

    if (status !== undefined) filter.status = status;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * pageSize;

    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate("category", "name slug")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
    ]);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / pageSize) || 0,
      products,
    });
  } catch (error) {
    next(error);
  }
};

// Public: get single product (by id or slug)
const getProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = isObjectId(id)
      ? { _id: id }
      : { slug: id.toLowerCase() };

    const product = await Product.findOne(query).populate(
      "category",
      "name slug"
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: create product (supports multi-image upload)
const createProduct = async (req, res, next) => {
  try {
    const { name, slug, category, attributes } = req.body;
    const price = Number(req.body.price);
    const discountPrice = req.body.discountPrice === undefined ? 0 : Number(req.body.discountPrice);
    const stock = req.body.stock === undefined ? 0 : Number(req.body.stock);
    const status = req.body.status || "active";

    const categoryId = await resolveCategoryId(category);

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: "Category not found",
      });
    }

    const uploadedImages = (req.files || []).map(
      (file) => `/uploads/${file.filename}`
    );
    const bodyImages = Array.isArray(req.body.images)
      ? req.body.images
      : typeof req.body.images === "string"
      ? [req.body.images]
      : [];
    const cleanBodyImages = bodyImages.filter((img) => typeof img === "string" && img.trim() !== "");

    const product = await Product.create({
      name,
      slug: slug || (await uniqueSlug(name)),
      description: req.body.description,
      category: categoryId,
      price,
      discountPrice,
      stock,
      images: [...cleanBodyImages, ...uploadedImages],
      status,
      attributes: parseAttributes(attributes),
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: update product
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate("category", "name slug");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const { name, slug, category, attributes } = req.body;

    if (name !== undefined) {
      product.name = name;
      if (slug === undefined) product.slug = await uniqueSlug(name);
    }
    if (slug !== undefined) product.slug = slug;
    if (req.body.description !== undefined) product.description = req.body.description;
    if (req.body.price !== undefined) product.price = Number(req.body.price);
    if (req.body.discountPrice !== undefined) product.discountPrice = Number(req.body.discountPrice);
    if (req.body.stock !== undefined) product.stock = Number(req.body.stock);
    if (req.body.status !== undefined) product.status = req.body.status;
    if (attributes !== undefined) product.attributes = parseAttributes(attributes);

    if (category !== undefined) {
      const categoryId = await resolveCategoryId(category);
      if (!categoryId) {
        return res.status(400).json({
          success: false,
          message: "Category not found",
        });
      }
      product.category = categoryId;
    }

    const uploadedImages = (req.files || []).map(
      (file) => `/uploads/${file.filename}`
    );
    const hasImagesField = Object.prototype.hasOwnProperty.call(req.body, "images");
    const rawImages = req.body.images;
    const desiredImages = Array.isArray(rawImages)
      ? rawImages
      : rawImages == null
      ? []
      : [rawImages];
    const cleanDesiredImages = desiredImages.filter(
      (img) => typeof img === "string" && img.trim() !== ""
    );

    if (hasImagesField) {
      product.images = [...cleanDesiredImages, ...uploadedImages];
    } else if (uploadedImages.length > 0) {
      product.images = [...product.images, ...uploadedImages];
    }

    await product.save();

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: delete product
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Admin: quick stock update
const updateStock = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    product.stock = Number(req.body.stock);

    await product.save();

    res.status(200).json({
      success: true,
      message: "Stock updated successfully",
      product: {
        _id: product._id,
        name: product.name,
        stock: product.stock,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
};