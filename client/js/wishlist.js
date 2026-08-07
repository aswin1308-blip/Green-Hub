/* ==========================================
        GREEN HUB - WISHLIST.JS
        Renders the logged-in user's saved
        items, consistent with the cart page.
========================================== */

(async function () {
  const tbody = document.getElementById("wishlist-table-body");
  if (!tbody) return;

  const gate = document.getElementById("wishlist-gate");
  const content = document.getElementById("wishlist-content");

  if (typeof ghIsLoggedIn !== "function" || !ghIsLoggedIn()) {
    if (gate) gate.style.display = "block";
    if (content) content.style.display = "none";
    return;
  }

  if (gate) gate.style.display = "none";
  if (content) content.style.display = "block";

  let items = [];

  try {
    const data = await ghApiRequest("/api/wishlist");
    items = (data.wishlist || []).filter((entry) => entry.product);
  } catch (error) {
    console.error("Failed to load wishlist:", error);
    items = [];
  }

  function buildRow(entry) {
    const product = entry.product || {};
    const tr = document.createElement("tr");

    const name = document.createElement("td");
    name.dataset.label = "Plant";
    name.textContent = product.name || "Product";

    const imgTd = document.createElement("td");
    imgTd.dataset.label = "Image";
    const img = document.createElement("img");
    const images =
      product.images && product.images.length
        ? product.images
        : [product.image];
    img.src = ghAssetUrl(images[0]) || "../images/plant1.jpg";
    img.alt = product.name || "Product";
    img.width = 100;
    ghHandleImageError(img);
    imgTd.appendChild(img);

    const priceTd = document.createElement("td");
    priceTd.dataset.label = "Price";
    priceTd.textContent = ghMoney(
      Number(product.discountPrice) || Number(product.price) || 0
    );

    const actionTd = document.createElement("td");
    actionTd.dataset.label = "Action";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "gh-btn gh-btn--outline gh-btn--sm";
    addBtn.textContent = "Add to Cart";
    addBtn.dataset.addCart = product._id || "";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "gh-btn gh-btn--outline gh-btn--sm gh-cart-remove-btn";
    removeBtn.textContent = "Remove";
    removeBtn.dataset.removeWish = product._id || "";

    actionTd.append(addBtn, removeBtn);

    tr.append(name, imgTd, priceTd, actionTd);
    return tr;
  }

  function render() {
    tbody.innerHTML = "";

    if (items.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.style.textAlign = "center";
      td.textContent =
        "Your wishlist is empty. Browse products and tap the heart to save them.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    items.forEach((entry) => tbody.appendChild(buildRow(entry)));
  }

  tbody.addEventListener("click", async function (event) {
    const addBtn = event.target.closest("button[data-add-cart]");
    if (addBtn) {
      addBtn.disabled = true;
      try {
        await ghAddToCart(addBtn.dataset.addCart, 1);
        if (typeof showToast === "function") showToast("Added to cart");
        ghRefreshCartBadge();
      } catch (error) {
        console.error("Add to cart failed:", error);
        if (typeof showToast === "function") {
          showToast(error.message || "Could not add to cart.");
        }
      } finally {
        addBtn.disabled = false;
      }
      return;
    }

    const removeBtn = event.target.closest("button[data-remove-wish]");
    if (removeBtn) {
      removeBtn.disabled = true;
      try {
        await ghRemoveFromWishlist(removeBtn.dataset.removeWish);
        items = items.filter(
          (entry) =>
            !entry.product || entry.product._id !== removeBtn.dataset.removeWish
        );
        if (typeof showToast === "function") showToast("Removed from Wishlist");
        render();
      } catch (error) {
        console.error("Remove from wishlist failed:", error);
        if (typeof showToast === "function") {
          showToast(error.message || "Could not remove item.");
        }
        removeBtn.disabled = false;
      }
    }
  });

  render();

  /* ---------- recommended products (consistent cards) ---------- */

  const recContainer = document.getElementById("wishlist-recommended");
  if (recContainer) {
    ghBindCartButtons(recContainer);
    ghBindWishlistButtons(recContainer);
    try {
      const res = await fetch(
        ghApiBase() + "/api/products?status=active&limit=4"
      );
      if (res.ok) {
        const data = await res.json();
        recContainer.innerHTML = "";
        (data.products || []).forEach((product) => {
          if (typeof ghBuildProductCard === "function") {
            recContainer.appendChild(ghBuildProductCard(product));
          }
        });
        ghLoadWishlistState();
      }
    } catch (error) {
      console.error("Failed to load recommended products:", error);
    }
  }
})();
