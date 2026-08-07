/* ==========================================
        GREEN HUB - PRODUCTS.JS
        Dynamic storefront loading
========================================== */

// Configurable API base — a window.GH_API_BASE set before this script
// wins (mirrors the pattern used by premium.js and the other scripts).
const GH_API_BASE =
  (typeof window !== "undefined" && window.GH_API_BASE) ||
  "https://greenhub1.onrender.com";

const ghProductCache = new Map();

/* ---------- helpers ---------- */

function ghDiscountPercent(product) {
  const price = Number(product.price) || 0;
  const discount = Number(product.discountPrice) || 0;
  if (discount <= 0 || price <= 0 || discount >= price) return 0;
  return Math.round(((price - discount) / price) * 100);
}

async function ghFetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Request failed (" + res.status + ")");
  return res.json();
}

function ghNote(text) {
  const p = document.createElement("p");
  p.className = "gh-note";
  p.textContent = text;
  return p;
}

/* ---------- product card ---------- */

function ghBuildProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";

  const media = document.createElement("div");
  media.className = "product-media";

  const img = document.createElement("img");
  img.src = ghAssetUrl((product.images && product.images[0]) || "");
  img.alt = product.name || "Product";
  img.loading = "lazy";
  ghHandleImageError(img);
  media.appendChild(img);

  const wishBtn = document.createElement("button");
  wishBtn.type = "button";
  wishBtn.className = "gh-wish-btn";
  wishBtn.dataset.productId = product._id;
  wishBtn.title = "Add to Wishlist";
  wishBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
  media.appendChild(wishBtn);

  const percent = ghDiscountPercent(product);
  if (percent > 0) {
    const badge = document.createElement("span");
    badge.className = "gh-badge";
    badge.textContent = "-" + percent + "%";
    media.appendChild(badge);
  }
  card.appendChild(media);

  const info = document.createElement("div");
  info.className = "product-info";

  const title = document.createElement("h3");
  title.textContent = product.name || "Untitled";
  info.appendChild(title);

  const price = document.createElement("p");
  price.className = "gh-price";
  if (ghDiscountPercent(product) > 0) {
    const oldPrice = document.createElement("span");
    oldPrice.className = "price-old";
    oldPrice.textContent = ghMoney(product.price);
    price.appendChild(oldPrice);
    price.appendChild(document.createTextNode(ghMoney(product.discountPrice)));
  } else {
    price.textContent = ghMoney(product.price);
  }
  info.appendChild(price);

  const actions = document.createElement("div");
  actions.className = "gh-card-actions";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "Add to Cart";
  addBtn.dataset.original = "Add to Cart";
  addBtn.dataset.productId = product._id;
  actions.appendChild(addBtn);

  const buyBtn = document.createElement("button");
  buyBtn.type = "button";
  buyBtn.textContent = "Buy Now";
  buyBtn.dataset.original = "Buy Now";
  buyBtn.dataset.productId = product._id;
  buyBtn.dataset.buyNow = "";
  actions.appendChild(buyBtn);

  info.appendChild(actions);

  card.appendChild(info);

  ghProductCache.set(product._id, {
    _id: product._id,
    name: product.name,
    price: product.price,
    discountPrice: product.discountPrice || 0,
    image: img.src,
  });

  return card;
}

/* ---------- wishlist (heart buttons on product cards) ---------- */

let ghWishlistIds = new Set();

/* Refresh the filled/unfilled heart state on every rendered card. */
async function ghLoadWishlistState() {
  if (typeof ghIsLoggedIn !== "function" || !ghIsLoggedIn()) return;
  try {
    const products = await ghGetWishlist();
    ghWishlistIds = new Set(
      products.map((p) => p && p._id).filter(Boolean)
    );
    document.querySelectorAll(".gh-wish-btn").forEach((btn) => {
      const icon = btn.querySelector("i");
      if (ghWishlistIds.has(btn.dataset.productId)) {
        btn.classList.add("active");
        if (icon) icon.className = "fa-solid fa-heart";
      }
    });
  } catch (error) {
    console.error("Failed to load wishlist state:", error);
  }
}

