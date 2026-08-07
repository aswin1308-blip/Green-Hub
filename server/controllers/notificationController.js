const Notification = require("../models/Notification");
const mongoose = require("mongoose");

const isObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value) &&
  String(new mongoose.Types.ObjectId(value)) === value;

// Admin: list recent notifications + unread count
const getNotifications = async (req, res, next) => {
  try {
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      50
    );

    const [notifications, unreadCount] = await Promise.all([
      Notification.find().sort({ createdAt: -1 }).limit(limit),
      Notification.countDocuments({ isRead: false }),
    ]);

    res.status(200).json({
      success: true,
      unreadCount,
      notifications,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: mark a single notification as read
const markNotificationRead = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification id",
      });
    }

    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    const unreadCount = await Notification.countDocuments({ isRead: false });

    res.status(200).json({
      success: true,
      notification,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markNotificationRead,
};