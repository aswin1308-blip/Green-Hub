/* ==========================================
        GREEN HUB - CHECKOUT.JS (premium)
        Login gate + order summary + GST +
        coupon + payment + place order.
        - Loads the cart from MongoDB (guest cart
          is synced to the server on entry)
        - Validates the cart against CURRENT stock via
          POST /api/orders/preflight BEFORE any payment,
          auto-adjusting quantities server-side
        - Shows the customer what changed, then charges
          and places the order via POST /api/orders
        - Clears the cart and redirects to
          order-success.html?id=<orderId>
        - "Buy Now" mode (sessionStorage ghBuyNowItem): renders ONLY the
          single selected product and places the order for exactly that
          item — the persisted cart is never touched
========================================== */

(function () {
  var DELIVERY_FEE = 50;
  var FREE_DELIVERY_MIN = 499;
  var GST_RATE = 0.05;

  var gateEl = document.querySelector('[data-checkout-gate]');
  var rootEl = document.querySelector('[data-checkout-root]');
  var emptyEl = document.querySelector('[data-checkout-empty]');
  var itemsEl = document.querySelector('[data-co-items]');
  var breakdownEl = document.querySelector('[data-breakdown]');
  var noticeEl = document.querySelector('[data-co-notice]');
  var placeBtn = document.querySelector('[data-place-order]');
  var placeText = document.querySelector('[data-place-text]');

  var nameInput = document.getElementById('co-name');
  var emailInput = document.getElementById('co-email');
  var phoneInput = document.getElementById('co-phone');
  var addressInput = document.getElementById('co-address');
  var cityInput = document.getElementById('co-city');
  var pincodeInput = document.getElementById('co-pincode');

  var couponInput = document.querySelector('[data-coupon-input]');
  var couponApplyBtn = document.querySelector('[data-coupon-apply]');
  var couponAppliedEl = document.querySelector('[data-coupon-applied]');

  var currentItems = [];
  var appliedCoupon = null; // { code, discount }

  // True when the customer arrived via "Buy Now" (single-item checkout).
  // In this mode the persisted cart / guest cart are never read or written.
  var isBuyNow = false;

  // Server-approved order state (set by /api/orders/preflight).
  var verifiedPayload = null; // { items, totals, adjustments }
  var serverTotals = null;    // totals shown/payed once verified

  function apiBase() {
    return (window.GH_API_BASE) || 'https://greenhub1.onrender.com';
  }

  function money(n) {
    return window.ghMoney ? window.ghMoney(n) : '₹' + Number(n || 0).toLocaleString('en-IN');
  }

  function toast(msg, isError) {
    if (window.showToast) { window.showToast(msg, isError); return; }
    alert(msg);
  }

  function refreshBadge() {
    if (window.ghRefreshCartBadge) window.ghRefreshCartBadge();
  }

  function showEmpty(message) {
    if (gateEl) gateEl.style.display = 'none';
    if (rootEl) rootEl.style.display = 'none';
    if (emptyEl) {
      emptyEl.style.display = 'block';
      if (message) {
        var title = emptyEl.querySelector('h3');
        var body = emptyEl.querySelector('p');
        if (title) title.textContent = message.title;
        if (body) body.textContent = message.body;
      }
    }
  }

  function showGate() {
    if (gateEl) gateEl.style.display = 'block';
    if (rootEl) rootEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'none';
  }

  function itemPrice(product) {
    return Number(product.discountPrice) || Number(product.price) || 0;
  }

  function subtotalOf() {
    return currentItems.reduce(function (sum, entry) {
      var product = entry.product || {};
      return sum + itemPrice(product) * (parseInt(entry.quantity, 10) || 1);
    }, 0);
  }

  function deliveryFor(subtotal) {
    return subtotal >= FREE_DELIVERY_MIN ? 0 : DELIVERY_FEE;
  }

  function renderItems() {
    if (!itemsEl) return;
    itemsEl.innerHTML = '';
    currentItems.forEach(function (entry) {
      var product = entry.product || {};
      var price = itemPrice(product);
      var qty = parseInt(entry.quantity, 10) || 1;
      var img = window.ghAssetUrl
        ? window.ghAssetUrl((product.images && product.images[0]) || product.image || '')
        : (product.image || '');

      var item = document.createElement('div');
      item.className = 'gh-co-item';
      item.innerHTML =
        '<img src="' + (img || '../images/no-image.svg') + '" alt="' + String(product.name || 'Product').replace(/"/g, '&quot;') + '">' +
        '<div class="gh-co-item-info">' +
        '<span class="gh-co-item-name">' + String(product.name || 'Product') + '</span>' +
        '<div class="gh-co-item-price">' + money(price) + ' each</div>' +
        '</div>' +
        '<span class="gh-co-qty">x ' + qty + '</span>';
      itemsEl.appendChild(item);
      if (window.ghHandleImageError) window.ghHandleImageError(item.querySelector('img'));
    });
  }

  function renderBreakdown() {
    if (!breakdownEl) return;

    var subtotal, delivery, tax, discount, total;

    if (serverTotals) {
      // Server-verified totals are authoritative (payment uses these).
      subtotal = serverTotals.subtotal || 0;
      delivery = serverTotals.deliveryCharge || 0;
      tax = serverTotals.tax || 0;
      discount = serverTotals.discount || 0;
      total = serverTotals.total || 0;
    } else {
      subtotal = subtotalOf();
      delivery = deliveryFor(subtotal);
      tax = Math.round(subtotal * GST_RATE);
      discount = appliedCoupon ? appliedCoupon.discount : 0;
      total = subtotal + delivery + tax - discount;
    }

    var html =
      '<div class="gh-bd-row"><span>Subtotal</span><b>' + money(subtotal) + '</b></div>' +
      '<div class="gh-bd-row ' + (delivery === 0 ? 'gh-bd-free' : '') + '"><span>Delivery Charge</span><b>' + (delivery === 0 ? 'FREE' : money(delivery)) + '</b></div>' +
      '<div class="gh-bd-row"><span>GST (' + Math.round(GST_RATE * 100) + '%)</span><b>' + money(tax) + '</b></div>' +
      (discount > 0
        ? '<div class="gh-bd-row gh-bd-save"><span>Coupon Discount</span><b>- ' + money(discount) + '</b></div>'
        : '') +
      '<div class="gh-bd-row gh-bd-total"><span>Total</span><b>' + money(total) + '</b></div>';
    breakdownEl.innerHTML = html;
  }

  function renderCoupon() {
    if (!couponAppliedEl) return;
    if (appliedCoupon) {
      couponAppliedEl.style.display = 'flex';
      couponAppliedEl.innerHTML =
        '<span><i class="fa-solid fa-tag"></i> ' + String(appliedCoupon.code).toUpperCase() + ' applied (- ' + money(appliedCoupon.discount) + ')</span>' +
        '<button type="button" data-coupon-remove aria-label="Remove coupon"><i class="fa-solid fa-xmark"></i></button>';
      var removeBtn = couponAppliedEl.querySelector('[data-coupon-remove]');
      if (removeBtn) {
        removeBtn.addEventListener('click', function () {
          appliedCoupon = null;
          resetVerification();
          if (couponInput) couponInput.value = '';
          couponAppliedEl.style.display = 'none';
          renderBreakdown();
          toast('Coupon removed');
        });
      }
    } else {
      couponAppliedEl.style.display = 'none';
    }
  }

  function renderAll() {
    renderItems();
    renderBreakdown();
    renderCoupon();
  }

  // Drop a previously approved payload when anything that affects the
  // totals or quantities changes (coupon applied/removed, cart changed).
  function resetVerification() {
    verifiedPayload = null;
    serverTotals = null;
    hideNotice();
    if (placeText) placeText.innerHTML = 'Place Order';
    if (placeBtn) placeBtn.disabled = false;
  }

  function showNotice(html, kind) {
    if (!noticeEl) return;
    noticeEl.style.display = 'block';
    noticeEl.className = 'gh-co-notice' + (kind ? ' ' + kind : '');
    noticeEl.innerHTML = html;
  }

  function hideNotice() {
    if (!noticeEl) return;
    noticeEl.style.display = 'none';
    noticeEl.innerHTML = '';
  }

  // Renders the server-reported adjustments + the corrected total.
  function renderAdjustmentNotice(adjustments, totals) {
    if (!noticeEl) return;
    var lines = [];
    (adjustments || []).forEach(function (a) {
      var label = '"' + String(a.name || 'Item') + '"';
      if (a.removed) {
        lines.push(label + ' — removed' + (a.reason === 'unavailable' ? ' (no longer available)' : ' (out of stock)') + '.');
      } else {
        lines.push(label + ' — quantity reduced from ' + a.requested + ' to ' + a.finalQuantity + ' (only ' + a.available + ' in stock).');
      }
    });
    if (totals && totals.couponError) lines.push(String(totals.couponError) + '.');
    lines.push('Your new total is <b>' + money(totals ? totals.total : 0) + '</b>. Please review and confirm to continue.');

    noticeEl.style.display = 'block';
    noticeEl.className = 'gh-co-notice';
    noticeEl.innerHTML = '<b>Your order was adjusted:</b><br>' + lines.join('<br>');
  }

  // Takes over the Place Order button when there is nothing left to buy,
  // pointing the customer back to the cart/products page.
  function setPlaceUnavailable(label) {
    if (placeBtn) placeBtn.disabled = true;
    if (placeText) placeText.innerHTML = label || 'Nothing Available';
  }

  function setPlaceBusy(on, label) {
    if (!placeBtn || !placeText) return;
    placeBtn.disabled = on;
    placeText.innerHTML = on
      ? '<span class="gh-btn-spinner" aria-hidden="true"></span>' + (label || 'Placing Order...')
      : (label || 'Place Order');
  }

  // Apply the server-approved quantities + totals to the on-screen summary.
  function applyVerifiedPayload(payload) {
    var approved = {};
    (payload.items || []).forEach(function (it) {
      approved[String(it.productId)] = it;
    });

    currentItems = currentItems
      .filter(function (entry) {
        return entry.product && approved[String(entry.product._id)];
      })
      .map(function (entry) {
        var it = approved[String(entry.product._id)];
        if (it) entry.quantity = it.quantity;
        return entry;
      });

    serverTotals = payload.totals || {};

    // If the server had to drop the coupon, reflect that in the UI.
    if (serverTotals.couponCode) {
      if (appliedCoupon) appliedCoupon.discount = serverTotals.discount || 0;
    } else if (appliedCoupon) {
      appliedCoupon = null;
      if (couponInput) couponInput.value = '';
    }

    renderAll();
  }

  function applyCoupon() {
    if (!couponInput) return;
    var code = couponInput.value.trim();
    if (!code) {
      toast('Enter a coupon code', true);
      return;
    }
    if (couponApplyBtn) { couponApplyBtn.disabled = true; couponApplyBtn.textContent = '...'; }

    fetch(apiBase() + '/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code, amount: serverTotals ? serverTotals.subtotal : subtotalOf() }),
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) throw new Error(result.data.message || 'Invalid coupon');
        resetVerification();
        appliedCoupon = { code: result.data.code, discount: Number(result.data.discount) || 0 };
        if (couponInput) couponInput.value = result.data.code;
        renderAll();
        toast('Coupon applied - you saved ' + money(appliedCoupon.discount));
      })
      .catch(function (err) {
        toast((err && err.message) || 'Could not apply coupon', true);
      })
      .finally(function () {
        if (couponApplyBtn) { couponApplyBtn.disabled = false; couponApplyBtn.textContent = 'Apply'; }
      });
  }

  function loadProfile() {
    if (!window.ghApiRequest) return Promise.resolve();
    return window.ghApiRequest('/api/auth/me')
      .then(function (data) {
        var u = (data && data.user) || {};
        if (nameInput && u.name) nameInput.value = u.name;
        if (emailInput && u.email) emailInput.value = u.email;
        if (phoneInput && u.phone) phoneInput.value = u.phone;
        if (addressInput && u.address) addressInput.value = u.address;
      })
      .catch(function (err) {
        console.error('Failed to load profile:', err);
      });
  }

  function bindPaymentOptions() {
    var options = document.querySelectorAll('.gh-pay-option');
    Array.prototype.forEach.call(options, function (opt) {
      opt.addEventListener('click', function () {
        var radio = opt.querySelector('input[type="radio"]');
        if (!radio) return;
        radio.checked = true;
        Array.prototype.forEach.call(options, function (o) {
          o.classList.toggle('gh-active', o === opt);
        });
      });
    });
  }

  function validateForm() {
    var name = nameInput ? nameInput.value.trim() : '';
    var email = emailInput ? emailInput.value.trim() : '';
    var phone = phoneInput ? phoneInput.value.trim() : '';
    var address = addressInput ? addressInput.value.trim() : '';

    if (!name) { toast('Please enter your full name', true); return null; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Please enter a valid email address', true); return null; }
    if (!/^[0-9]{10}$/.test(phone)) { toast('Please enter a valid 10-digit phone number', true); return null; }
    if (!address) { toast('Please enter your delivery address', true); return null; }

    return {
      name: name,
      email: email,
      phone: phone,
      address: address +
        (cityInput && cityInput.value.trim() ? ', ' + cityInput.value.trim() : '') +
        (pincodeInput && pincodeInput.value.trim() ? ' - ' + pincodeInput.value.trim() : ''),
    };
  }

  function getPaymentMethod() {
    var checked = document.querySelector('.gh-pay-option input[type="radio"]:checked');
    return checked ? (checked.value || 'Cash on Delivery') : 'Cash on Delivery';
  }

  function clearCart() {
    // Buy Now never touches the persisted cart, so there is nothing to
    // clear — the customer's existing cart items must survive this order.
    if (isBuyNow) return Promise.resolve();
    var tasks = currentItems
      .filter(function (entry) { return entry._id; })
      .map(function (entry) {
        return window.ghApiRequest('/api/cart/' + encodeURIComponent(entry._id), { method: 'DELETE' })
          .catch(function (err) { console.error('Failed to clear cart item:', err); });
      });
    return Promise.all(tasks);
  }

  // Items as the server expects them (productId + quantity; the server
  // never trusts prices/quantities from the client).
  function buildOrderItems() {
    return currentItems
      .filter(function (entry) { return entry.product && entry.product._id; })
      .map(function (entry) {
        var product = entry.product;
        return {
          productId: product._id,
          name: product.name || 'Product',
          image: (product.images && product.images[0]) || product.image || '',
          price: itemPrice(product),
          quantity: parseInt(entry.quantity, 10) || 1,
        };
      });
  }

  function handlePlacementError(err, prefix) {
    var msg = (err && err.message) || prefix;
    // The only hard error the server returns is "everything is gone".
    if (String(msg).toLowerCase().indexOf('out of stock') !== -1) {
      setPlaceUnavailable('Nothing Available');
      showNotice(
        '<b>Sorry - the items in your order are out of stock.</b> ' +
        (isBuyNow
          ? '<a href="products.html">Browse products</a>.'
          : '<a href="cart.html">Back to cart</a> or <a href="products.html">browse products</a>.'),
        'error'
      );
      return;
    }
    toast(msg, true);
    setPlaceBusy(false);
  }

  // Charges the verified total and places the order with the
  // server-approved quantities.
  function confirmAndPay(payload, form) {
    var totals = payload.totals || {};
    var approvedProducts = (payload.items || []).map(function (it) {
      return {
        productId: it.productId,
        name: it.name,
        image: it.image || '',
        price: it.price,
        quantity: it.quantity,
      };
    });

    if (!approvedProducts.length) {
      toast('Your cart items are no longer available', true);
      setPlaceBusy(false);
      return;
    }

    setPlaceBusy(true);

    var isOnlinePayment = getPaymentMethod() !== 'Cash on Delivery';

    var payStep;
    try {
      payStep = isOnlinePayment
        ? window.ghRazorpayCheckout(totals.total, { name: form.name, email: form.email, phone: form.phone })
        : Promise.resolve({ success: true, paymentId: '' });
    } catch (err) {
      console.error('Failed to start payment:', err);
      setPlaceBusy(false);
      toast((err && err.message) || 'Could not start payment. Please try again.', true);
      return;
    }

    payStep
      .then(function (payRes) {
        if (!payRes.success) throw new Error(payRes.error || 'Payment was not completed');

        return window.ghApiRequest('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: form.name,
            customerEmail: form.email,
            customerPhone: form.phone,
            customerAddress: form.address,
            products: approvedProducts,
            couponCode: totals.couponCode || '',
            paymentMethod: getPaymentMethod(),
            razorpayPaymentId: payRes.paymentId || '',
          }),
        });
      })
      .then(function (data) {
        var order = (data && data.order) || {};
        if (data && data.adjusted && data.adjustments && data.adjustments.length) {
          toast('Stock changed at the last moment — your order was adjusted.', true);
        }
        return clearCart().then(function () {
          if (isBuyNow && window.ghClearBuyNowItem) window.ghClearBuyNowItem();
          toast('Order placed successfully');
          refreshBadge();
          setTimeout(function () {
            window.location.href = 'order-success.html?id=' + encodeURIComponent(order._id || '');
          }, 1200);
        });
      })
      .catch(function (err) {
        handlePlacementError(err, 'Could not place your order. Please try again.');
      });
  }

  function placeOrder() {
    if (!currentItems.length) {
      toast(isBuyNow ? 'This product is no longer available' : 'Your cart is empty', true);
      return;
    }
    var form = validateForm();
    if (!form) return;

    // Already verified with the server and nothing changed since:
    // go straight to payment with the approved payload.
    if (verifiedPayload) {
      confirmAndPay(verifiedPayload, form);
      return;
    }

    var itemsForServer = buildOrderItems();
    if (!itemsForServer.length) {
      toast(isBuyNow ? 'This product is no longer available' : 'Your cart items are no longer available', true);
      return;
    }

    setPlaceBusy(true, 'Checking stock...');

    // Re-validate against CURRENT stock BEFORE any payment is charged.
    // The server clamps quantities and returns the corrected summary.
    window.ghApiRequest('/api/orders/preflight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products: itemsForServer,
        couponCode: appliedCoupon ? appliedCoupon.code : '',
      }),
    })
      .then(function (data) {
        if (!data || !data.success) {
          throw new Error((data && data.message) || 'Could not check your order');
        }

        var totals = data.totals || {};
        var adjustments = data.adjustments || [];

        // Everything in the cart is gone — clear path back, no dead end.
        if (data.allOutOfStock || !data.items || !data.items.length) {
          setPlaceUnavailable('Nothing Available');
          showNotice(
            '<b>Sorry - everything in your order is currently out of stock.</b> ' +
            (isBuyNow
              ? '<a href="products.html">Browse products</a>.'
              : '<a href="cart.html">Back to cart</a> or <a href="products.html">browse products</a>.'),
            'error'
          );
          return;
        }

        verifiedPayload = { items: data.items, totals: totals, adjustments: adjustments };

        if (adjustments.length || data.adjusted) {
          // Show exactly what changed and ask the customer to confirm.
          applyVerifiedPayload(verifiedPayload);
          renderAdjustmentNotice(adjustments, totals);
          setPlaceBusy(false, 'Confirm & Place Order');
          toast('Your order was adjusted — please review and confirm.', true);
        } else {
          // Quantities are already fine: charge and place directly.
          hideNotice();
          confirmAndPay(verifiedPayload, form);
        }
      })
      .catch(function (err) {
        handlePlacementError(err, 'Could not check your order. Please try again.');
      });
  }

  // Buy Now (isolated single-item checkout): load JUST the product that
  // was selected on the product page. The persisted cart is never fetched
  // and the guest cart is never synced — both stay exactly as they were.
  function bootBuyNow(item) {
    isBuyNow = true;
    return window.ghApiRequest('/api/products/' + encodeURIComponent(item.productId))
      .then(function (data) {
        var product = (data && data.product) || null;
        var stock = Number(product && product.stock) || 0;

        if (!product || !product._id || stock <= 0) {
          throw new Error('This product is no longer available');
        }

        var requested = Math.max(1, parseInt(item.quantity, 10) || 1);
        var qty = Math.min(requested, stock);
        currentItems = [{ product: product, quantity: qty }];

        if (qty < requested) {
          toast('Only ' + stock + ' in stock - quantity adjusted to ' + qty + '.', true);
        }

        if (gateEl) gateEl.style.display = 'none';
        if (rootEl) rootEl.style.display = 'grid';
        if (emptyEl) emptyEl.style.display = 'none';
        bindPaymentOptions();
        renderAll();
      })
      .catch(function (err) {
        console.error('Failed to load Buy Now item:', err);
        showEmpty({
          title: 'This product is no longer available',
          body: 'It may have sold out or is no longer active. Browse our other plants instead.',
        });
      });
  }

  function init() {
    if (!window.ghIsLoggedIn || !window.ghIsLoggedIn()) {
      showGate();
      return;
    }

    // Arrived via "Buy Now" -> check out exactly the single selected
    // product, isolated from the persistent cart (which stays untouched).
    var buyNowItem = window.ghGetBuyNowItem ? window.ghGetBuyNowItem() : null;
    if (buyNowItem) {
      bootBuyNow(buyNowItem);
      return;
    }

    var boot = Promise.resolve();
    if (window.ghSyncGuestCartToServer) {
      boot = Promise.resolve(window.ghSyncGuestCartToServer()).catch(function () {});
    }
    boot
      .then(function () { return loadProfile(); })
      .then(function () {
        return window.ghApiRequest('/api/cart');
      })
      .then(function (data) {
        currentItems = (data && data.cart) || [];
        if (!currentItems.length) {
          showEmpty();
          return;
        }
        if (gateEl) gateEl.style.display = 'none';
        if (rootEl) rootEl.style.display = 'grid';
        if (emptyEl) emptyEl.style.display = 'none';
        bindPaymentOptions();
        renderAll();
      })
      .catch(function (err) {
        console.error('Failed to load cart for checkout:', err);
        toast((err && err.message) || 'Could not load your cart', true);
        showEmpty();
      });
  }

  if (couponApplyBtn) couponApplyBtn.addEventListener('click', applyCoupon);
  if (couponInput) {
    couponInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyCoupon();
      }
    });
  }
  if (placeBtn) placeBtn.addEventListener('click', placeOrder);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
