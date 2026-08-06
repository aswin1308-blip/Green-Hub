/* ==========================================
        GREEN HUB - CHECKOUT.JS (premium)
        Login gate + order summary + GST +
        coupon + payment + place order.
        - Loads the cart from MongoDB (guest cart
          is synced to the server on entry)
        - Places the order via POST /api/orders
        - Clears the cart and redirects to
          order-success.html?id=<orderId>
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

  function apiBase() {
    return (window.GH_API_BASE) || 'http://localhost:5000';
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

  function showEmpty() {
    if (gateEl) gateEl.style.display = 'none';
    if (rootEl) rootEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
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
    var subtotal = subtotalOf();
    var delivery = deliveryFor(subtotal);
    var tax = Math.round(subtotal * GST_RATE);
    var discount = appliedCoupon ? appliedCoupon.discount : 0;
    var total = subtotal + delivery + tax - discount;

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
      body: JSON.stringify({ code: code, amount: subtotalOf() }),
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) throw new Error(result.data.message || 'Invalid coupon');
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

  function setPlaceBusy(on) {
    if (!placeBtn || !placeText) return;
    placeBtn.disabled = on;
    placeText.innerHTML = on
      ? '<span class="gh-btn-spinner" aria-hidden="true"></span>Placing Order...'
      : 'Place Order';
  }

  function clearCart() {
    var tasks = currentItems
      .filter(function (entry) { return entry._id; })
      .map(function (entry) {
        return window.ghApiRequest('/api/cart/' + encodeURIComponent(entry._id), { method: 'DELETE' })
          .catch(function (err) { console.error('Failed to clear cart item:', err); });
      });
    return Promise.all(tasks);
  }

  function placeOrder() {
    if (!currentItems.length) {
      toast('Your cart is empty', true);
      return;
    }
    var form = validateForm();
    if (!form) return;

    var subtotal = subtotalOf();
    var delivery = deliveryFor(subtotal);
    var tax = Math.round(subtotal * GST_RATE);
    var discount = appliedCoupon ? appliedCoupon.discount : 0;
    var total = subtotal + delivery + tax - discount;

    var products = currentItems
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

    if (!products.length) {
      toast('Your cart items are no longer available', true);
      return;
    }

    setPlaceBusy(true);

    var isOnlinePayment = getPaymentMethod() !== 'Cash on Delivery';

    // For online methods, run the Razorpay checkout first. If the user
    // cancels or the payment fails, we abort and keep the cart intact.
    var payStep;
    try {
      payStep = isOnlinePayment
        ? window.ghRazorpayCheckout(total, { name: form.name, email: form.email, phone: form.phone })
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
            products: products,
            subtotal: subtotal,
            deliveryCharge: delivery,
            tax: tax,
            discount: discount,
            couponCode: appliedCoupon ? appliedCoupon.code : '',
            total: total,
            paymentMethod: getPaymentMethod(),
            razorpayPaymentId: payRes.paymentId || '',
          }),
        });
      })
      .then(function (data) {
        var order = (data && data.order) || {};
        return clearCart().then(function () {
          toast('Order placed successfully');
          refreshBadge();
          setTimeout(function () {
            window.location.href = 'order-success.html?id=' + encodeURIComponent(order._id || '');
          }, 1200);
        });
      })
      .catch(function (err) {
        toast((err && err.message) || 'Could not place your order. Please try again.', true);
        setPlaceBusy(false);
      });
  }

  function init() {
    if (!window.ghIsLoggedIn || !window.ghIsLoggedIn()) {
      showGate();
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
