const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      minlength: [2, "Category name must be at least 2 characters"],
      maxlength: [80, "Category name cannot exceed 80 characters"],
    },

    slug: {
      type: String,
      required: [true, "Category slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must be lowercase with hyphens (e.g. vegetable-seeds)",
      ],
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    image: {
      type: String,
      default: "",
    },

    showOnHomepage: {
      type: Boolean,
      default: true,
    },

    showInNavDropdown: {
      type: Boolean,
      default: false,
    },

    navGroup: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Category", categorySchema);