function ghHandleWishlistClick(event) {
  const btn = event.target.closest(".gh-wish-btn");
  if (!btn) return;

  const productId = btn.dataset.productId;
  if (!productId) return;

  if (typeof ghIsLoggedIn !== "function" || !ghIsLoggedIn()) {
    if (typeof showToast === "function") {
      showToast("Please log in to add items to your wishlist");
    }
    setTimeout(() => {
      window.location.href =
        "login.html?redirect=" +
        encodeURIComponent(window.location.pathname.split("/").pop());
    }, 800);
    return;
  }

  const icon = btn.querySelector("i");
  const isActive = btn.classList.contains("active");
  btn.disabled = true;

  const action = isActive
    ? ghRemoveFromWishlist(productId)
    : ghAddToWishlist(productId);

  action
    .then(() => {
      if (isActive) {
        btn.classList.remove("active");
        if (icon) icon.className = "fa-regular fa-heart";
        if (typeof showToast === "function") showToast("Removed from Wishlist");
      } else {
        btn.classList.add("active");
        if (icon) icon.className = "fa-solid fa-heart";
        if (typeof showToast === "function") showToast("Added to Wishlist");
      }
    })
    .catch((error) => {
      console.error("Wishlist update failed:", error);
      if (typeof showToast === "function") {
        showToast(error.message || "Could not update wishlist.");
      }
    })
    .finally(() => {
      btn.disabled = false;
    });
}

function ghBindWishlistButtons(scope) {
  if (!scope || typeof scope.addEventListener !== "function") return;
  scope.addEventListener("click", ghHandleWishlistClick);
}

/* ---------- category sections ---------- */

async function ghLoadCategoryProducts(category, container) {
  container.appendChild(ghNote("Loading products..."));

  try {
    const url =
      GH_API_BASE +
      "/api/products?category=" +
      encodeURIComponent(category._id) +
      "&status=active&limit=20";

    const data = await ghFetchJSON(url);
    const products = data.products || [];

    container.innerHTML = "";

    if (products.length === 0) {
      container.appendChild(
        ghNote("No products available in this category yet.")
      );
      return;
    }

    products.forEach((product) =>
      container.appendChild(ghBuildProductCard(product))
    );
  } catch (error) {
    container.innerHTML = "";
    container.appendChild(
      ghNote("Unable to load products. Please try again later.")
    );
  }
}

function ghRenderCategorySection(category) {
  const mount = document.querySelector("#category-products");
  if (!mount) return;

  const section = document.createElement("section");
  section.className = "products";
  section.id = "category-" + category._id;

  const heading = document.createElement("h2");
  heading.textContent = category.name;
  section.appendChild(heading);

  const container = document.createElement("div");
  container.className = "product-container";
  section.appendChild(container);

  mount.appendChild(section);

  ghLoadCategoryProducts(category, container);
}

async function ghInitCategoryProducts() {
  const mount = document.querySelector("#category-products");
  if (!mount) return;

  ghBindCartButtons(mount);
  ghBindWishlistButtons(mount);

  try {
    const data = await ghFetchJSON(GH_API_BASE + "/api/categories");
    const categories = data.categories || [];

    if (categories.length === 0) {
      mount.appendChild(ghNote("No categories available yet."));
      return;
    }

    categories.forEach(ghRenderCategorySection);
    ghRenderCategoryButtons(categories);
    ghRenderShopByCategory(categories);
    ghLoadWishlistState();
  } catch (error) {
    mount.appendChild(
      ghNote("Unable to load categories. Please try again later.")
    );
  }
}

/* ---------- shop by category cards (home page) ---------- */

function ghRenderShopByCategory(categories) {
  const container = document.querySelector("#shop-categories");
  if (!container) return;

  container.innerHTML = "";

  categories.forEach((category) => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.category = category._id;

    const img = document.createElement("img");
    img.src = ghAssetUrl(category.image);
    img.alt = category.name;
    img.loading = "lazy";
    ghHandleImageError(img);
    card.appendChild(img);

    const heading = document.createElement("h3");
    heading.textContent = category.name;
    card.appendChild(heading);

    container.appendChild(card);
  });
}

/* ---------- category filter buttons (products page) ---------- */

function ghRenderCategoryButtons(categories) {
  const container = document.querySelector("#category-filter");
  if (!container) return;

  container.innerHTML = "";

  categories.forEach((category) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = category.name;
    btn.dataset.category = category._id;
    container.appendChild(btn);
  });
}

function ghScrollToCategory(event) {
  const btn = event.target.closest(
    "#category-filter button[data-category], #shop-categories .card[data-category]"
  );
  if (!btn) return;

  const section = document.getElementById("category-" + btn.dataset.category);
  if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- live search (dynamic cards) ---------- */

function ghHandleSearch() {
  const input = document.querySelector(".search-section input");
  if (!input) return;

  input.addEventListener("keyup", function () {
    const value = this.value.trim().toLowerCase();

    document.querySelectorAll(".product-card").forEach((card) => {
      const name = card.querySelector("h3").textContent.toLowerCase();
      card.style.display = !value || name.includes(value) ? "" : "none";
    });
  });
}

/* ---------- init ---------- */

document.addEventListener("click", ghScrollToCategory);

ghHandleSearch();
ghInitCategoryProducts();