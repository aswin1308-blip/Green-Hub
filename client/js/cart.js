/* ==========================================
        GREEN HUB - CART.JS
        Shared cart + auth helpers for every page.
        - Guests: localStorage "guestCart" -> [{ productId, quantity }]
        - Logged in: server cart via /api/cart/* with Bearer JWT
========================================== */

function ghApiBase() {
  if (typeof GH_API_BASE !== "undefined" && GH_API_BASE) return GH_API_BASE;
  if (typeof window !== "undefined" && window.GH_API_BASE) {
    return window.GH_API_BASE;
  }
  return "https://greenhub1.onrender.com";
}

const GH_TOKEN_KEY = "greenhub_token";
const GH_USER_KEY = "greenhub_user";
const GH_GUEST_CART_KEY = "guestCart";

/* ---------- auth ---------- */

function ghGetToken() {
  return localStorage.getItem(GH_TOKEN_KEY) || "";
}

function ghIsLoggedIn() {
  return !!ghGetToken();
}

function ghGetUser() {
  try {
    return JSON.parse(localStorage.getItem(GH_USER_KEY)) || null;
  } catch (error) {
    return null;
  }
}

function ghSetSession(token, user) {
  localStorage.setItem(GH_TOKEN_KEY, token);
  if (user) localStorage.setItem(GH_USER_KEY, JSON.stringify(user));
}

function ghClearSession() {
  localStorage.removeItem(GH_TOKEN_KEY);
  localStorage.removeItem(GH_USER_KEY);
}

/* ---------- guest cart ---------- */

function ghGetGuestCart() {
  try {
    const items = JSON.parse(localStorage.getItem(GH_GUEST_CART_KEY)) || [];
    return Array.isArray(items) ? items : [];
  } catch (error) {
    return [];
  }
}

function ghSaveGuestCart(items) {
  localStorage.setItem(GH_GUEST_CART_KEY, JSON.stringify(items));
}

function ghGuestCartCount() {
  return ghGetGuestCart().reduce(
    (sum, item) => sum + (parseInt(item.quantity, 10) || 1),
    0
  );
}

/* ---------- asset / money helpers (shared) ---------- */

/* Builds a usable image URL from a stored path.
   New uploads store full https:// Cloudinary URLs (passed through
   unchanged). Old "/uploads/..." paths (legacy local uploads) still
   need the API base prefixed — that's the fallback below. */
function ghAssetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return ghApiBase() + (path.startsWith("/") ? "" : "/") + path;
}

function ghMoney(amount) {
  return "₹" + Number(amount || 0).toLocaleString("en-IN");
}

/* ----------------------------------------------------------------
   NOTE: server/uploads/ is in .gitignore (NOT version-controlled),
   so uploaded product images only exist on the machine where they
   were uploaded. On another teammate's machine the API still returns
   stored paths like "/uploads/xxx.jpg" (ghAssetUrl prefixes them with
   the API base -> URL construction is correct), but the actual file
   is missing there -> 404 in the Network tab and a broken image icon.
   Team fix options: share server/uploads/ separately out-of-band,
   use a hosted image service, or re-upload product images on each
   machine (each machine has its own MongoDB Atlas connection unless
   the team shares the same cluster).
   Until then, every product/category <img> gets ghHandleImageError()
   so a failed load swaps in GH_PLACEHOLDER_IMAGE instead of showing
   a broken icon. This file (client/images/) IS version-controlled.
---------------------------------------------------------------- */

const GH_PLACEHOLDER_IMAGE = "../images/no-image.svg";

/* Attach an onerror fallback: if the image 404s (missing upload), the
   src is empty, or the URL is broken, show the local placeholder. */
function ghHandleImageError(img) {
  if (!img || !img.addEventListener) return;
  img.addEventListener("error", function () {
    if (img.dataset.ghFallback) return;
    img.dataset.ghFallback = "1";
    img.src = GH_PLACEHOLDER_IMAGE;
  });
}

/* ---------- server cart ---------- */

function ghAuthHeaders(extra) {
  const headers = extra || {};
  if (ghIsLoggedIn()) {
    headers["Authorization"] = "Bearer " + ghGetToken();
  }
  return headers;
}

async function ghApiRequest(path, options) {
  const opts = options || {};
  opts.headers = ghAuthHeaders(opts.headers);

  let res;
  try {
    res = await fetch(ghApiBase() + path, opts);
  } catch (error) {
    throw new Error("Could not reach the server. Please try again.");
  }

  let data = null;
  try {
    data = await res.json();
  } catch (error) {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(
      (data && data.message) || "Request failed (" + res.status + ")"
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function ghAddToCart(productId, quantity) {
  const qty = Math.max(1, parseInt(quantity, 10) || 1);

  if (!productId) {
    throw new Error("No product selected.");
  }

  if (ghIsLoggedIn()) {
    return ghApiRequest("/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity: qty }),
    });
  }

  const cart = ghGetGuestCart();
  const existing = cart.find((item) => item.productId === productId);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({ productId, quantity: qty });
  }
  ghSaveGuestCart(cart);
  return { success: true };
}

/* ---------- wishlist ---------- */

async function ghAddToWishlist(productId) {
  if (!ghIsLoggedIn()) {
    throw new Error("Please log in to use your wishlist.");
  }
  return ghApiRequest("/api/wishlist/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
  });
}

async function ghRemoveFromWishlist(productId) {
  if (!ghIsLoggedIn()) {
    throw new Error("Please log in to use your wishlist.");
  }
  return ghApiRequest("/api/wishlist/" + encodeURIComponent(productId), {
    method: "DELETE",
  });
}

