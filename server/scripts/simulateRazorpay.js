const fs = require("fs");
const path = require("path");

const paymentJs = fs.readFileSync(
  path.join(__dirname, "..", "..", "client", "js", "payment.js"),
  "utf8"
);

let rzOpenCalled = false;
let capturedOptions = null;
let capturedHandler = null;

const windowShim = {
  GH_API_BASE: "http://localhost:5000",
  showToast: (msg, isError) => console.log("  [toast]", (isError ? "ERROR: " : "") + msg),
  Razorpay: function (options) {
    capturedOptions = options;
    capturedHandler = options.handler;
    this.open = function () {
      rzOpenCalled = true;
      console.log("  [Razorpay] .open() called with options:");
      console.log("    key:", options.key);
      console.log("    order_id:", options.order_id);
      console.log("    amount:", options.amount, options.currency);
      console.log("    name:", options.name, "| prefill:", JSON.stringify(options.prefill));
      setTimeout(() => {
        console.log("  [simulate] user pays -> handler() fires");
        options.handler({
          razorpay_order_id: options.order_id,
          razorpay_payment_id: "pay_TEST123456",
          razorpay_signature: "sig_TEST123456",
        });
      }, 50);
    };
    this.on = function (evt, cb) { this._handlers = this._handlers || {}; this._handlers[evt] = cb; };
  },
  alert: () => {},
};

const sandbox = {
  window: windowShim,
  fetch: (url, opts) => {
    console.log("  [fetch]", opts.method, url);
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        id: "order_TEST_" + Date.now(),
        amount: 25000,
        currency: "INR",
        status: "created",
        key_id: "rzp_test_XXXXXXXX",
      }),
    });
  },
  console: { log: (...a) => console.log(...a), error: (...a) => console.error(...a) },
};

const run = new Function("window", "fetch", "console", paymentJs);
run(sandbox.window, sandbox.fetch, sandbox.console);

console.log("  [check] ghRazorpayCheckout defined:", typeof windowShim.ghRazorpayCheckout === "function");

windowShim.ghRazorpayCheckout(250, { name: "Test User", email: "t@t.com", phone: "9876543210" }).then((res) => {
  console.log("  [check] resolve ->", JSON.stringify(res));
  console.log("  [check] modal opened:", rzOpenCalled);
  console.log("  [check] options valid:", !!capturedOptions && !!capturedOptions.order_id && !!capturedOptions.key);
  if (!rzOpenCalled || !capturedOptions || !capturedOptions.order_id || !capturedOptions.key) {
    console.error("  [check] FAILED");
    process.exit(1);
  }
  console.log("  [check] ALL PASS");
});
