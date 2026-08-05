const Category = require("../models/Category");
const Product = require("../models/Product");
const slugify = require("../utils/slugify");
const imageUrl = require("../utils/imageUrl");

// Public: list all categories
const getCategories = async (req, res, next) => {
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
    const { name, slug, description, image } = req.body;

    const uploadedImage = req.file
      ? imageUrl(req.file)
      : undefined;

    const category = await Category.create({
      name,
      slug: slug || slugify(name),
      description,
      image: uploadedImage || image,
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
    const { name, slug, description, image } = req.body;

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (req.file) {
      category.image = imageUrl(req.file);
    } else if (image !== undefined) {
      category.image = image;
    }
    if (name !== undefined) category.name = name;
    if (slug !== undefined) category.slug = slug;
    if (description !== undefined) category.description = description;

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
  createCategory,
  updateCategory,
  deleteCategory,
};