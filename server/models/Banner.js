const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: [true, "Banner image is required"],
      trim: true,
    },

    publicId: {
      type: String,
      default: "",
      trim: true,
    },

    order: {
      type: Number,
      default: 1,
      min: [0, "Order cannot be negative"],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Banner", bannerSchema);