/* Returns the wishlist product objects (populated by the backend). */
async function ghGetWishlist() {
  if (!ghIsLoggedIn()) return [];
  const data = await ghApiRequest("/api/wishlist");
  return (data.wishlist || [])
    .map((entry) => entry.product)
    .filter(Boolean);
}

async function ghSyncGuestCartToServer() {
  if (!ghIsLoggedIn()) return;

  const guestItems = ghGetGuestCart();
  if (guestItems.length === 0) return;

  for (const item of guestItems) {
    try {
      await ghApiRequest("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: item.productId,
          quantity: item.quantity,
        }),
      });
    } catch (error) {
      console.error("Failed to sync guest cart item:", error);
    }
  }

  localStorage.removeItem(GH_GUEST_CART_KEY);
}

async function ghCartCount() {
  if (ghIsLoggedIn()) {
    try {
      const data = await ghApiRequest("/api/cart");
      return (data.cart || []).reduce(
        (sum, item) => sum + (parseInt(item.quantity, 10) || 1),
        0
      );
    } catch (error) {
      console.error("Failed to fetch server cart count:", error);
      return 0;
    }
  }
  return ghGuestCartCount();
}

async function ghRefreshCartBadge() {
  if (typeof updateCartCount === "function") {
    updateCartCount(await ghCartCount());
  }
}

/* ---------- buy now ---------- */

// A "Buy Now" purchase is intentionally ISOLATED from the persistent cart.
// The selected product + quantity is stored in sessionStorage (short-lived,
// tab-scoped) and is never written to the server cart or guest cart. The
// checkout page reads this flag and renders a single-item order summary.
var GH_BUY_NOW_KEY = "ghBuyNowItem";
var GH_BUY_NOW_TTL = 30 * 60 * 1000; // 30 minutes

function ghGetBuyNowItem() {
  try {
    var raw = sessionStorage.getItem(GH_BUY_NOW_KEY);
    if (!raw) return null;
    var item = JSON.parse(raw);
    if (!item || !item.productId || !item.quantity || !item.ts) return null;
    if (Date.now() - Number(item.ts) > GH_BUY_NOW_TTL) {
      sessionStorage.removeItem(GH_BUY_NOW_KEY);
      return null;
    }
    return item;
  } catch (error) {
    return null;
  }
}

function ghClearBuyNowItem() {
  try {
    sessionStorage.removeItem(GH_BUY_NOW_KEY);
  } catch (error) {
    /* noop */
  }
}

/* Starts an isolated single-item checkout WITHOUT touching the cart.
   Returns true if checkout is starting, false if it could not start. */
async function ghBuyNow(productId, quantity) {
  var qty = Math.max(1, parseInt(quantity, 10) || 1);
  if (!productId) {
    if (typeof showToast === "function") showToast("No product selected.", true);
    return false;
  }

  try {
    // Quick public availability check BEFORE navigating (cart untouched).
    var data = await ghApiRequest(
      "/api/products/" + encodeURIComponent(productId)
    );
    var product = (data && data.product) || null;
    var stock = Number(product && product.stock) || 0;

    if (!product || !product._id) {
      throw new Error("This product is no longer available.");
    }
    if (stock <= 0) {
      throw new Error("This product is currently out of stock.");
    }

    var finalQty = Math.min(qty, stock);
    if (finalQty < qty && typeof showToast === "function") {
      showToast(
        "Only " + stock + " in stock - quantity adjusted to " + finalQty + "."
      );
    }

    sessionStorage.setItem(
      GH_BUY_NOW_KEY,
      JSON.stringify({
        productId: productId,
        quantity: finalQty,
        ts: Date.now(),
      })
    );

    if (ghIsLoggedIn()) {
      window.location.href = "checkout.html";
    } else {
      window.location.href =
        "login.html?redirect=" + encodeURIComponent("checkout.html");
    }
    return true;
  } catch (error) {
    if (typeof showToast === "function") {
      showToast(error.message || "Could not start checkout.", true);
    }
    return false;
  }
}

/* ---------- cart button handling (event delegation) ---------- */

/* Handles clicks on "Add to Cart" / "Buy Now" buttons
   (button[data-product-id], optional data-buy-now attribute). */
function ghHandleCartButtonClick(event) {
  const btn = event.target.closest("button[data-product-id]");
  if (!btn) return;

  const productId = btn.dataset.productId;
  const quantity = parseInt(btn.dataset.quantity, 10) || 1;

  if (btn.hasAttribute("data-buy-now")) {
    btn.textContent = "Redirecting...";
    btn.disabled = true;
    ghBuyNow(productId, quantity).then(function (started) {
      if (!started) {
        btn.textContent = btn.dataset.original || "Buy Now";
        btn.disabled = false;
      }
    });
    return;
  }

  const original = btn.dataset.original || btn.textContent;
  btn.textContent = "Adding...";
  btn.disabled = true;

  ghAddToCart(productId, quantity)
    .then(() => {
      if (typeof showToast === "function") {
        showToast("Added to cart");
      }
      btn.textContent = "Added ✓";
      setTimeout(() => {
        btn.textContent = original;
        btn.disabled = false;
      }, 900);
      ghRefreshCartBadge();
    })
    .catch((error) => {
      console.error("Add to cart failed:", error);
      if (typeof showToast === "function") {
        showToast(error.message || "Could not add to cart. Please try again.");
      }
      btn.textContent = original;
      btn.disabled = false;
    });
}

/* Attach one delegated click listener to a product container.
   Works for cards rendered after this call (dynamic content). */
function ghBindCartButtons(scope) {
  if (!scope || typeof scope.addEventListener !== "function") return;
  scope.addEventListener("click", ghHandleCartButtonClick);
}
