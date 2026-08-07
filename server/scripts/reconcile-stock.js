/* ==========================================
   STOCK RECONCILIATION AUDIT (one-time)

   Reconstructs what each product's stock SHOULD be
   from order history and compares it to the current
   value.

   current should equal  initial - sold + restored
   - sold      = sum of line quantities in non-cancelled orders
   - restored  = sum of line quantities in cancelled orders
                 (placeOrder deducts; cancel/admin-cancel restore)

   IMPORTANT: there is NO "initial stock" history in the DB, so the
   script CANNOT compute an absolute target by itself. Use it in one of
   two safe modes:

   1) DRY-RUN (default) - prints the per-product audit so you can compare
      implied-original = current + sold - restored against what you
      remember seeding each product with.

   2) --initial <file>  - provide a text file mapping product id or name
      to the ORIGINAL stock value ("<id-or-name> = <number>", one per
      line, #/;// for comments). The script then reports any product
      whose current stock != initial - sold + restored.

   3) --initial <file> --apply - writes the corrected stock values.
      ONLY use after reviewing the dry-run numbers.

   Run from server/:  node scripts/reconcile-stock.js
                      node scripts/reconcile-stock.js --initial seeds.txt
                      node scripts/reconcile-stock.js --initial seeds.txt --apply
========================================== */
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const Product = require("../models/Product");
const Order = require("../models/Order");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const idx = args.indexOf("--initial");
const initialFile = idx >= 0 && args[idx + 1] ? args[idx + 1] : null;

const parseInitial = (file) => {
  const map = {};
  if (!file) return map;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith(";") || line.startsWith("//")) continue;
    const parts = line.split("|");
    if (parts.length < 2) continue;
    const key = parts[0].trim();
    const val = Math.max(0, parseInt(parts[1].trim(), 10));
    if (key && !Number.isNaN(val)) map[key.toLowerCase()] = val;
  }
  return map;
};

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(apply ? "APPLY mode - stock corrections WILL be written" : "DRY-RUN mode (no writes)");
    console.log("Reconstructing per-product sold/restored from orders...\n");

    const [products, orders] = await Promise.all([
      Product.find().lean(),
      Order.find().lean(),
    ]);

    const soldMap = new Map();
    const restoredMap = new Map();
    const orderCount = new Map();

    for (const o of orders) {
      if (!Array.isArray(o.products)) continue;
      const cancelled = o.status === "Cancelled";
      for (const line of o.products) {
        if (!line || !line.productId) continue;
        const key = String(line.productId);
        const qty = Math.max(0, parseInt(line.quantity, 10) || 0);
        if (cancelled) {
          restoredMap.set(key, (restoredMap.get(key) || 0) + qty);
        } else {
          soldMap.set(key, (soldMap.get(key) || 0) + qty);
        }
        orderCount.set(key, (orderCount.get(key) || 0) + 1);
      }
    }

    const initial = parseInitial(initialFile);
    console.log("PRODUCT".padEnd(46) + "STOCK".padStart(6) + "SOLD".padStart(6) + "RESTORED".padStart(9) + "ORDS".padStart(9) + "INITIAL".padStart(8) + "TARGET".padStart(9));
    const toFix = [];
    let mismatches = 0;

    for (const p of products.sort((a, b) => a.name.localeCompare(b.name))) {
      const key = String(p._id);
      const sold = soldMap.get(key) || 0;
      const restored = restoredMap.get(key) || 0;
      const cur = Math.max(0, parseInt(p.stock, 10) || 0);
      const impliedOriginal = cur + sold - restored;

      let target = null;
      let expected = null;
      const initialVal = initial[p.name.toLowerCase()] ?? initial[key.toLowerCase()];
      if (initialVal !== undefined) {
        expected = Math.max(0, initialVal - sold + restored);
        if (expected !== cur) {
          mismatches++;
          toFix.push({ id: p._id, name: p.name, current: cur, expected });
        }
      }

      console.log(
        p.name.slice(0, 45).padEnd(46) +
        String(cur).padStart(6) +
        String(sold).padStart(6) +
        String(restored).padStart(9) +
        String(orderCount.get(key) || 0).padStart(9) +
        (initialVal !== undefined ? String(initialVal).padStart(8) : "     n/a") +
        (target !== null ? String(expected).padStart(9) : String(impliedOriginal).padStart(9))
      );
    }

    if (initialFile) {
      console.log(`\nmismatches vs seeded initial stock: ${mismatches}`);
      if (mismatches && apply) {
        console.log("writing corrections...");
        for (const f of toFix) {
          await Product.updateOne({ _id: f.id }, { $set: { stock: f.expected } });
          console.log(`  ${f.name}: ${f.expected}`);
        }
        console.log("done.");
      } else if (mismatches && !apply) {
        console.log("re-run with --apply to fix (after reviewing).");
      } else {
        console.log("all products match seeded stock - nothing to fix.");
      }
    } else {
      console.log("\nno --initial file given - audit only. Compare the INITIAL column logic against your seed records.");
    }
  } catch (error) {
    console.error("Failed to run reconciliation:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();