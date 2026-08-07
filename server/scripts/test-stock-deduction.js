/* ==========================================
   SANITY TEST: exact-quantity stock deduction
   Runs the EXACT atomic decrement loop used by
   placeOrder (orderController.js) against a
   scratch product and asserts the deducted
   amount equals the purchased quantity.
   The scratch product is DELETED at the end,
   so the database is left unchanged.
   Run from server/:  node scripts/test-stock-deduction.js
========================================== */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const Product = require("../models/Product");

// ---- Verbatim deduction loop from placeOrder ----
async function atomicDecrement(productId, requestedQty) {
  let qty = requestedQty;
  let placed = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    placed = await Product.findOneAndUpdate(
      { _id: productId, stock: { $gte: qty } },
      { $inc: { stock: -qty } },
      { new: true }
    );
    if (placed) break;

    const fresh = await Product.findById(productId);
    const available =
      fresh && fresh.status === "active"
        ? Math.max(0, Number(fresh.stock) || 0)
        : 0;

    if (available < 1) {
      qty = 0;
      break;
    }
    if (qty > available) qty = available;
  }

  return { placed, deducted: qty };
}

const SCRATCH_NAME = "__stock_deduction_test__";

async function makeScratch(stock) {
  return Product.create({ name: SCRATCH_NAME, slug: SCRATCH_NAME, price: 10, stock });
}

async function runCase(label, initialStock, orderQty, expectedStock) {
  const p = await makeScratch(initialStock);
  const { placed, deducted } = await atomicDecrement(String(p._id), orderQty);
  const after = await Product.findById(p._id).select("stock").lean();
  const ok = placed && Number(after.stock) === expectedStock;
  console.log(
    (ok ? "PASS" : "FAIL") + ` | ${label}: stock ${initialStock} -> ${after.stock} (ordered ${orderQty}, deducted ${deducted})` +
    (ok ? "" : ` | expected ${expectedStock}`)
  );
  await Product.findByIdAndDelete(p._id);
  return ok;
}

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB\n");

    const results = [
      await runCase("qty 3 of 5", 5, 3, 2),          // exact deduction
      await runCase("qty 2 of 2 (full stock)", 2, 2, 0), // the reported scenario
      await runCase("qty 5 over 1-stock (clamp)", 1, 5, 0), // clamp path
    ];

    console.log("\n" + (results.every(Boolean) ? "ALL TESTS PASSED" : "SOME TESTS FAILED"));
    process.exitCode = results.every(Boolean) ? 0 : 1;
  } catch (error) {
    console.error("Failed to run test:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
