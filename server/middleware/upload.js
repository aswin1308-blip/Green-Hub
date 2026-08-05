const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary");
const cloudinaryStorageFactory = require("multer-storage-cloudinary");

/* ----------------------------------------------------------------
   IMAGE UPLOADS — CLOUDINARY
   Uploaded product/category images go to Cloudinary and the returned
   full https:// URL is what gets stored in the database, so images are
   visible from any machine (server/uploads/ is gitignored and was only
   local). Old "/uploads/..." paths in the DB still resolve through the
   /uploads static route in server.js (legacy data).

   .env variables (server/.env) — the user must fill in real values:
     CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME_HERE
     CLOUDINARY_API_KEY=YOUR_API_KEY_HERE
     CLOUDINARY_API_SECRET=YOUR_API_SECRET_HERE
   Get them at https://cloudinary.com/console (Dashboard > Account
   Details). Until these are set, uploads fall back to local disk
   storage so development still works.
---------------------------------------------------------------- */

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

const cloudinaryReady = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

let storage;

if (cloudinaryReady) {
  storage = cloudinaryStorageFactory({
    cloudinary,
    params: {
      folder: "green-hub",
      allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
      transformation: [{ width: 1200, height: 1200, crop: "limit" }],
    },
  });
} else {
  console.warn(
    "[upload] CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET " +
      "are NOT set in server/.env - falling back to local disk storage " +
      "(server/uploads/, which is gitignored). Add the Cloudinary values " +
      "to server/.env to store images in the cloud."
  );

  const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, UPLOAD_DIR);
    },

    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  });
}

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 6,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error("Only image files (JPEG, PNG, WebP, GIF) are allowed");
      err.code = "UNSUPPORTED_FILE_TYPE";
      cb(err);
    }
  },
});

module.exports = upload;
