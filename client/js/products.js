/* ==========================================
        GREEN HUB - PRODUCTS.JS
        Dynamic storefront loading
========================================== */

const GH_API_BASE = "http://localhost:5000";

const ghProductCache = new Map();

/* ---------- helpers ---------- */

function ghAssetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return GH_API_BASE + (path.startsWith("/") ? "" : "/") + path;
}

function ghMoney(amount) {
  return "₹" + Number(amount || 0).toLocaleString("en-IN");
}

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
  media.appendChild(img);

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

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "Add to Cart";
  addBtn.dataset.original = "Add to Cart";
  addBtn.dataset.productId = product._id;
  info.appendChild(addBtn);

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
    img.addEventListener("error", () => {
      img.style.display = "none";
    });
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

/* ---------- add to cart (delegated for dynamic cards) ---------- */

function ghHandleAddToCart(event) {
  const btn = event.target.closest("button[data-product-id]");
  if (!btn) return;

  const product = ghProductCache.get(btn.dataset.productId);
  if (!product) return;

  let cart = JSON.parse(localStorage.getItem("greenhubCart") || "[]");

  const existing = cart.find((item) => item._id === product._id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      _id: product._id,
      name: product.name,
      price: "₹" + (product.discountPrice || product.price),
      image: product.image,
      qty: 1,
    });
  }

  localStorage.setItem("greenhubCart", JSON.stringify(cart));

  if (typeof updateCartCount === "function") updateCartCount();
  if (typeof showToast === "function") showToast(product.name + " added to cart");

  const original = btn.dataset.original || btn.textContent;
  btn.textContent = "Added ✓";
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, 900);
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

document.addEventListener("click", ghHandleAddToCart);
document.addEventListener("click", ghScrollToCategory);

ghHandleSearch();
ghInitCategoryProducts();