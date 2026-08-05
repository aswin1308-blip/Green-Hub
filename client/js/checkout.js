/* ==========================================
        GREEN HUB - CHECKOUT.JS
        Login gate + order summary + payment path.
        - Fetches the logged-in customer's latest profile from MongoDB
        - Places the order via POST /api/orders
        - Clears the cart and redirects to the Orders page
========================================== */

(async function () {
  const gateEl = document.getElementById("require-login");
  const contentEl = document.getElementById("checkout-content");
  const summaryEl = document.getElementById("checkout-summary");
  const proceedBtn = document.getElementById("proceed-to-payment");
  const paymentSection = document.getElementById("payment-section");
  const paymentForm = document.querySelector(".payment form");

  const billingName = document.getElementById("billing-name");
  const billingEmail = document.getElementById("billing-email");
  const billingPhone = document.getElementById("billing-phone");
  const billingAddress = document.getElementById("billing-address");

  const DELIVERY_CHARGE = 50;

  let currentItems = [];

  function showEmpty() {
    if (!summaryEl) return;
    summaryEl.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = "Your cart is empty.";
    const link = document.createElement("a");
    link.href = "products.html";
    link.textContent = "Browse products";
    summaryEl.appendChild(p);
    summaryEl.appendChild(link);
  }

  function showGate() {
    if (gateEl) gateEl.style.display = "block";
    if (contentEl) contentEl.style.display = "none";
    if (proceedBtn) proceedBtn.style.display = "none";
  }

  function renderSummary(items) {
    if (!summaryEl) return;

    let subtotal = 0;
    let itemCount = 0;

    summaryEl.innerHTML = "";

    items.forEach((entry) => {
      const product = entry.product || {};
      const price =
        Number(product.discountPrice) || Number(product.price) || 0;
      const qty = parseInt(entry.quantity, 10) || 1;
      subtotal += price * qty;
      itemCount += qty;

      const p = document.createElement("p");
      p.textContent = (product.name || "Product") + " × " + qty;
      const span = document.createElement("span");
      span.textContent = ghMoney(price * qty);
      p.appendChild(span);
      summaryEl.appendChild(p);
    });

    const rule = document.createElement("hr");
    summaryEl.appendChild(rule);

    const sub = document.createElement("p");
    sub.textContent = "Subtotal ";
    const subSpan = document.createElement("span");
    subSpan.textContent = ghMoney(subtotal);
    sub.appendChild(subSpan);
    summaryEl.appendChild(sub);

    const delivery = document.createElement("p");
    delivery.textContent = "Delivery Charge ";
    const delSpan = document.createElement("span");
    delSpan.textContent = ghMoney(DELIVERY_CHARGE);
    delivery.appendChild(delSpan);
    summaryEl.appendChild(delivery);

    const h3 = document.createElement("h3");
    h3.innerHTML = "Total ";
    const totalSpan = document.createElement("span");
    totalSpan.textContent = ghMoney(subtotal + DELIVERY_CHARGE);
    h3.appendChild(totalSpan);
    summaryEl.appendChild(h3);
  }

  // Fetch the logged-in customer's latest profile from MongoDB
  async function loadProfile() {
    try {
      const data = await ghApiRequest("/api/auth/me");
      const u = data.user || {};
      if (billingName && u.name) billingName.value = u.name;
      if (billingEmail && u.email) billingEmail.value = u.email;
      if (billingPhone && u.phone) billingPhone.value = u.phone;
      if (billingAddress && u.address) billingAddress.value = u.address;
    } catch (error) {
      console.error("Failed to load profile:", error);
    }
  }

  async function init() {
    if (!ghIsLoggedIn()) {
      showGate();
      return;
    }

    await ghSyncGuestCartToServer();
    await loadProfile();

    try {
      const data = await ghApiRequest("/api/cart");
      currentItems = data.cart || [];
    } catch (error) {
      console.error("Failed to load cart for checkout:", error);
      currentItems = [];
      if (typeof showToast === "function") {
        showToast(error.message || "Could not load your cart.");
      }
    }

    if (currentItems.length === 0) {
      showEmpty();
      if (proceedBtn) proceedBtn.style.display = "none";
      if (paymentSection) paymentSection.style.display = "none";
      return;
    }

    renderSummary(currentItems);
  }

  if (proceedBtn && paymentSection) {
    proceedBtn.addEventListener("click", function () {
      paymentSection.scrollIntoView({ behavior: "smooth", block: "start" });
      if (typeof showToast === "function") {
        showToast("Review your details and select a payment method");
      }
    });
  }

  // Place Order
  if (paymentForm) {
    paymentForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      if (!ghIsLoggedIn()) {
        if (typeof showToast === "function") {
          showToast("Please log in to place your order.");
        }
        return;
      }

      const methodInput = this.querySelector('input[type="radio"]:checked');
      if (!methodInput) {
        if (typeof showToast === "function") {
          showToast("Please select a payment method");
        }
        return;
      }

      const paymentMethod =
        methodInput.value ||
        (methodInput.closest("label")
          ? methodInput.closest("label").textContent.trim()
          : "") ||
        "Cash on Delivery";

      const name = billingName ? billingName.value.trim() : "";
      const email = billingEmail ? billingEmail.value.trim() : "";
      const phone = billingPhone ? billingPhone.value.trim() : "";
      const address = billingAddress ? billingAddress.value.trim() : "";

      if (!name || !email || !phone || !address) {
        if (typeof showToast === "function") {
          showToast("Please fill in your billing details");
        }
        return;
      }

      if (currentItems.length === 0) {
        if (typeof showToast === "function") {
          showToast("Your cart is empty");
        }
        return;
      }

      let subtotal = 0;
      const products = [];
      currentItems.forEach((entry) => {
        const product = entry.product || {};
        if (!product._id) return;
        const price =
          Number(product.discountPrice) || Number(product.price) || 0;
        const qty = parseInt(entry.quantity, 10) || 1;
        subtotal += price * qty;
        products.push({
          productId: product._id,
          name: product.name || "Product",
          image: (product.images && product.images[0]) || product.image || "",
          price,
          quantity: qty,
        });
      });

      if (products.length === 0) {
        if (typeof showToast === "function") {
          showToast("Your cart items are no longer available");
        }
        return;
      }

      const total = subtotal + DELIVERY_CHARGE;
      const user = ghGetUser() || {};

      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerText : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Placing Order...";
      }

      try {
        await ghApiRequest("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: user._id || "",
            customerName: name,
            customerEmail: email,
            customerPhone: phone,
            customerAddress: address,
            products,
            subtotal,
            deliveryCharge: DELIVERY_CHARGE,
            total,
            paymentMethod,
          }),
        });

        // Clear the cart after a successful order
        for (const entry of currentItems) {
          if (entry._id) {
            try {
              await ghApiRequest("/api/cart/" + encodeURIComponent(entry._id), {
                method: "DELETE",
              });
            } catch (error) {
              console.error("Failed to clear cart item:", error);
            }
          }
        }

        if (typeof showToast === "function") {
          showToast("Order Placed Successfully");
        }
        if (typeof ghRefreshCartBadge === "function") {
          ghRefreshCartBadge();
        }

        setTimeout(() => {
          window.location.href = "orders.html";
        }, 1500);
      } catch (error) {
        console.error("Place order failed:", error);
        if (typeof showToast === "function") {
          showToast(error.message || "Could not place your order. Please try again.");
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = originalText;
        }
      }
    });
  }

  init();
})();