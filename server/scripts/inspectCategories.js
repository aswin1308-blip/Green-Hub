require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
    });
    const db = mongoose.connection.db;
    const categories = await db.collection("categories").find({}).toArray();

    console.log("Total categories:", categories.length);
    console.log("----------------------------------------");

    const hasField = (doc) => Object.prototype.hasOwnProperty.call(doc, "showOnHomepage");

    const missing = categories.filter((c) => !hasField(c));
    const explicitlyTrue = categories.filter((c) => c.showOnHomepage === true);
    const explicitlyFalse = categories.filter((c) => c.showOnHomepage === false);
    const wrongType = categories.filter(
      (c) => hasField(c) && typeof c.showOnHomepage !== "boolean"
    );

    console.log("With showOnHomepage field   :", categories.length - missing.length);
    console.log("  - === true                :", explicitlyTrue.length);
    console.log("  - === false               :", explicitlyFalse.length);
    console.log("  - non-boolean type        :", wrongType.length);
    console.log("Missing showOnHomepage field:", missing.length);
    console.log("----------------------------------------");

    console.log("Categories missing the field (would NOT show on homepage):");
    missing.forEach((c) => {
      console.log(
        `  - ${c.name} (id: ${c._id}, showInNavDropdown: ${c.showInNavDropdown})`
      );
    });

    console.log("----------------------------------------");
    console.log("Categories with showOnHomepage === false (intentionally hidden):");
    explicitlyFalse.forEach((c) => console.log(`  - ${c.name}`));

    console.log("----------------------------------------");
    console.log("Categories with showOnHomepage === true:");
    explicitlyTrue.forEach((c) => console.log(`  - ${c.name}`));

    if (wrongType.length) {
      console.log("----------------------------------------");
      console.log("Non-boolean showOnHomepage values:");
      wrongType.forEach((c) =>
        console.log(
          `  - ${c.name}: ${JSON.stringify(c.showOnHomepage)} (typeof ${typeof c.showOnHomepage})`
        )
      );
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error("ERROR:", err.message);
    process.exit(1);
  }
})();
