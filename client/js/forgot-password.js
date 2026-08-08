/* ==========================================
        GREEN HUB - FORGOT-PASSWORD.JS
        Password reset flow, reusing the existing
        ghApiRequest() helper + auth UI styles.

        Works in two layouts:
        - Modal  : #forgot-modal on login.html
        - Page   : #fp-step-email / #fp-step-code /
                   #fp-step-password / #fp-step-success
                   on forgot-password.html

        Flow: email -> POST /api/auth/forgot-password
              code  -> POST /api/auth/verify-reset-code
              new   -> POST /api/auth/reset-password
========================================== */

(function () {
  'use strict';

  var RESEND_COOLDOWN = 60; // seconds

  /* ---------- layout detection ---------- */

  var modal = document.getElementById('forgot-modal');
  var pageMode = !!document.getElementById('fp-step-email');

  var stepEls = {
    email: (modal && modal.querySelector('[data-forgot-step="email"]')) || document.getElementById('fp-step-email'),
    code: (modal && document.getElementById('forgot-step-code')) || document.getElementById('fp-step-code'),
    password: (modal && document.getElementById('forgot-step-password')) || document.getElementById('fp-step-password'),
    success: (modal && document.getElementById('forgot-success')) || document.getElementById('fp-step-success'),
  };

  var emailInput = document.getElementById('fp-email') || document.getElementById('forgot-email');
  var codeInput = document.getElementById('fp-code') || document.getElementById('forgot-code');
  var passwordInput = document.getElementById('fp-password') || document.getElementById('forgot-password');
  var confirmInput = document.getElementById('fp-confirm') || document.getElementById('forgot-confirm');
  var codeEmailLabel = document.getElementById('fp-code-email') || document.getElementById('forgot-code-email');
  var resendBtn = document.getElementById('fp-resend') || document.querySelector('[data-forgot-resend]');
  var resendTimer = document.getElementById('fp-resend-timer') || document.getElementById('forgot-resend-timer');

  var state = {
    email: '',
    cooldownLeft: 0,
  };

  /* ---------- modal helpers ---------- */

  function openModal() {
    if (!modal) return;
    modal.classList.add('gh-show');
    document.body.classList.add('gh-lock');
    if (emailInput) setTimeout(function () { emailInput.focus(); }, 120);
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('gh-show');
    if (
      !document.querySelector('.gh-search-overlay.gh-show') &&
      !document.querySelector('.gh-drawer-cart.gh-open') &&
      !document.querySelector('.gh-drawer.gh-open')
    ) {
      document.body.classList.remove('gh-lock');
    }
  }

  /* ---------- shared UI helpers ---------- */

  function errorElFor(step) {
    if (modal) {
      if (step === 'email') return document.getElementById('forgot-error');
      if (step === 'code') return document.getElementById('forgot-error-step2');
      if (step === 'password') return document.getElementById('forgot-error-step3');
      return null;
    }
    if (!stepEl(step)) return null;
    return stepEl(step).querySelector('.auth-error');
  }

  function stepEl(step) {
    return stepEls[step];
  }

  function showError(step, message) {
    var el = errorElFor(step);
    if (el) {
      el.textContent = message;
      el.hidden = false;
    }
    if (window.showToast) window.showToast(message, true);
  }

  function hideError(step) {
    var el = errorElFor(step);
    if (el) el.hidden = true;
  }

  function showStep(step) {
    Object.keys(stepEls).forEach(function (key) {
      if (stepEls[key]) stepEls[key].hidden = key !== step;
    });
    if (step === 'email' && emailInput) emailInput.focus();
    if (step === 'code' && codeInput) codeInput.focus();
    if (step === 'password' && passwordInput) passwordInput.focus();
  }

  function setBusy(btn, busy, label) {
    if (!btn) return;
    btn.disabled = busy;
    if (label) btn.textContent = label;
  }

  function normalizeError(error, fallback) {
    return (error && error.message) || fallback;
  }

  function startResendCooldown() {
    state.cooldownLeft = RESEND_COOLDOWN;
    if (resendBtn) resendBtn.disabled = true;
    if (resendTimer) {
      resendTimer.hidden = false;
      resendTimer.textContent = '(' + state.cooldownLeft + 's)';
    }
    var timer = setInterval(function () {
      state.cooldownLeft -= 1;
      if (resendTimer) {
        resendTimer.textContent = '(' + state.cooldownLeft + 's)';
        if (state.cooldownLeft <= 0) resendTimer.textContent = '';
      }
      if (state.cooldownLeft <= 0) {
        clearInterval(timer);
        if (resendBtn) resendBtn.disabled = false;
        if (resendTimer) resendTimer.hidden = true;
      }
    }, 1000);
  }

  /* ---------- STEP 1 — request code ---------- */

  function submitEmail() {
    var email = emailInput ? emailInput.value.trim() : '';

    if (!email) {
      showError('email', 'Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('email', 'Please enter a valid email address.');
      return;
    }

    hideError('email');
    var widgets = getSubmitBlock('email');
    setBusy(widgets.primaryBtn, true, widgets.primaryBusy);

    window.ghApiRequest('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email }),
    })
      .then(function (data) {
        state.email = email;
        startResendCooldown();
        showStep('code');
        if (codeEmailLabel) codeEmailLabel.textContent = email;
        if (window.showToast) {
          window.showToast(
            (data && data.message) ||
              'If an account exists with this email, a verification code has been sent.'
          );
        }
      })
      .catch(function (error) {
        showError('email', normalizeError(error, 'Could not send the code. Please try again.'));
      })
      .finally(function () {
        setBusy(widgets.primaryBtn, false, widgets.primaryLabel);
      });
  }

  /* ---------- STEP 2 — verify code ---------- */

  function submitCode() {
    var code = codeInput ? codeInput.value.trim() : '';

    if (!/^[0-9]{6}$/.test(code)) {
      showError('code', 'Please enter the 6-digit verification code.');
      return;
    }

    hideError('code');
    var widgets = getSubmitBlock('code');
    setBusy(widgets.primaryBtn, true, widgets.primaryBusy);

    window.ghApiRequest('/api/auth/verify-reset-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: state.email, code: code }),
    })
      .then(function (data) {
        showStep('password');
        if (window.showToast) {
          window.showToast((data && data.message) || 'Code verified');
        }
      })
      .catch(function (error) {
        showError('code', normalizeError(error, 'Invalid verification code.'));
      })
      .finally(function () {
        setBusy(widgets.primaryBtn, false, widgets.primaryLabel);
      });
  }

  /* ---------- resend code ---------- */

  function resendCode() {
    if (!state.email) {
      showStep('email');
      return;
    }

    if (resendBtn) {
      resendBtn.disabled = true;
      resendBtn.textContent = 'Sending...';
    }

    window.ghApiRequest('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: state.email }),
    })
      .then(function (data) {
        startResendCooldown();
        if (window.showToast) {
          window.showToast(
            (data && data.message) || 'A new verification code has been sent.'
          );
        }
      })
      .catch(function (error) {
        showError('code', normalizeError(error, 'Could not resend the code. Please try again.'));
        if (resendBtn) resendBtn.textContent = 'Resend Code';
      });
  }

  /* ---------- STEP 3 — new password ---------- */

  function submitPassword() {
    var password = passwordInput ? passwordInput.value : '';
    var confirm = confirmInput ? confirmInput.value : '';

    if (!password || !confirm) {
      showError('password', 'Please fill in both password fields.');
      return;
    }
    if (password.length < 6) {
      showError('password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      showError('password', 'Passwords do not match.');
      return;
    }

    hideError('password');
    var widgets = getSubmitBlock('password');
    setBusy(widgets.primaryBtn, true, widgets.primaryBusy);

    window.ghApiRequest('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: state.email,
        code: codeInput ? codeInput.value.trim() : '',
        password: password,
      }),
    })
      .then(function (data) {
        showStep('success');
        if (window.showToast) {
          window.showToast((data && data.message) || 'Password reset successfully!');
        }
      })
      .catch(function (error) {
        showError(
          'password',
          normalizeError(error, 'Could not reset your password. Please try again.')
        );
      })
      .finally(function () {
        setBusy(widgets.primaryBtn, false, widgets.primaryLabel);
      });
  }

  /* ---------- button/labels per layout ---------- */

  function getSubmitBlock(step) {
    if (modal) {
      if (step === 'email') {
        return {
          primaryBtn: modal.querySelector('[data-forgot-send]'),
          primaryLabel: 'Send Code',
          primaryBusy: 'Sending...',
        };
      }
      if (step === 'code') {
        return {
          primaryBtn: modal.querySelector('[data-forgot-verify]'),
          primaryLabel: 'Verify Code',
          primaryBusy: 'Verifying...',
        };
      }
      return {
        primaryBtn: modal.querySelector('[data-forgot-submit]'),
        primaryLabel: 'Reset Password',
        primaryBusy: 'Resetting...',
      };
    }

    var form = {
      email: document.getElementById('fp-step-email'),
      code: document.getElementById('fp-step-code'),
      password: document.getElementById('fp-step-password'),
    }[step];

    var btn = form ? form.querySelector('button[type="submit"]') : null;
    var labels = {
      email: ['Send Code', 'Sending...'],
      code: ['Verify Code', 'Verifying...'],
      password: ['Reset Password', 'Resetting...'],
    };
    return {
      primaryBtn: btn,
      primaryLabel: labels[step][0],
      primaryBusy: labels[step][1],
    };
  }

  /* ---------- wiring ---------- */

  if (pageMode) {
    var emailForm = document.getElementById('fp-step-email');
    var codeForm = document.getElementById('fp-step-code');
    var passwordForm = document.getElementById('fp-step-password');

    if (emailForm) emailForm.addEventListener('submit', function (e) { e.preventDefault(); submitEmail(); });
    if (codeForm) codeForm.addEventListener('submit', function (e) { e.preventDefault(); submitCode(); });
    if (passwordForm) passwordForm.addEventListener('submit', function (e) { e.preventDefault(); submitPassword(); });
  } else if (modal) {
    var sendBtn = modal.querySelector('[data-forgot-send]');
    if (sendBtn) sendBtn.addEventListener('click', submitEmail);

    var verifyBtn = modal.querySelector('[data-forgot-verify]');
    if (verifyBtn) verifyBtn.addEventListener('click', submitCode);

    var submitBtn = modal.querySelector('[data-forgot-submit]');
    if (submitBtn) submitBtn.addEventListener('click', submitPassword);

    var resendLink = modal.querySelector('[data-forgot-resend]');
    if (resendLink) resendLink.addEventListener('click', resendCode);

    var loginBtn = modal.querySelector('[data-forgot-login]');
    if (loginBtn) loginBtn.addEventListener('click', function () { window.location.href = 'login.html'; });

    Array.prototype.forEach.call(modal.querySelectorAll('[data-forgot-close]'), function (b) {
      b.addEventListener('click', closeModal);
    });

    var openLink = document.getElementById('forgot-password-link');
    if (openLink) openLink.addEventListener('click', function (e) {
      e.preventDefault();
      showStep('email');
      openModal();
    });

    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
  }

  if (resendBtn && !modal) {
    // Page layout: resend is a secondary button
    resendBtn.addEventListener('click', resendCode);
  }

  /* ---------- code input UX (digits only) ---------- */

  if (codeInput) {
    codeInput.addEventListener('input', function () {
      this.value = this.value.replace(/[^0-9]/g, '').slice(0, 6);
    });
  }

  if (pageMode) showStep('email');
})();