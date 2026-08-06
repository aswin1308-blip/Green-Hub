const Banner = require("../models/Banner");
const imageUrl = require("../utils/imageUrl");
const cloudinary = require("cloudinary").v2;

const toBool = (value) =>
  value === true || value === "true" || value === 1 || value === "1";

// Best-effort Cloudinary cleanup. No-ops when there is no publicId
// (e.g. local-disk fallback uploads when CLOUDINARY_* is not configured).
const destroyCloudinaryImage = (publicId) => {
  if (!publicId) return Promise.resolve();

  const cfg = cloudinary.config();
  if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) {
    return Promise.resolve();
  }

  return cloudinary.uploader.destroy(publicId).catch(() => {});
};

// Public: only active banners, ordered by display sequence
const getActiveBanners = async (req, res, next) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort({ order: 1 });

    res.status(200).json({
      success: true,
      count: banners.length,
      banners,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: all banners (active + inactive), ordered by display sequence
const getBanners = async (req, res, next) => {
  try {
    const banners = await Banner.find().sort({ order: 1 });

    res.status(200).json({
      success: true,
      count: banners.length,
      banners,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: create banner from an uploaded image
const createBanner = async (req, res, next) => {
  try {
    const { order, isActive } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Banner image is required",
      });
    }

    let bannerOrder = order;
    if (bannerOrder === undefined || bannerOrder === "") {
      const last = await Banner.findOne().sort({ order: -1 });
      bannerOrder = last ? last.order + 1 : 1;
    }

    const banner = await Banner.create({
      imageUrl: imageUrl(req.file),
      publicId: req.file.public_id || "",
      order: bannerOrder,
      isActive: isActive === undefined ? true : toBool(isActive),
    });

    res.status(201).json({
      success: true,
      message: "Banner created successfully",
      banner,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: toggle isActive and/or update order (optionally replace the image)
const updateBanner = async (req, res, next) => {
  try {
    const { order, isActive } = req.body;

    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    if (req.file) {
      await destroyCloudinaryImage(banner.publicId);
      banner.imageUrl = imageUrl(req.file);
      banner.publicId = req.file.public_id || "";
    }
    if (order !== undefined && order !== "") banner.order = order;
    if (isActive !== undefined) banner.isActive = toBool(isActive);

    await banner.save();

    res.status(200).json({
      success: true,
      message: "Banner updated successfully",
      banner,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: delete banner (also remove its image from Cloudinary)
const deleteBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    await destroyCloudinaryImage(banner.publicId);
    await banner.deleteOne();

    res.status(200).json({
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Admin: reorder banners (ids in desired order; order = index + 1)
const reorderBanners = async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "ids must be a non-empty array",
      });
    }

    await Promise.all(
      ids.map((id, index) =>
        Banner.updateOne({ _id: id }, { order: index + 1 })
      )
    );

    const banners = await Banner.find().sort({ order: 1 });

    res.status(200).json({
      success: true,
      message: "Banner order updated",
      banners,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActiveBanners,
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  reorderBanners,
};
