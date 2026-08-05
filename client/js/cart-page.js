/* ==========================================
        GREEN HUB - CART-PAGE.JS
        Renders the cart table + summary from
        guest cart (localStorage) or server cart.
========================================== */

(async function () {
  const tbody = document.getElementById("cart-table-body");
  const summary = document.getElementById("cart-summary");
  if (!tbody) return;

  const loggedIn = ghIsLoggedIn();
  const guestItems = ghGetGuestCart();

  let items;
  let mode;

  if (loggedIn) {
    mode = "server";
    try {
      const data = await ghApiRequest("/api/cart");
      items = (data.cart || []).map((entry) => ({
        id: entry._id,
        product: entry.product || {},
        quantity: parseInt(entry.quantity, 10) || 1,
      }));
    } catch (error) {
      console.error("Failed to load server cart:", error);
      items = [];
    }
  } else {
    mode = "guest";
    items = [];
    for (const item of guestItems) {
      let product = null;
      try {
        const res = await fetch(
          ghApiBase() + "/api/products/" + encodeURIComponent(item.productId)
        );
        if (res.ok) {
          const data = await res.json();
          product = data.product || null;
        }
      } catch (error) {
        console.error("Failed to load guest cart product:", error);
      }
      items.push({
        id: item.productId,
        product,
        quantity: parseInt(item.quantity, 10) || 1,
      });
    }
  }

  function ghItemPrice(product) {
    return Number((product && (product.discountPrice || product.price)) || 0);
  }

  function buildRow(item) {
    const tr = document.createElement("tr");

    const name = document.createElement("td");
    name.textContent = (item.product && item.product.name) || "Product";

    const imgTd = document.createElement("td");
    const img = document.createElement("img");
    const images = item.product && item.product.images && item.product.images.length
      ? item.product.images
      : [item.product && item.product.image];
    img.src = ghAssetUrl(images[0]) || "../images/plant1.jpg";
    img.alt = (item.product && item.product.name) || "Product";
    img.width = 100;
    ghHandleImageError(img);
    imgTd.appendChild(img);

    const priceTd = document.createElement("td");
    priceTd.textContent = ghMoney(ghItemPrice(item.product));

    const qtyTd = document.createElement("td");
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.value = item.quantity;
    qtyInput.min = 1;
    qtyInput.dataset.cartId = item.id;
    qtyTd.appendChild(qtyInput);

    const totalTd = document.createElement("td");
    totalTd.className = "row-total";
    totalTd.textContent = ghMoney(ghItemPrice(item.product) * item.quantity);

    const actionTd = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.dataset.cartId = item.id;
    actionTd.appendChild(removeBtn);

    tr.append(name, imgTd, priceTd, qtyTd, totalTd, actionTd);
    return tr;
  }

  function render() {
    tbody.innerHTML = "";

    let subtotal = 0;

    if (items.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.style.textAlign = "center";
      td.textContent = "Your cart is empty.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      items.forEach((item) => {
        subtotal += ghItemPrice(item.product) * item.quantity;
        tbody.appendChild(buildRow(item));
      });
    }

    renderSummary(subtotal);
  }

  function renderSummary(subtotal) {
    if (!summary) return;

    const itemCount = items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    summary.innerHTML = "";

    const p1 = document.createElement("p");
    p1.innerHTML = "Items : <strong>" + itemCount + "</strong>";

    const p2 = document.createElement("p");
    p2.innerHTML = "Subtotal : " + ghMoney(subtotal);

    const p3 = document.createElement("p");
    p3.innerHTML = "Delivery : " + ghMoney(50);

    const rule = document.createElement("hr");

    const h3 = document.createElement("h3");
    h3.innerHTML = "Total : " + ghMoney(subtotal + 50);

    const link = document.createElement("a");
    link.href = "checkout.html";
    const checkoutBtn = document.createElement("button");
    checkoutBtn.type = "button";
    checkoutBtn.textContent = "Proceed to Checkout";
    link.appendChild(checkoutBtn);

    summary.append(p1, p2, p3, rule, h3, link);
  }

  tbody.addEventListener("change", async function (event) {
    const input = event.target.closest("input[data-cart-id]");
    if (!input) return;

    const id = input.dataset.cartId;
    const qty = Math.max(1, parseInt(input.value, 10) || 1);

    if (mode === "server") {
      try {
        await ghApiRequest("/api/cart/" + encodeURIComponent(id), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: qty }),
        });
      } catch (error) {
        console.error("Failed to update quantity:", error);
        if (typeof showToast === "function") {
          showToast(error.message || "Could not update quantity.");
        }
      }
    } else {
      const cart = ghGetGuestCart();
      const found = cart.find((item) => item.productId === id);
      if (found) found.quantity = qty;
      ghSaveGuestCart(cart);
    }

    render();
    ghRefreshCartBadge();
  });

  tbody.addEventListener("click", async function (event) {
    const btn = event.target.closest("button[data-cart-id]");
    if (!btn) return;

    const id = btn.dataset.cartId;

    if (mode === "server") {
      try {
        await ghApiRequest("/api/cart/" + encodeURIComponent(id), {
          method: "DELETE",
        });
      } catch (error) {
        console.error("Failed to remove item:", error);
        if (typeof showToast === "function") {
          showToast(error.message || "Could not remove item.");
        }
      }
    } else {
      ghSaveGuestCart(ghGetGuestCart().filter((item) => item.productId !== id));
    }

    if (typeof showToast === "function") showToast("Item Removed");
    render();
    ghRefreshCartBadge();
  });

  render();

  /* ---------- recommended products (consistent cards) ---------- */

  const recContainer = document.getElementById("cart-recommended");
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
      }
    } catch (error) {
      console.error("Failed to load recommended products:", error);
    }
  }
})();