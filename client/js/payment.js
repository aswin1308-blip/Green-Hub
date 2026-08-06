/* ==========================================
        GREEN HUB - PAYMENT.JS (Razorpay)
        Reusable Razorpay checkout helper.

        window.ghRazorpayCheckout(amount, meta)
        -> Promise<{ success: boolean, error?, paymentId?, razorpayOrderId? }>

        Flow:
        1. POST /api/payment/create-order  { amount (INR) }
        2. Open Razorpay Checkout modal (key_id comes from the server response)
        3. On success: POST /api/payment/verify-payment with the signature trio
        4. Resolves with success/failure — the caller decides what to do next
========================================== */

(function () {
  'use strict';

  function apiBase() {
    return window.GH_API_BASE || 'http://localhost:5000';
  }

  function toast(msg, isError) {
    if (window.showToast) { window.showToast(msg, isError); return; }
    alert(msg);
  }

  function verifyPayment(response) {
    return fetch(apiBase() + '/api/payment/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (result.ok && result.data.success) return { success: true };
        return { success: false, error: (result.data && result.data.error) || 'Payment verification failed' };
      })
      .catch(function () {
        return { success: false, error: 'Could not reach payment verification' };
      });
  }

  window.ghRazorpayCheckout = function (amount, meta) {
    return new Promise(function (resolve) {
      if (typeof window.Razorpay === 'undefined') {
        toast('Razorpay SDK failed to load. Please retry.', true);
        resolve({ success: false, error: 'Razorpay SDK not loaded' });
        return;
      }

      fetch(apiBase() + '/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount) }),
      })
        .then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, data: data }; });
        })
        .then(function (result) {
          if (!result.ok || !result.data.id) {
            throw new Error((result.data && result.data.error) || 'Could not create payment order');
          }
          var order = result.data;

          var rzOptions = {
            key: order.key_id,
            amount: order.amount,
            currency: order.currency || 'INR',
            name: 'Green Hub',
            description: 'Plant purchase',
            order_id: order.id,
            prefill: {
              name: (meta && meta.name) || '',
              email: (meta && meta.email) || '',
              contact: (meta && meta.phone) || '',
            },
            theme: { color: '#2E7D32' },
            handler: function (response) {
              verifyPayment(response).then(function (vres) {
                if (vres.success) {
                  toast('Payment successful');
                  resolve({
                    success: true,
                    paymentId: response.razorpay_payment_id,
                    razorpayOrderId: response.razorpay_order_id,
                  });
                } else {
                  toast(vres.error || 'Payment verification failed', true);
                  resolve({ success: false, error: vres.error || 'Payment verification failed' });
                }
              });
            },
            modal: {
              ondismiss: function () {
                resolve({ success: false, error: 'Payment cancelled by user' });
              },
            },
          };

          var rz = new window.Razorpay(rzOptions);
          rz.on('payment.failed', function (res) {
            var desc = (res.error && res.error.description) ? res.error.description : 'Payment failed';
            toast(desc, true);
            resolve({ success: false, error: desc });
          });
          rz.open();
        })
        .catch(function (err) {
          toast((err && err.message) || 'Could not start payment', true);
          resolve({ success: false, error: (err && err.message) || 'Could not start payment' });
        });
    });
  };
})();
