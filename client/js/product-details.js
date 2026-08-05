/* ==========================================
        GREEN HUB - PRODUCT-DETAILS.JS
        Loads a product by ?id= (or first active
        product) and wires Add to Cart / Buy Now.
========================================== */

(async function () {
  const detailsSection = document.querySelector(".product-details");
  if (detailsSection) ghBindCartButtons(detailsSection);

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const nameEl = document.getElementById("pd-name");
  const priceEl = document.getElementById("pd-price");
  const descEl = document.getElementById("pd-desc");
  const imgEl = document.getElementById("pd-image");
  const addBtn = document.getElementById("pd-add");
  const buyBtn = document.getElementById("pd-buy");
  const qtyInput = document.getElementById("pd-qty");
  const titleEl = document.querySelector("title");

  let product = null;

  try {
    if (id) {
      const res = await fetch(
        ghApiBase() + "/api/products/" + encodeURIComponent(id)
      );
      if (res.ok) {
        const data = await res.json();
        product = data.product || null;
      }
    }

    if (!product) {
      const res = await fetch(
        ghApiBase() + "/api/products?status=active&limit=1"
      );
      if (res.ok) {
        const data = await res.json();
        product = (data.products && data.products[0]) || null;
      }
    }
  } catch (error) {
    console.error("Failed to load product details:", error);
  }

  if (!product) {
    if (nameEl) nameEl.textContent = "Product not found";
    return;
  }

  const images = product.images && product.images.length
    ? product.images
    : [product.image];

  const price = Number(product.discountPrice) || Number(product.price) || 0;

  if (nameEl) nameEl.textContent = product.name || "Product";
  if (priceEl) priceEl.textContent = ghMoney(price);
  if (descEl) descEl.textContent = product.description || "";
  if (imgEl) {
    imgEl.src = ghAssetUrl(images[0]) || "../images/plant1.jpg";
    imgEl.alt = product.name || "Product";
  }
  if (titleEl && product.name) {
    titleEl.textContent = "Green Hub | " + product.name;
  }

  const applyQuantity = () => {
    const qty = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
    if (addBtn) {
      addBtn.dataset.productId = product._id;
      addBtn.dataset.quantity = qty;
    }
    if (buyBtn) {
      buyBtn.dataset.productId = product._id;
      buyBtn.dataset.quantity = qty;
    }
  };

  if (qtyInput) qtyInput.addEventListener("change", applyQuantity);
  applyQuantity();
})();