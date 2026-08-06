const Category = require("../models/Category");
const Product = require("../models/Product");
const slugify = require("../utils/slugify");
const imageUrl = require("../utils/imageUrl");
const { destroyImage } = require("../utils/cloudinary");

const NAV_GROUP_ORDER = [
  "Plants",
  "Pot Plants",
  "Bulbs & Seeds",
  "Planters",
  "Gardening Kit",
];

const toBool = (value) =>
  value === true || value === "true" || value === 1 || value === "1";

// Public: categories shown as circles in the homepage "Shop by Category"
const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ showOnHomepage: true }).sort({
      name: 1,
    });

    res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    next(error);
  }
};

// Public: categories shown in the navbar dropdowns, grouped by nav menu
const getNavCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ showInNavDropdown: true }).sort({
      navGroup: 1,
      name: 1,
    });

    const byGroup = {};
    categories.forEach((c) => {
      const group = c.navGroup || "Other";
      if (!byGroup[group]) byGroup[group] = [];
      byGroup[group].push(c);
    });

    const groups = [];
    NAV_GROUP_ORDER.forEach((g) => {
      if (byGroup[g]) {
        groups.push({ navGroup: g, categories: byGroup[g] });
        delete byGroup[g];
      }
    });
    Object.keys(byGroup)
      .sort()
      .forEach((g) => groups.push({ navGroup: g, categories: byGroup[g] }));

    res.status(200).json({
      success: true,
      count: categories.length,
      groups,
    });
  } catch (error) {
    next(error);
  }
};

// Public: every category (for products-page filter chips and search tags)
const getAllCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: create category
const createCategory = async (req, res, next) => {
  try {
    const { name, slug, description, image, navGroup } = req.body;

    const uploadedImage = req.file
      ? imageUrl(req.file)
      : undefined;

    const category = await Category.create({
      name,
      slug: slug || slugify(name),
      description,
      image: uploadedImage || image,
      showOnHomepage:
        req.body.showOnHomepage === undefined
          ? true
          : toBool(req.body.showOnHomepage),
      showInNavDropdown:
        req.body.showInNavDropdown === undefined
          ? false
          : toBool(req.body.showInNavDropdown),
      navGroup: navGroup ? String(navGroup).trim() : "",
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: update category
const updateCategory = async (req, res, next) => {
  try {
    const { name, slug, description, image, navGroup } = req.body;

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (req.file) {
      destroyImage(category.image);
      category.image = imageUrl(req.file);
    } else if (image !== undefined) {
      category.image = image;
    }
    if (name !== undefined) category.name = name;
    if (slug !== undefined) category.slug = slug;
    if (description !== undefined) category.description = description;
    if (req.body.showOnHomepage !== undefined) {
      category.showOnHomepage = toBool(req.body.showOnHomepage);
    }
    if (req.body.showInNavDropdown !== undefined) {
      category.showInNavDropdown = toBool(req.body.showInNavDropdown);
    }
    if (navGroup !== undefined) category.navGroup = String(navGroup).trim();

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: delete category (blocked if products reference it)
const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const productCount = await Product.countDocuments({ category: category._id });

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category: ${productCount} product(s) are assigned to it`,
      });
    }

    destroyImage(category.image);
    await category.deleteOne();

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  getNavCategories,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
