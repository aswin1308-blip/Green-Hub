require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const Category = require("../models/Category");

// Map each category to its navbar group. Groups must match the top-level
// nav items and NAV_GROUP_ORDER in server/controllers/categoryController.js
const MAPPING = {
  "Pot Plants": ["ADENIUM POT PLANTS", "BONSAI PLANTS"],
  "Bulbs & Seeds": ["SEEDS", "FRUITS PLANTS"],
  "Planters": ["POTS"],
  "Gardening Kit": ["FERTILIZERS"],
  "Plants": [
    "CROTON",
    "FLOWERING PLANT",
    "HERBALS",
    "HANGING AND CREEPERS",
    "INDOOR PLANTS",
    "OUTDOOR PLANTS",
    "TREEES",
  ],
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const all = await Category.find();
  const byName = {};
  all.forEach((c) => { byName[c.name] = c; });

  let tagged = 0;
  const errors = [];
  for (const [group, names] of Object.entries(MAPPING)) {
    for (const name of names) {
      const c = byName[name];
      if (!c) { errors.push(name); continue; }
      c.showInNavDropdown = true;
      c.navGroup = group;
      await c.save();
      tagged++;
      console.log(`tagged: ${name} -> ${group}`);
    }
  }

  // Safety: anything left untagged on purpose stays off
  if (errors.length) console.log("NOT FOUND:", errors.join(", "));
  console.log(`done: ${tagged} categories tagged`);
  await mongoose.disconnect();
})();
