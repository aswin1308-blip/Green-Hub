const cloudinary = require("cloudinary").v2;

/* Extracts the Cloudinary public_id from a stored URL.
   URL shape: https://res.cloudinary.com/<cloud>/image/upload/v<version>/<folder>/<publicId>.<ext>
   public_id returned is "<folder>/<publicId>" (no version, no extension).
   Returns null for non-Cloudinary URLs (legacy /uploads/... paths). */
const publicIdFromUrl = (url) => {
  if (typeof url !== "string" || !url) return null;
  if (!/^https:\/\/res\.cloudinary\.com\//i.test(url)) return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-z0-9]+$/i);
  return match ? match[1] : null;
};

/* Best-effort deletion of a Cloudinary asset. No-ops when:
   - publicId is null (non-Cloudinary / legacy local uploads)
   - Cloudinary isn't configured (local-disk fallback mode)
   Failures are logged but never thrown, so cleanup never breaks
   the surrounding delete/update operation. */
const destroyImage = async (urlOrPublicId) => {
  if (!urlOrPublicId) return;
  const publicId = publicIdFromUrl(urlOrPublicId) || urlOrPublicId;

  const cfg = cloudinary.config();
  if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) return;

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    if (result && result.result !== "ok" && result.result !== "not found") {
      console.warn(`[cloudinary] destroy returned "${result.result}" for ${publicId}`);
    }
  } catch (error) {
    console.error(`[cloudinary] failed to delete asset ${publicId}:`, error.message);
  }
};

module.exports = { publicIdFromUrl, destroyImage };
