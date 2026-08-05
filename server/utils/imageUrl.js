/* Returns the public URL for an uploaded file.
   - Cloudinary uploads (multer-storage-cloudinary): the full https://
     URL arrives on file.secure_url -> used as-is.
   - Legacy disk fallback (no Cloudinary creds in .env): file.filename
     is set -> build the old "/uploads/<filename>" form that the
     /uploads static route and the frontend understand. */
const imageUrl = (file) => {
  if (!file) return "";
  if (file.secure_url) return file.secure_url;
  if (/^https?:\/\//.test(file.path || "")) return file.path;
  if (file.filename) return `/uploads/${file.filename}`;
  return "";
};

module.exports = imageUrl;
