/* ==========================================
        GREEN HUB - ORDER-SUCCESS.JS
        Fetches the placed order by ?id= and
        renders a summary on the success page.
========================================== */

(function () {
  var orderIdEl = document.querySelector('[data-order-id]');
  var orderBox = document.querySelector('[data-order-box]');
  var orderDetailsEl = document.querySelector('[data-order-details]');

  function money(n) {
    return window.ghMoney ? window.ghMoney(n) : '₹' + Number(n || 0).toLocaleString('en-IN');
  }

  function apiBase() {
    return (window.GH_API_BASE) || 'http://localhost:5000';
  }

  function row(label, valueHtml, extraClass) {
    return '<div class="gh-order-row ' + (extraClass || '') + '"><span>' + label + '</span><b>' + valueHtml + '</b></div>';
  }

  function init() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');

    if (orderIdEl && id) {
      orderIdEl.textContent = id.toUpperCase();
    }

    if (!id || !window.ghApiRequest || !window.ghIsLoggedIn || !window.ghIsLoggedIn()) {
      return;
    }

    window.ghApiRequest('/api/orders/' + encodeURIComponent(id))
      .then(function (data) {
        var order = (data && data.order) || null;
        if (!order) return;

        if (orderBox) orderBox.style.display = 'block';

        var items = (order.products || []).map(function (p) {
          return row(p.name || 'Product', 'x ' + (parseInt(p.quantity, 10) || 1) + ' &middot; ' + money(p.price * (parseInt(p.quantity, 10) || 1)));
        }).join('');

        var statusBadge = '<span class="gh-badge-pill">' + String(order.status || 'Pending') + '</span>';

        orderDetailsEl.innerHTML =
          items +
          row('Payment Method', String(order.paymentMethod || 'Cash on Delivery')) +
          (Number(order.deliveryCharge) > 0 ? row('Delivery Charge', money(order.deliveryCharge)) : '') +
          (Number(order.tax) > 0 ? row('GST', money(order.tax)) : '') +
          (Number(order.discount) > 0 ? row('Coupon Discount', '- ' + money(order.discount)) : '') +
          row('Total Amount', money(order.total), 'gh-order-total') +
          row('Status', statusBadge);
      })
      .catch(function (err) {
        console.error('Failed to load order details:', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
