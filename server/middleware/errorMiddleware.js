const multer = require("multer");
const mongoose = require("mongoose");

const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || "Internal Server Error";
  let errors;

  if (err instanceof multer.MulterError) {
    status = 400;
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File too large. Maximum size is 5MB per image.";
    } else if (err.code === "LIMIT_FILE_COUNT") {
      message = "Too many files. Maximum 6 images allowed.";
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      message = "Unexpected file field. Use the field name 'images'.";
    } else {
      message = err.message;
    }
  } else if (err.code === "UNSUPPORTED_FILE_TYPE") {
    status = 400;
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = "Invalid id format";
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    message = "Validation failed";
  } else if (err.code === 11000) {
    status = 400;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `${field} already exists`;
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Invalid JSON in request body";
  }

  res.status(status).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  });
};

module.exports = errorHandler;