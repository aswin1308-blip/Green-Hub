require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

// One-time backfill: showOnHomepage: true on all categories that do NOT
// have the field explicitly set to false (missing field -> treated as true,
// preserving pre-flag behavior; explicit false stays hidden).
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
    });
    const Category = mongoose.model(
      "Category",
      require("../models/Category").schema
    );

    const missing = await Category.countDocuments({
      showOnHomepage: { $ne: true, $exists: true },
    });

    const toBackfill = await Category.find({
      showOnHomepage: { $ne: false },
    });

    console.log(
      "Categories with showOnHomepage explicitly false (skipped):",
      missing
    );

    if (!toBackfill.length) {
      console.log("Nothing to backfill. Exiting.");
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log("Categories to backfill to showOnHomepage: true:");
    toBackfill.forEach((c) => console.log(`  - ${c.name}`));

    const result = await Category.updateMany(
      { showOnHomepage: { $ne: false } },
      { $set: { showOnHomepage: true } }
    );

    console.log(
      `\nUpdated ${result.modifiedCount} category document(s).`
    );

    const nowTrue = await Category.countDocuments({ showOnHomepage: true });
    const nowFalse = await Category.countDocuments({ showOnHomepage: false });
    const total = await Category.countDocuments();
    console.log(
      `After: ${nowTrue} showOnHomepage:true, ${nowFalse} showOnHomepage:false, ${total} total`
    );

    await mongoose.disconnect();
  } catch (err) {
    console.error("ERROR:", err.message);
    process.exit(1);
  }
})();
