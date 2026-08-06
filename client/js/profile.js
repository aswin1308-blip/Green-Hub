/* ==========================================
        GREEN HUB - PROFILE.JS
        Profile page (premium design):
        - Login gate + prefill from /api/auth/me
        - Update profile via PUT /api/auth/me
        - Logout
========================================== */

(function () {
  'use strict';

  var gateEl = document.querySelector('[data-profile-gate]');
  var rootEl = document.querySelector('[data-profile-root]');
  var form = document.querySelector('[data-profile-form]');
  var submitText = document.querySelector('[data-profile-submit-text]');

  var nameInput = document.getElementById('profile-name');
  var emailInput = document.getElementById('profile-email');
  var phoneInput = document.getElementById('profile-phone');
  var addressInput = document.getElementById('profile-address');
  var displayName = document.getElementById('profile-display-name');
  var displayEmail = document.getElementById('profile-display-email');
  var logoutBtn = document.getElementById('profile-logout');

  function toast(msg, isError) {
    if (window.showToast) { window.showToast(msg, isError); return; }
    alert(msg);
  }

  function showGate() {
    if (gateEl) gateEl.style.display = 'block';
    if (rootEl) rootEl.style.display = 'none';
  }

  function showRoot() {
    if (gateEl) gateEl.style.display = 'none';
    if (rootEl) rootEl.style.display = 'grid';
  }

  function loadProfile() {
    if (typeof window.ghApiRequest !== 'function') return Promise.resolve();
    return window.ghApiRequest('/api/auth/me')
      .then(function (data) {
        var u = (data && data.user) || {};
        if (nameInput) nameInput.value = u.name || '';
        if (emailInput) emailInput.value = u.email || '';
        if (phoneInput) phoneInput.value = u.phone || '';
        if (addressInput) addressInput.value = u.address || '';
        if (displayName) displayName.textContent = u.name || 'Customer';
        if (displayEmail) displayEmail.textContent = u.email || '';
        return u;
      })
      .catch(function (err) {
        console.error('Failed to load profile:', err);
        toast((err && err.message) || 'Could not load your profile.', true);
        return {};
      });
  }

  function init() {
    if (typeof window.ghIsLoggedIn !== 'function' || !window.ghIsLoggedIn()) {
      showGate();
      return;
    }

    showRoot();

    var cached = (typeof window.ghGetUser === 'function') ? window.ghGetUser() : null;
    if (cached) {
      if (nameInput) nameInput.value = cached.name || '';
      if (emailInput) emailInput.value = cached.email || '';
      if (phoneInput) phoneInput.value = cached.phone || '';
      if (addressInput) addressInput.value = cached.address || '';
      if (displayName) displayName.textContent = cached.name || 'Customer';
      if (displayEmail) displayEmail.textContent = cached.email || '';
    }

    loadProfile();

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();

        var name = nameInput ? nameInput.value.trim() : '';
        var email = emailInput ? emailInput.value.trim() : '';
        var phone = phoneInput ? phoneInput.value.trim() : '';
        var address = addressInput ? addressInput.value.trim() : '';

        if (!name || !email) {
          toast('Name and email are required', true);
          return;
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          toast('Please enter a valid email address', true);
          return;
        }

        var submitBtn = form.querySelector('button[type="submit"]');
        var originalText = submitText ? submitText.textContent : '';
        if (submitBtn) submitBtn.disabled = true;
        if (submitText) submitText.textContent = 'Saving...';

        window.ghApiRequest('/api/auth/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, email: email, phone: phone, address: address }),
        })
          .then(function (data) {
            var u = (data && data.user) || { name: name, email: email, phone: phone, address: address };
            if (typeof window.ghSetSession === 'function') {
              window.ghSetSession(window.ghGetToken(), u);
            }
            if (displayName) displayName.textContent = u.name || name;
            if (displayEmail) displayEmail.textContent = u.email || email;
            toast('Profile Updated Successfully');
          })
          .catch(function (err) {
            console.error('Profile update failed:', err);
            toast((err && err.message) || 'Could not update your profile.', true);
          })
          .finally(function () {
            if (submitBtn) submitBtn.disabled = false;
            if (submitText) submitText.textContent = originalText;
          });
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        if (typeof window.ghClearSession === 'function') window.ghClearSession();
        toast('Logged out');
        setTimeout(function () {
          window.location.href = 'login.html';
        }, 600);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
