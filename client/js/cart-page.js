/* ==========================================
        GREEN HUB - CART-PAGE.JS
        Renders the cart table + summary from
        guest cart (localStorage) or server cart.
========================================== */

(async function () {
  const tbody = document.getElementById("cart-table-body");
  const summary = document.getElementById("cart-summary");
  if (!tbody) return;

  // Must mirror server/controllers/orderController.js pricing rules
  const DELIVERY_FEE = 50;
  const FREE_DELIVERY_MIN = 499;
  const GST_RATE = 0.05;

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

  /* ---------- stock auto-adjustment ---------- */

  async function persistSetItemQty(item, qty) {
    if (mode === "server") {
      try {
        await ghApiRequest("/api/cart/" + encodeURIComponent(item.id), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: qty }),
        });
        return true;
      } catch (error) {
        // 404 = item already gone server-side.
        if (error.status === 404) return false;
        console.error("Failed to adjust cart quantity:", error);
        return true;
      }
    } else {
      const cart = ghGetGuestCart();
      const found = cart.find((x) => String(x.productId) === String(item.id));
      if (found) {
        found.quantity = qty;
        ghSaveGuestCart(cart);
      }
      return true;
    }
  }

  async function removeCartItem(item) {
    if (mode === "server") {
      try {
        await ghApiRequest("/api/cart/" + encodeURIComponent(item.id), {
          method: "DELETE",
        });
      } catch (error) {
        if (error.status !== 404) {
          console.error("Failed to remove cart item:", error);
        }
      }
    } else {
      ghSaveGuestCart(
        ghGetGuestCart().filter((x) => String(x.productId) !== String(item.id))
      );
    }
  }

  // Runs after the cart is loaded AND after every quantity change. Clamps
  // quantities to available stock, removes unstockable items and keeps the
  // customer informed with an inline note + toast.
  async function reconcileStockItems() {
    let changed = [];
    const kept = [];

    for (const item of items) {
      if (!item.product) {
        await removeCartItem(item);
        changed.push("A product in your cart is no longer available and was removed.");
        continue;
      }

      const available = parseInt(item.product.stock, 10) || 0;

      if (available <= 0) {
        await removeCartItem(item);
        changed.push('"' + item.product.name + '" is out of stock and was removed from your cart.');
        continue;
      }

      if (item.quantity > available) {
        if (await persistSetItemQty(item, available)) {
          item.note =
            "Only " + available + " in stock — quantity adjusted from " +
            item.quantity + " to " + available + ".";
          changed.push(item.note);
          item.quantity = available;
        } else {
          continue;
        }
      } else {
        item.note = "";
      }

      kept.push(item);
    }

    items = kept;
    if (changed.length) {
      changed.forEach(function (msg) {
        if (typeof showToast === "function") showToast(msg);
      });
    }
    return changed.length > 0;
  }

  function buildRow(item) {
    const tr = document.createElement("tr");

    const name = document.createElement("td");
    name.dataset.label = "Plant";
    name.textContent = (item.product && item.product.name) || "Product";

    const imgTd = document.createElement("td");
    imgTd.dataset.label = "Image";
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
    priceTd.dataset.label = "Price";
    priceTd.textContent = ghMoney(ghItemPrice(item.product));

    const qtyTd = document.createElement("td");
    qtyTd.dataset.label = "Quantity";
    const qtyWrap = document.createElement("div");
    qtyWrap.className = "gh-qty";
    const minusBtn = document.createElement("button");
    minusBtn.type = "button";
    minusBtn.textContent = "−";
    minusBtn.dataset.cartStep = "-1";
    minusBtn.dataset.cartId = item.id;
    minusBtn.setAttribute("aria-label", "Decrease quantity");
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.value = item.quantity;
    qtyInput.min = 1;
    qtyInput.max = parseInt(item.product && item.product.stock, 10) || 1;
    qtyInput.dataset.cartId = item.id;
    qtyInput.setAttribute("aria-label", "Quantity");
    const plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.textContent = "+";
    plusBtn.dataset.cartStep = "1";
    plusBtn.dataset.cartId = item.id;
    plusBtn.setAttribute("aria-label", "Increase quantity");
    if (item.quantity <= 1) minusBtn.disabled = true;
    qtyWrap.append(minusBtn, qtyInput, plusBtn);
    qtyTd.appendChild(qtyWrap);

    if (item.note) {
      const note = document.createElement("div");
      note.className = "gh-cart-note";
      note.setAttribute("role", "status");
      note.textContent = item.note;
      qtyTd.appendChild(note);
    }

    const totalTd = document.createElement("td");
    totalTd.className = "row-total";
    totalTd.dataset.label = "Total";
    totalTd.textContent = ghMoney(ghItemPrice(item.product) * item.quantity);

    const actionTd = document.createElement("td");
    actionTd.dataset.label = "Action";
    const btnWrap = document.createElement("div");
    btnWrap.className = "cart-actions";
    const wishlistBtn = document.createElement("button");
    wishlistBtn.type = "button";
    wishlistBtn.className = "gh-btn gh-btn--outline gh-btn--sm";
    wishlistBtn.textContent = "Move to Wishlist";
    wishlistBtn.dataset.cartWishlist = item.id;
    wishlistBtn.dataset.cartProductId =
      (item.product && (item.product._id || item.product.productId)) || "";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "gh-btn gh-btn--outline gh-btn--sm gh-cart-remove-btn";
    removeBtn.textContent = "Remove";
    removeBtn.dataset.cartId = item.id;
    btnWrap.append(wishlistBtn, removeBtn);
    actionTd.appendChild(btnWrap);

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
      td.textContent = "Your cart is empty.";      tr.appendChild(td);
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

    const delivery = subtotal >= FREE_DELIVERY_MIN ? 0 : DELIVERY_FEE;
    const tax = Math.round(subtotal * GST_RATE);
    const total = subtotal + delivery + tax;

    summary.innerHTML = "";

    const p1 = document.createElement("p");
    p1.innerHTML = "Items : <strong>" + itemCount + "</strong>";

    const p2 = document.createElement("p");
    p2.innerHTML = "Subtotal : " + ghMoney(subtotal);

    const p3 = document.createElement("p");
    p3.innerHTML = "Delivery : " +
      (delivery === 0
        ? "<strong>FREE</strong>"
        : ghMoney(delivery) +
          " <small>(Free above " + ghMoney(FREE_DELIVERY_MIN) + ")</small>");

    const p4 = document.createElement("p");
    p4.innerHTML = "GST (" + Math.round(GST_RATE * 100) + "%) : " + ghMoney(tax);

    const rule = document.createElement("hr");

    const h3 = document.createElement("h3");
    h3.innerHTML = "Total : " + ghMoney(total);

    const link = document.createElement("a");
    link.href = "checkout.html";
    if (window.ghClearBuyNowItem) {
      // Going to checkout from the cart page must always show the FULL
      // cart, never a leftover single-item "Buy Now" from earlier.
      link.addEventListener("click", function () {
        window.ghClearBuyNowItem();
      });
    }
    const checkoutBtn = document.createElement("button");
    checkoutBtn.type = "button";
    checkoutBtn.className = "gh-btn gh-btn--big";
    checkoutBtn.textContent = "Proceed to Checkout";
    link.appendChild(checkoutBtn);

    summary.append(p1, p2, p3, p4, rule, h3, link);
  }

  tbody.addEventListener("change", async function (event) {
    const input = event.target.closest("input[data-cart-id]");
    if (!input) return;

    const id = input.dataset.cartId;
    const item = items.find((i) => String(i.id) === String(id));
    const stock = item && item.product ? parseInt(item.product.stock, 10) || 0 : 0;
    let qty = Math.max(1, parseInt(input.value, 10) || 1);

    // Auto-clamp quantity to available stock; never allow overselling.
    if (item) {
      if (stock > 0) {
        if (qty > stock && Number.isInteger(input.valueAsNumber) && input.valueAsNumber > stock) {
          qty = stock;
          item.note =
            "Only " + stock + " in stock — quantity adjusted from " +
            input.valueAsNumber + " to " + stock + ".";
          if (typeof showToast === "function") {
            showToast('"' + item.product.name + '" — ' + item.note);
          }
        } else {
          item.note = "";
        }
      } else {
        await removeCartItem(item);
        items = items.filter((i) => String(i.id) !== String(id));
        if (typeof showToast === "function") {
          showToast(
            '"' + (item.product ? item.product.name : "Product") +
            '" is out of stock and was removed from your cart.'
          );
        }
        render();
        ghRefreshCartBadge();
        return;
      }
    }

    if (mode === "server") {
      try {
        await ghApiRequest("/api/cart/" + encodeURIComponent(id), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: qty }),
        });
      } catch (error) {
        // 404 = item already gone server-side; drop the stale row.
        if (error.status === 404) {
          items = items.filter((i) => String(i.id) !== String(id));
          render();
          ghRefreshCartBadge();
          return;
        }
        console.error("Failed to update quantity:", error);
        if (typeof showToast === "function") {
          showToast(error.message || "Could not update quantity.");
        }
      }
    } else {
      const cart = ghGetGuestCart();
      const found = cart.find((item) => String(item.productId) === String(id));
      if (found) {
        found.quantity = qty;
        ghSaveGuestCart(cart);
      }
    }

    if (item) item.quantity = qty;
    render();
    ghRefreshCartBadge();
  });

  tbody.addEventListener("click", async function (event) {
    const stepBtn = event.target.closest("button[data-cart-step]");
    if (stepBtn) {
      const id = stepBtn.dataset.cartId;
      const item = items.find((i) => String(i.id) === String(id));
      if (!item) return;

      const delta = parseInt(stepBtn.dataset.cartStep, 10) || 0;
      const stock = item.product ? parseInt(item.product.stock, 10) || 0 : 0;
      let qty = item.quantity + delta;
      if (stock > 0 && qty > stock) {
        qty = stock;
        if (typeof showToast === "function") {
          showToast(
            'Only ' + stock + ' in stock for "' +
            (item.product ? item.product.name : "this product") + '".'
          );
        }
      }
      if (qty < 1) qty = 1;
      if (qty === item.quantity) return;

      try {
        if (mode === "server") {
          await ghApiRequest("/api/cart/" + encodeURIComponent(id), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quantity: qty }),
          });
        } else {
          const cart = ghGetGuestCart();
          const found = cart.find((i) => String(i.productId) === String(id));
          if (found) {
            found.quantity = qty;
            ghSaveGuestCart(cart);
          }
        }
      } catch (error) {
        // 404 = item already gone server-side; drop the stale row.
        if (error.status === 404) {
          items = items.filter((i) => String(i.id) !== String(id));
          render();
          ghRefreshCartBadge();
          return;
        }
        console.error("Failed to update quantity:", error);
        if (typeof showToast === "function") {
          showToast(error.message || "Could not update quantity.");
        }
        return;
      }

      item.quantity = qty;
      render();
      ghRefreshCartBadge();
      return;
    }

    const wishBtn = event.target.closest("button[data-cart-wishlist]");
    if (wishBtn) {
      const cartId = wishBtn.dataset.cartWishlist;
      const productId = wishBtn.dataset.cartProductId;

      try {
        await ghAddToWishlist(productId);
      } catch (error) {
        console.error("Failed to move to wishlist:", error);
        if (typeof showToast === "function") {
          showToast(error.message || "Could not add to wishlist.");
        }
        return;
      }

      try {
        if (mode === "server") {
          await ghApiRequest("/api/cart/" + encodeURIComponent(cartId), {
            method: "DELETE",
          });
        } else {
          ghSaveGuestCart(
            ghGetGuestCart().filter((item) => item.productId !== cartId)
          );
        }
      } catch (error) {
        // 404 = item already gone server-side; still drop the row below.
        if (error.status !== 404) {
          console.error("Failed to remove from cart:", error);
          if (typeof showToast === "function") {
            showToast(error.message || "Could not remove item.");
          }
          return;
        }
      }

      if (typeof showToast === "function") {
        showToast("Moved to Wishlist");
      }
      items = items.filter((i) => String(i.id) !== String(cartId));
      render();
      ghRefreshCartBadge();
      return;
    }

    const btn = event.target.closest("button[data-cart-id]");
    if (!btn) return;

    const id = btn.dataset.cartId;

    try {
      if (mode === "server") {
        await ghApiRequest("/api/cart/" + encodeURIComponent(id), {
          method: "DELETE",
        });
      } else {
        ghSaveGuestCart(
          ghGetGuestCart().filter((item) => String(item.productId) !== String(id))
        );
      }
    } catch (error) {
      // 404 means the item is already gone from the server cart (e.g. removed
      // in another tab or on another device) — treat it as removed and let the
      // row drop below instead of showing a misleading "not found" error.
      if (error.status !== 404) {
        console.error("Failed to remove item:", error);
        if (typeof showToast === "function") {
          showToast(error.message || "Could not remove item.");
        }
        return;
      }
    }

    // The in-memory `items` array is the render source of truth — drop the
    // entry BEFORE rendering so the table, totals and badge update
    // immediately (previously the backend/localStorage was updated but the
    // stale list was re-rendered, so the row never disappeared).
    items = items.filter((i) => String(i.id) !== String(id));
    if (typeof showToast === "function") showToast("Item Removed");
    render();
    ghRefreshCartBadge();
  });

  // Auto-adjust any quantities to available stock, then render.
  (async function () {
    await reconcileStockItems();
    render();
    ghRefreshCartBadge();
  })();

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