/* ==========================================
        GREEN HUB - SERVER RATE LIMITER
        Simple in-memory sliding-window limiter.
        Suits a single-process deployment (Render).
        Used to protect the forgot-password flow
        (email requests, code verification attempts).
========================================== */

const windows = new Map();

const cleanup = () => {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (now >= entry.resetAt) windows.delete(key);
    else if (entry.hits.length && entry.hits[0] <= now - entry.windowMs) {
      entry.hits = entry.hits.filter((t) => t > now - entry.windowMs);
      if (entry.hits.length === 0) windows.delete(key);
    }
  }
};

// Runs every minute to keep memory bounded.
setInterval(cleanup, 60 * 1000).unref();

/**
 * createRateLimiter({ windowMs, max, keyFn, message })
 * Returns an Express middleware. When the limit is exceeded it responds
 * 429 with a user-friendly message.
 */
const createRateLimiter = ({ windowMs, max, keyFn, message }) => {
  keyFn = keyFn || ((req) => req.ip);
  message =
    message ||
    "Too many requests. Please wait a while and try again.";

  return (req, res, next) => {
    const key = String(keyFn(req));
    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { windowMs, resetAt: now + windowMs, hits: [] };
      buckets.set(key, entry);
    }

    entry.hits = entry.hits.filter((t) => t > now - windowMs);

    if (entry.hits.length >= max) {
      return res.status(429).json({
        success: false,
        message,
      });
    }

    entry.hits.push(now);
    next();
  };
};

module.exports = { createRateLimiter };