(function () {
  'use strict';

  if (typeof window.GH_API_BASE === 'undefined') {
    window.GH_API_BASE = 'https://greenhub1.onrender.com';
  }

  var API = window.GH_API_BASE;
  var TOAST_TIMER = null;
  var QUICK_VIEW_CACHE = {};
  var WISHLIST_IDS = new Set();
  var HERO_TIMER = null;
  var SEARCH_TIMER = null;
  var RECENT_KEY = 'gh_recent';
  var RECENT_SEARCH_KEY = 'gh_recent_searches';
  var THEME_KEY = 'gh_theme';

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(str) { return String(str == null ? '' : str); }
  function escAttr(str) { return esc(str).replace(/"/g, '&quot;'); }

  function ghFetchJSON(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('Request failed (' + res.status + ')');
      return res.json();
    });
  }

  function ghMoney(n) {
    if (typeof window.ghMoney === 'function') return window.ghMoney(n);
    return '₹' + Number(n || 0).toLocaleString('en-IN');
  }

  function ghAssetUrl(p) {
    if (typeof window.ghAssetUrl === 'function') return window.ghAssetUrl(p);
    if (!p) return '';
    if (/^https?:\/\//.test(p)) return p;
    return API + (p.charAt(0) === '/' ? '' : '/') + p;
  }

  function ghHandleImageError(img) {
    if (typeof window.ghHandleImageError === 'function') {
      window.ghHandleImageError(img);
      return;
    }
    if (!img) return;
    img.addEventListener('error', function () {
      if (img.dataset.ghFallback) return;
      img.dataset.ghFallback = '1';
      img.src = '../images/no-image.svg';
    });
  }

  function ghLoggedIn() {
    return typeof window.ghIsLoggedIn === 'function' && window.ghIsLoggedIn();
  }

  function ghApi(path, opts) {
    if (typeof window.ghApiRequest === 'function') return window.ghApiRequest(path, opts);
    opts = opts || {};
    opts.headers = opts.headers || {};
    return fetch(API + path, opts).then(function (res) {
      return res.json().then(function (d) {
        if (!res.ok) throw new Error((d && d.message) || 'Request failed');
        return d;
      });
    });
  }

  function ghAddToCartApi(productId, qty) {
    if (typeof window.ghAddToCart === 'function') {
      return window.ghAddToCart(productId, qty);
    }
    return ghApi('/api/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: productId, quantity: qty })
    });
  }

  function ghWishlistAdd(productId) {
    if (typeof window.ghAddToWishlist === 'function') return window.ghAddToWishlist(productId);
    return ghApi('/api/wishlist/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: productId })
    });
  }

  function ghWishlistRemove(productId) {
    if (typeof window.ghRemoveFromWishlist === 'function') return window.ghRemoveFromWishlist(productId);
    return ghApi('/api/wishlist/' + encodeURIComponent(productId), { method: 'DELETE' });
  }

  function ghWishlistGet() {
    if (typeof window.ghGetWishlist === 'function') return window.ghGetWishlist();
    return ghApi('/api/wishlist').then(function (d) {
      return (d.wishlist || []).map(function (e) { return e.product; }).filter(Boolean);
    });
  }

  function ghGuestCart() {
    try {
      var items = JSON.parse(localStorage.getItem('guestCart')) || [];
      return Array.isArray(items) ? items : [];
    } catch (e) { return []; }
  }

  function ghSaveGuestCart(items) {
    localStorage.setItem('guestCart', JSON.stringify(items));
  }

  function ghDiscountPercent(p) {
    var price = Number(p.price) || 0;
    var disc = Number(p.discountPrice) || 0;
    if (disc <= 0 || price <= 0 || disc >= price) return 0;
    return Math.round(((price - disc) / price) * 100);
  }

  function ghRatingOf(id) {
    var h = 0;
    var s = String(id || '');
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    h = Math.abs(h);
    var rate = (4 + (h % 11) / 10).toFixed(1);
    var count = 14 + (h % 187);
    return { rate: rate, count: count };
  }

  function ghStars(rate) {
    var full = Math.round(Number(rate));
    var html = '';
    for (var i = 1; i <= 5; i++) {
      html += '<i class="fa' + (i <= full ? 's' : 'r') + ' fa-star"></i>';
    }
    return html;
  }

  function showToast(message, isError) {
    var toast = $('.gh-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'gh-toast';
      document.body.appendChild(toast);
    }
    toast.className = 'gh-toast gh-show' + (isError ? ' gh-error' : '');
    toast.innerHTML = '<i class="fa-solid fa-' + (isError ? 'triangle-exclamation' : 'circle-check') + '"></i><span>' + esc(message) + '</span>';
    clearTimeout(TOAST_TIMER);
    TOAST_TIMER = setTimeout(function () {
      toast.classList.remove('gh-show');
    }, 2800);
  }

  window.updateCartCount = function (count) {
    var value = Number(count) || 0;
    $$('.gh-cart-badge').forEach(function (badge) {
      badge.textContent = value > 99 ? '99+' : String(value);
      badge.classList.toggle('gh-show', value > 0);
    });
  };

  window.showToast = showToast;

  function refreshBadge() {
    if (typeof window.ghRefreshCartBadge === 'function') {
      window.ghRefreshCartBadge();
    }
  }

  function lockBody(lock) {
    document.body.classList.toggle('gh-lock', lock);
  }

  function closeAllOverlays() {
    $$('.gh-search-overlay, .gh-modal, .gh-drawer-cart, .gh-drawer, .gh-backdrop').forEach(function (el) {
      el.classList.remove('gh-show', 'gh-open');
    });
    lockBody(false);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAllOverlays();
    if (e.key === '/' && !$('input:focus, textarea:focus')) {
      e.preventDefault();
      openSearch();
    }
  });

  $$('.gh-backdrop').forEach(function (b) {
    b.addEventListener('click', closeAllOverlays);
  });

  /* ---------------- theme ---------------- */

  function applyTheme(theme, persist) {
    document.documentElement.setAttribute('data-theme', theme);
    if (persist !== false) localStorage.setItem(THEME_KEY, theme);
    $$('.gh-theme-toggle i').forEach(function (i) {
      i.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    });
  }

  (function initTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    var theme = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(theme, !!saved);
  })();

  function bindThemeToggle() {
    $$('.gh-theme-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        showToast(next === 'dark' ? 'Dark mode enabled' : 'Light mode enabled');
      });
    });
  }

  /* ---------------- header scroll ---------------- */

  function bindHeaderScroll() {
    var header = $('.gh-header');
    if (!header) return;
    var onScroll = function () {
      header.classList.toggle('gh-header--scrolled', window.scrollY > 6);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------- mobile drawer ---------------- */

  function bindDrawer() {
    var drawer = $('.gh-drawer');
    var backdrop = $('.gh-backdrop');
    if (!drawer || !backdrop) return;

    $$('.gh-hamburger').forEach(function (h) {
      h.addEventListener('click', function () {
        drawer.classList.add('gh-open');
        backdrop.classList.add('gh-show');
        lockBody(true);
      });
    });

    $$('.gh-drawer-close').forEach(function (b) {
      b.addEventListener('click', closeAllOverlays);
    });

    $$('.gh-drawer-link[data-sub]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var sub = document.getElementById(link.dataset.sub);
        if (!sub) return;
        var open = sub.classList.contains('gh-open');
        $$('.gh-drawer-sub').forEach(function (s) { s.classList.remove('gh-open'); });
        if (!open) sub.classList.add('gh-open');
      });
    });
  }

  /* ---------------- hero slider ---------------- */

  function buildHeroSlides() {
    var hero = $('.gh-hero');
    if (!hero) return;

    ghFetchJSON(API + '/api/banners')
      .then(function (data) {
        var banners = (data && data.banners) || [];
        if (!Array.isArray(banners) || banners.length === 0) {
          hero.style.display = 'none';
          return;
        }
        renderHero(banners);
      })
      .catch(function () {
        hero.style.display = 'none';
      });
  }

  function renderHero(slides) {
    var hero = $('.gh-hero');
    if (!hero || !slides.length) return;
    var track = $('.gh-hero-slides', hero);
    var dotsWrap = $('.gh-hero-dots', hero);
    if (!track || !dotsWrap) return;

    track.innerHTML = '';
    dotsWrap.innerHTML = '';

    slides.forEach(function (s, i) {
      var slide = document.createElement('div');
      slide.className = 'gh-hero-slide' + (i === 0 ? ' gh-active' : '');
      slide.innerHTML = '<img src="' + escAttr(ghAssetUrl(s.imageUrl)) + '" alt="" loading="' + (i === 0 ? 'eager' : 'lazy') + '">';
      track.appendChild(slide);
      $$('img', slide).forEach(ghHandleImageError);

      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'gh-hero-dot' + (i === 0 ? ' gh-active' : '');
      dot.setAttribute('aria-label', 'Slide ' + (i + 1));
      dot.addEventListener('click', function () { goSlide(i); });
      dotsWrap.appendChild(dot);
    });

    bindHeroControls(slides.length);
  }

  function bindHeroControls(count) {
    var hero = $('.gh-hero');
    if (!hero) return;
    var current = 0;

    if (count < 2) {
      $$('.gh-hero-arrow', hero).forEach(function (b) { b.style.display = 'none'; });
      $$('.gh-hero-dot', hero).forEach(function (d) { d.style.display = 'none'; });
      return;
    }

    function goSlide(index) {
      current = (index + count) % count;
      var slides = $$('.gh-hero-slide', hero);
      var dots = $$('.gh-hero-dot', hero);
      slides.forEach(function (s, i) { s.classList.toggle('gh-active', i === current); });
      dots.forEach(function (d, i) { d.classList.toggle('gh-active', i === current); });
      restart();
    }

    function restart() {
      clearInterval(HERO_TIMER);
      HERO_TIMER = setInterval(function () { goSlide(current + 1); }, 5000);
    }

    $$('.gh-hero-arrow.gh-prev', hero).forEach(function (b) {
      b.addEventListener('click', function () { goSlide(current - 1); });
    });
    $$('.gh-hero-arrow.gh-next', hero).forEach(function (b) {
      b.addEventListener('click', function () { goSlide(current + 1); });
    });
    hero.addEventListener('mouseenter', function () { clearInterval(HERO_TIMER); });
    hero.addEventListener('mouseleave', restart);

    var touchX = null;
    hero.addEventListener('touchstart', function (e) {
      touchX = e.touches[0].clientX;
    }, { passive: true });
    hero.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 40) goSlide(current + (dx < 0 ? 1 : -1));
    });

    restart();
  }

  /* ---------------- homepage banner carousel ---------------- */

  var BANNER_TIMER = null;
  var BANNER_CURRENT = 0;
  var BANNER_COUNT = 0;
  var BANNER_DELAY = 4500;

  var BANNER_FEATURES =
    '<div class="gh-teak-features">' +
    '<div class="gh-teak-feature"><span class="gh-teak-feature-icon"><i class="fa-solid fa-vial"></i></span><div><b>Tissue Culture</b><span>Technology</span></div></div>' +
    '<div class="gh-teak-feature"><span class="gh-teak-feature-icon"><i class="fa-solid fa-shield-check"></i></span><div><b>Disease Free</b><span>Plants</span></div></div>' +
    '<div class="gh-teak-feature"><span class="gh-teak-feature-icon"><i class="fa-solid fa-seedling"></i></span><div><b>Fast Growth</b><span>High Timber Quality</span></div></div>' +
    '<div class="gh-teak-feature"><span class="gh-teak-feature-icon"><i class="fa-solid fa-tree"></i></span><div><b>Strong Root System</b><span>Better Establishment</span></div></div>' +
    '<div class="gh-teak-feature"><span class="gh-teak-feature-icon"><i class="fa-solid fa-truck-fast"></i></span><div><b>Safe &amp; Secure</b><span>Pan India Delivery</span></div></div>' +
    '</div>';

  function ghEscHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function ghBannerSlideHtml(b) {
    var title = ghEscHtml(b.title);
    var subtitle = ghEscHtml(b.subtitle);
    var highlight = ghEscHtml(b.highlightText);
    var discount = ghEscHtml(b.discountText);
    var price = ghEscHtml(b.price);
    var note = ghEscHtml(b.priceNote);
    var img = escAttr(ghAssetUrl(b.imageUrl)) || '../images/plant3.jpg';

    return (
      '<div class="gh-teak-inner">' +
      '<div class="gh-teak-content">' +
      (subtitle
        ? '<span class="gh-teak-kicker"><i class="fa-solid fa-leaf"></i> ' + subtitle + ' <i class="fa-solid fa-leaf"></i></span>'
        : '') +
      '<h2 class="gh-teak-title">' + title + '</h2>' +
      (highlight ? '<div class="gh-teak-ribbon">' + highlight + '</div>' : '') +
      (discount
        ? '<div class="gh-teak-badge"><span>Get Up To</span><strong>' + discount + '</strong></div>'
        : '') +
      BANNER_FEATURES +
      '</div>' +
      '<div class="gh-teak-media">' +
      '<img src="' + img + '" alt="' + title + '" loading="lazy">' +
      (price || note
        ? '<div class="gh-teak-price-tag">' +
          (price ? '<strong class="gh-teak-price-new">' + price + '</strong>' : '') +
          (note ? '<small>' + note + '</small>' : '') +
          '</div>'
        : '') +
      '</div>' +
      '</div>'
    );
  }

  function ghBannerGo(index) {
    var slides = $$('[data-banner-track] .gh-teak-slide');
    var dots = $$('[data-banner-dots] .gh-banner-dot');
    if (!slides.length) return;

    BANNER_COUNT = slides.length;
    BANNER_CURRENT = (index + BANNER_COUNT) % BANNER_COUNT;

    slides.forEach(function (s, i) {
      s.classList.toggle('gh-active', i === BANNER_CURRENT);
    });
    dots.forEach(function (d, i) {
      d.classList.toggle('gh-active', i === BANNER_CURRENT);
    });

    ghBannerRestart();
  }

  function ghBannerRestart() {
    clearInterval(BANNER_TIMER);
    if (BANNER_COUNT < 2) return;
    BANNER_TIMER = setInterval(function () {
      ghBannerGo(BANNER_CURRENT + 1);
    }, BANNER_DELAY);
  }

  function renderBannerSlides(banners, track, dotsWrap) {
    track.innerHTML = '';
    dotsWrap.innerHTML = '';

    banners.forEach(function (b, i) {
      var slide = document.createElement('div');
      slide.className = 'gh-teak-slide' + (i === 0 ? ' gh-active' : '');
      slide.innerHTML = ghBannerSlideHtml(b);
      track.appendChild(slide);
      $$('img', slide).forEach(ghHandleImageError);

      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'gh-banner-dot' + (i === 0 ? ' gh-active' : '');
      dot.setAttribute('aria-label', 'Go to banner ' + (i + 1));
      dot.addEventListener('click', function () {
        ghBannerGo(i);
      });
      dotsWrap.appendChild(dot);
    });

    BANNER_COUNT = banners.length;
    ghBannerRestart();
  }

  function loadHomeBanners() {
    var banner = $('[data-banner-carousel]');
    if (!banner) return;

    var track = $('[data-banner-track]');
    var dotsWrap = $('[data-banner-dots]');
    if (!track || !dotsWrap) return;

    banner.addEventListener('mouseenter', function () {
      clearInterval(BANNER_TIMER);
    });
    banner.addEventListener('mouseleave', ghBannerRestart);

    ghFetchJSON(API + '/api/banners')
      .then(function (data) {
        var banners = (data && data.banners) || data;
        if (!Array.isArray(banners) || banners.length === 0) {
          ghBannerRestart();
          return;
        }
        renderBannerSlides(banners, track, dotsWrap);
      })
      .catch(function () {
        ghBannerRestart();
      });
  }

  /* ---------------- category circles ---------------- */

  function renderCategories() {
    var mount = $('[data-cats]');
    if (!mount) return;
    mount.innerHTML = '';
    ghFetchJSON(API + '/api/categories')
      .then(function (data) {
        var cats = data.categories || [];
        if (!cats.length) {
          mount.innerHTML = '<p class="gh-note">Categories will appear here soon.</p>';
          return;
        }
        cats.forEach(function (c) {
          var item = document.createElement('div');
          item.className = 'gh-cat-item';
          item.innerHTML = '<a class="gh-cat-circle" href="products.html?category=' + encodeURIComponent(c._id) + '">' +
            '<img src="' + escAttr(ghAssetUrl(c.image)) + '" alt="' + escAttr(c.name) + '" loading="lazy"></a>' +
            '<h3><a href="products.html?category=' + encodeURIComponent(c._id) + '">' + esc(c.name) + '</a></h3>';
          mount.appendChild(item);
          ghHandleImageError($('img', item));
        });
      })
      .catch(function () {
        mount.innerHTML = '<p class="gh-note">Unable to load categories. Please try again later.</p>';
      });
  }

  /* ---------------- category carousel arrows ---------------- */

  function initCategoryCarousel() {
    var carousel = $('.gh-cats-row');
    if (!carousel) return;

    var prev = $('.gh-carrow.prev', carousel.parentElement);
    var next = $('.gh-carrow.next', carousel.parentElement);
    if (!prev || !next) return;

    var step = function () {
      var item = $('.gh-cat-item', carousel);
      var itemStep = item ? item.getBoundingClientRect().width + 28 : 300;
      var visible = Math.max(1, Math.round(carousel.clientWidth / itemStep));
      return itemStep * visible;
    };

    prev.addEventListener('click', function () {
      carousel.scrollBy({ left: -step(), behavior: 'smooth' });
    });
    next.addEventListener('click', function () {
      carousel.scrollBy({ left: step(), behavior: 'smooth' });
    });
  }

  /* ---------------- product cards ---------------- */

  function buildCard(product) {
    var pct = ghDiscountPercent(product);
    var rating = ghRatingOf(product._id);
    var img = ghAssetUrl(product.images && product.images[0]);
    var catName = product.category && product.category.name ? product.category.name : 'Plants';
    var priceHtml = pct > 0
      ? '<span class="gh-now">' + ghMoney(product.discountPrice) + '</span><span class="gh-was">' + ghMoney(product.price) + '</span><span class="gh-off">-' + pct + '%</span>'
      : '<span class="gh-now">' + ghMoney(product.price) + '</span>';

    var card = document.createElement('article');
    card.className = 'gh-card';
    card.dataset.pid = product._id;

    card.innerHTML =
      '<div class="gh-card-media">' +
      '<a href="product-details.html?id=' + encodeURIComponent(product._id) + '" aria-label="' + escAttr(product.name) + '">' +
      '<img src="' + escAttr(img) + '" alt="' + escAttr(product.name) + '" loading="lazy"></a>' +
      (pct > 0 ? '<span class="gh-badge">-' + pct + '%</span>' : '') +
      (Number(product.stock) > 0 && Number(product.stock) <= 8 ? '<span class="gh-badge gh-badge--danger">Only ' + product.stock + ' left</span>' : '') +
      (Number(product.stock) <= 0 ? '<span class="gh-badge gh-badge--danger">Out of stock</span>' : '') +
      '<button type="button" class="gh-wish-btn" data-gh-wish="' + escAttr(product._id) + '" aria-label="Add to wishlist"><i class="fa-regular fa-heart"></i></button>' +
      '<button type="button" class="gh-quick-view-btn" data-gh-qv="' + escAttr(product._id) + '"><i class="fa-solid fa-eye"></i> Quick View</button>' +
      '</div>' +
      '<div class="gh-card-body">' +
      '<span class="gh-card-cat">' + esc(catName) + '</span>' +
      '<a class="gh-card-title" href="product-details.html?id=' + encodeURIComponent(product._id) + '">' + esc(product.name) + '</a>' +
      '<div class="gh-card-rating"><span class="gh-stars">' + ghStars(rating.rate) + '</span><b>' + rating.rate + '</b><span>(' + rating.count + ')</span></div>' +
      '<div class="gh-card-price">' + priceHtml + '</div>' +
      (Number(product.stock) > 0
        ? '<span class="gh-card-stock gh-in"><i class="fa-solid fa-circle-check"></i> In stock</span>'
        : '<span class="gh-card-stock gh-low"><i class="fa-solid fa-circle-xmark"></i> Out of stock</span>') +
      '<div class="gh-card-actions">' +
      '<button type="button" class="gh-btn gh-btn--sm" data-gh-add="' + escAttr(product._id) + '" ' + (Number(product.stock) <= 0 ? 'disabled' : '') + '><i class="fa-solid fa-cart-plus"></i> Add to Cart</button>' +
      '<button type="button" class="gh-btn gh-btn--sm gh-btn--outline" data-gh-buy="' + escAttr(product._id) + '" ' + (Number(product.stock) <= 0 ? 'disabled' : '') + '>Buy Now</button>' +
      '</div></div>';

    ghHandleImageError($('img', card));
    return card;
  }

  function buildSkeleton() {
    var sk = document.createElement('div');
    sk.className = 'gh-skeleton';
    sk.innerHTML = '<div class="gh-skeleton-media"></div><div class="gh-skeleton-line"></div><div class="gh-skeleton-line gh-skeleton-line--short"></div><div class="gh-skeleton-line gh-skeleton-line--med"></div>';
    return sk;
  }

  function fillGrid(mount, products) {
    mount.innerHTML = '';
    if (!products.length) {
      mount.innerHTML = '<p class="gh-note">No products available right now.</p>';
      return;
    }
    products.forEach(function (p) { mount.appendChild(buildCard(p)); });
    syncWishlistIcons();
  }

  function gridError(mount) {
    mount.innerHTML = '<div class="gh-error-box"><i class="fa-solid fa-plug-circle-xmark"></i><h3>Could not load products</h3><p>Please check your connection and try again.</p><button type="button" class="gh-btn" data-gh-retry>Try Again</button></div>';
  }

  function loadPopularPlants() {
    var mount = $('[data-popular-grid]');
    if (!mount) return;
    mount.innerHTML = '';
    for (var i = 0; i < 8; i++) mount.appendChild(buildSkeleton());

    ghFetchJSON(API + '/api/products?status=active&limit=8')
      .then(function (data) { fillGrid(mount, data.products || []); })
      .catch(function () { gridError(mount); });
  }

  function loadOffers() {
    var section = $('[data-offers]');
    var mount = $('[data-offers-grid]');
    if (!section || !mount) return;

    section.classList.add('gh-hidden');
    mount.innerHTML = '';
    for (var i = 0; i < 4; i++) mount.appendChild(buildSkeleton());

    ghFetchJSON(API + '/api/products?status=active&limit=30')
      .then(function (data) {
        var deals = (data.products || []).filter(function (p) { return ghDiscountPercent(p) > 0; }).slice(0, 4);
        if (!deals.length) {
          section.style.display = 'none';
          return;
        }
        section.classList.remove('gh-hidden');
        section.style.display = '';
        fillGrid(mount, deals);
      })
      .catch(function () {
        section.style.display = 'none';
      });
  }

  /* ---------------- sale timer ---------------- */

  function startSaleTimer() {
    var cells = $$('[data-timer]');
    if (!cells.length) return;
    function tick() {
      var now = new Date();
      var end = new Date(now);
      end.setHours(23, 59, 59, 999);
      var diff = Math.max(0, end - now);
      var s = Math.floor(diff / 1000);
      var h = Math.floor(s / 3600);
      var m = Math.floor((s % 3600) / 60);
      var sec = s % 60;
      var pad = function (n) { return String(n).padStart(2, '0'); };
      cells.forEach(function (c) {
        c.innerHTML = '<span class="gh-timer-cell">' + pad(h) + 'h</span><span class="gh-timer-cell">' + pad(m) + 'm</span><span class="gh-timer-cell">' + pad(sec) + 's</span>';
      });
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---------------- recently viewed ---------------- */

  function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { return []; }
  }

  function saveRecent(list) {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10))); } catch (e) {}
  }

  function trackRecent(product) {
    var list = getRecent();
    list = list.filter(function (x) { return x.id !== product._id; });
    list.unshift({
      id: product._id,
      name: product.name,
      image: ghAssetUrl(product.images && product.images[0]),
      price: product.discountPrice || product.price
    });
    saveRecent(list);
  }

  function renderRecent() {
    var mount = $('[data-recent-grid]');
    var section = $('[data-recent-section]');
    if (!mount || !section) return;
    var list = getRecent();
    if (!list.length) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';
    mount.innerHTML = list.map(function (p) {
      return '<a class="gh-recent-card" href="product-details.html?id=' + encodeURIComponent(p.id) + '">' +
        '<img src="' + escAttr(p.image) + '" alt="' + escAttr(p.name) + '" loading="lazy">' +
        '<h4>' + esc(p.name) + '</h4><p>' + ghMoney(p.price) + '</p></a>';
    }).join('');
    $$('img', mount).forEach(ghHandleImageError);
  }

  /* ---------------- search overlay ---------------- */

  function renderSearchChips() {
    var recentWrap = $('[data-recent-searches]');
    var catWrap = $('[data-pop-cats]');
    if (recentWrap) {
      var recent;
      try { recent = JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY)) || []; } catch (e) { recent = []; }
      recentWrap.innerHTML = recent.length
        ? recent.map(function (q) {
          return '<button type="button" class="gh-tag" data-gh-search-chip>' + esc(q) + '</button>';
        }).join('')
        : '<span style="font-size:12.5px;color:var(--gh-grey)">Your recent searches will appear here.</span>';
    }
    if (catWrap) {
      catWrap.innerHTML = '';
      ghFetchJSON(API + '/api/categories/all')
        .then(function (data) {
          var cats = data.categories || [];
          catWrap.innerHTML = cats.slice(0, 8).map(function (c) {
            return '<button type="button" class="gh-tag" data-gh-cat-chip="' + escAttr(c._id) + '"><i class="fa-solid fa-tag"></i>' + esc(c.name) + '</button>';
          }).join('');
        })
        .catch(function () {});
    }
  }

  function openSearch() {
    var overlay = $('.gh-search-overlay');
    if (!overlay) return;
    renderSearchChips();
    overlay.classList.add('gh-show');
    lockBody(true);
    var input = $('.gh-search-bar input', overlay);
    if (input) setTimeout(function () { input.focus(); }, 120);
  }

  function closeSearch() {
    var overlay = $('.gh-search-overlay');
    if (overlay) overlay.classList.remove('gh-show');
    if (!$('.gh-modal.gh-show') && !$('.gh-drawer-cart.gh-open') && !$('.gh-drawer.gh-open')) lockBody(false);
  }

  function saveRecentSearch(q) {
    var recent;
    try { recent = JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY)) || []; } catch (e) { recent = []; }
    recent = recent.filter(function (x) { return x.toLowerCase() !== q.toLowerCase(); });
    recent.unshift(q);
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(recent.slice(0, 8)));
  }

  function runSearch(q) {
    var wrap = $('[data-search-results]');
    if (!wrap) return;
    var suggest = $('.gh-search-suggest');
    var value = String(q || '').trim();
    if (value.length < 2) {
      if (suggest) suggest.classList.remove('gh-show');
      wrap.innerHTML = '';
      return;
    }
    clearTimeout(SEARCH_TIMER);
    SEARCH_TIMER = setTimeout(function () {
      ghFetchJSON(API + '/api/products?search=' + encodeURIComponent(value) + '&status=active&limit=6')
        .then(function (data) {
          var products = data.products || [];
          if (!products.length) {
            wrap.innerHTML = '<p class="gh-note" style="padding:18px">No products match &quot;' + esc(value) + '&quot;</p>';
          } else {
            wrap.innerHTML = products.map(function (p) {
              var pct = ghDiscountPercent(p);
              return '<a class="gh-search-result" href="product-details.html?id=' + encodeURIComponent(p._id) + '">' +
                '<img src="' + escAttr(ghAssetUrl(p.images && p.images[0])) + '" alt="' + escAttr(p.name) + '" loading="lazy">' +
                '<span class="gh-sr-info"><b>' + esc(p.name) + '</b><span>' + esc((p.category && p.category.name) || 'Plants') + '</span></span>' +
                '<span class="gh-sr-price">' + ghMoney(p.discountPrice || p.price) + (pct > 0 ? ' <s style="color:var(--gh-grey);font-size:11px">' + ghMoney(p.price) + '</s>' : '') + '</span></a>';
            }).join('');
          }
          if (suggest) suggest.classList.add('gh-show');
          $$('img', wrap).forEach(ghHandleImageError);
        })
        .catch(function () {
          wrap.innerHTML = '<p class="gh-note" style="padding:18px">Search is unavailable right now.</p>';
          if (suggest) suggest.classList.add('gh-show');
        });
    }, 280);
  }

  function bindSearch() {
    var overlay = $('.gh-search-overlay');
    if (!overlay) return;

    $$('[data-gh-open-search]').forEach(function (b) {
      b.addEventListener('click', openSearch);
    });
    $$('.gh-search-close', overlay).forEach(function (b) {
      b.addEventListener('click', closeSearch);
    });

    var input = $('.gh-search-bar input', overlay);
    if (input) {
      input.addEventListener('input', function () { runSearch(this.value); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && this.value.trim()) {
          e.preventDefault();
          saveRecentSearch(this.value.trim());
          window.location.href = 'products.html?search=' + encodeURIComponent(this.value.trim());
        }
      });
    }

    var clearBtn = $('.gh-search-clear', overlay);
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (input) {
          input.value = '';
          input.focus();
        }
        var wrap = $('[data-search-results]', overlay);
        if (wrap) wrap.innerHTML = '';
        var suggest = $('.gh-search-suggest', overlay);
        if (suggest) suggest.classList.remove('gh-show');
      });
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeSearch();
    });

    document.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-gh-search-chip]');
      if (chip) {
        var q = chip.textContent.trim();
        saveRecentSearch(q);
        window.location.href = 'products.html?search=' + encodeURIComponent(q);
        return;
      }
      var catChip = e.target.closest('[data-gh-cat-chip]');
      if (catChip) {
        window.location.href = 'products.html?category=' + encodeURIComponent(catChip.dataset.ghCatChip);
        return;
      }
    });
  }

  /* ---------------- quick view ---------------- */

  function openQuickView(productId) {
    var modal = $('.gh-modal');
    if (!modal || !productId) return;
    var card = $('.gh-modal-card', modal);
    card.innerHTML = '<div class="gh-skeleton gh-qv-skeleton" style="border:none;padding:30px"><div class="gh-skeleton-media"></div><div class="gh-skeleton-line"></div><div class="gh-skeleton-line gh-skeleton-line--short"></div></div>';
    modal.classList.add('gh-show');
    lockBody(true);

    var promise = QUICK_VIEW_CACHE[productId]
      ? Promise.resolve(QUICK_VIEW_CACHE[productId])
      : ghFetchJSON(API + '/api/products/' + encodeURIComponent(productId)).then(function (d) {
        QUICK_VIEW_CACHE[productId] = d.product;
        return d.product;
      });

    promise
      .then(function (p) { renderQuickView(modal, p); })
      .catch(function () {
        card.innerHTML = '<div class="gh-error-box"><i class="fa-solid fa-circle-exclamation"></i><h3>Product unavailable</h3><p>Could not load this product.</p><button type="button" class="gh-btn" data-gh-qv-close>Close</button></div>';
      });
  }

  function renderQuickView(modal, p) {
    var pct = ghDiscountPercent(p);
    var rating = ghRatingOf(p._id);
    var img = ghAssetUrl(p.images && p.images[0]);
    var catName = p.category && p.category.name ? p.category.name : 'Plants';
    trackRecent(p);

    var card = $('.gh-modal-card', modal);
    card.innerHTML =
      '<button type="button" class="gh-modal-close" data-gh-qv-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' +
      '<div class="gh-qv-grid">' +
      '<div class="gh-qv-media"><img src="' + escAttr(img) + '" alt="' + escAttr(p.name) + '"></div>' +
      '<div class="gh-qv-info">' +
      '<span class="gh-card-cat">' + esc(catName) + '</span>' +
      '<h3 class="gh-qv-title">' + esc(p.name) + '</h3>' +
      '<div class="gh-qv-rating"><span class="gh-stars">' + ghStars(rating.rate) + '</span><b style="color:var(--gh-gold)">' + rating.rate + '</b><span style="color:var(--gh-grey)">(' + rating.count + ' ratings)</span></div>' +
      '<div class="gh-qv-price">' +
      (pct > 0
        ? '<span class="gh-now">' + ghMoney(p.discountPrice) + '</span><span class="gh-was">' + ghMoney(p.price) + '</span><span class="gh-off">Save ' + pct + '%</span>'
        : '<span class="gh-now">' + ghMoney(p.price) + '</span>') +
      '</div>' +
      '<span class="gh-qv-stock" style="color:' + (Number(p.stock) > 0 ? 'var(--gh-primary)' : 'var(--gh-danger)') + '"><i class="fa-solid fa-' + (Number(p.stock) > 0 ? 'circle-check' : 'circle-xmark') + '"></i> ' + (Number(p.stock) > 0 ? 'In stock' : 'Out of stock') + (Number(p.stock) > 0 && Number(p.stock) <= 8 ? ' - only ' + p.stock + ' left' : '') + '</span>' +
      '<p class="gh-qv-desc">' + esc(p.description || '') + '</p>' +
      '<div class="gh-qv-meta"><div><b>Category</b><span>' + esc(catName) + '</span></div><div><b>SKU</b><span>#' + String(p._id).slice(-6).toUpperCase() + '</span></div></div>' +
      '<div class="gh-qv-actions">' +
      '<div class="gh-qty"><button type="button" data-gh-qty="-1" aria-label="Decrease"><i class="fa-solid fa-minus"></i></button><input type="text" value="1" inputmode="numeric" aria-label="Quantity"><button type="button" data-gh-qty="1" aria-label="Increase"><i class="fa-solid fa-plus"></i></button></div>' +
      '<div class="gh-row2">' +
      '<button type="button" class="gh-btn" data-gh-add="' + escAttr(p._id) + '" ' + (Number(p.stock) <= 0 ? 'disabled' : '') + '><i class="fa-solid fa-cart-plus"></i> Add to Cart</button>' +
      '<button type="button" class="gh-btn gh-btn--outline" data-gh-buy="' + escAttr(p._id) + '" ' + (Number(p.stock) <= 0 ? 'disabled' : '') + '>Buy Now</button>' +
      '</div></div>' +
      '</div></div>';

    ghHandleImageError($('.gh-qv-media img', card));

    bindQuickViewMediaZoom(card);

    $$('[data-gh-qv-close]', card).forEach(function (b) {
      b.addEventListener('click', closeQuickView);
    });

    var qtyInput = $('.gh-qty input', card);
    $$('.gh-qty button', card).forEach(function (b) {
      b.addEventListener('click', function () {
        var step = Number(b.dataset.ghQty) || 0;
        var next = Math.max(1, (Number(qtyInput.value) || 1) + step);
        qtyInput.value = next;
      });
    });

    $$('[data-gh-add]', card).forEach(function (b) {
      b.addEventListener('click', function () {
        addToCart(b.dataset.ghAdd, Number(qtyInput.value) || 1);
      });
    });
    $$('[data-gh-buy]', card).forEach(function (b) {
      b.addEventListener('click', function () {
        buyNow(b.dataset.ghBuy, Number(qtyInput.value) || 1);
      });
    });

    if (ghLoggedIn()) {
      var wish = document.createElement('button');
      wish.type = 'button';
      wish.className = 'gh-btn gh-btn--outline gh-btn--sm';
      wish.style.marginTop = '10px';
      wish.dataset.ghWish = p._id;
      var inList = WISHLIST_IDS.has(p._id);
      wish.innerHTML = '<i class="fa-' + (inList ? 'solid' : 'regular') + ' fa-heart"></i> ' + (inList ? 'In Wishlist' : 'Add to Wishlist');
      wish.addEventListener('click', function () { toggleWishlist(wish, p._id); });
      $('.gh-qv-actions', card).appendChild(wish);
    }
  }

  function bindQuickViewMediaZoom(card) {
    var media = $('.gh-qv-media', card);
    var img = media ? $('img', media) : null;
    if (!media || !img) return;
    media.addEventListener('mousemove', function (e) {
      var rect = media.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width) * 100;
      var y = ((e.clientY - rect.top) / rect.height) * 100;
      img.style.transformOrigin = x + '% ' + y + '%';
    });
    media.addEventListener('mouseenter', function () { media.classList.add('gh-zooming'); });
    media.addEventListener('mouseleave', function () { media.classList.remove('gh-zooming'); });
  }

  function closeQuickView() {
    var modal = $('.gh-modal');
    if (modal) modal.classList.remove('gh-show');
    if (!$('.gh-search-overlay.gh-show') && !$('.gh-drawer-cart.gh-open') && !$('.gh-drawer.gh-open')) lockBody(false);
  }

  $$('[data-gh-qv-close]').forEach(function (b) {
    b.addEventListener('click', closeQuickView);
  });

  /* ---------------- wishlist ---------------- */

  function syncWishlistIcons() {
    $$('[data-gh-wish]').forEach(function (btn) {
      var active = WISHLIST_IDS.has(btn.dataset.ghWish);
      btn.classList.toggle('gh-active', active);
      var icon = $('i', btn);
      if (icon) icon.className = 'fa-' + (active ? 'solid' : 'regular') + ' fa-heart';
      if (btn.textContent.indexOf('Wishlist') !== -1) {
        btn.innerHTML = '<i class="fa-' + (active ? 'solid' : 'regular') + ' fa-heart"></i> ' + (active ? 'In Wishlist' : 'Add to Wishlist');
      }
    });
  }

  function loadWishlistState() {
    if (!ghLoggedIn()) return;
    ghWishlistGet()
      .then(function (products) {
        WISHLIST_IDS = new Set(products.map(function (p) { return p && p._id; }).filter(Boolean));
        syncWishlistIcons();
      })
      .catch(function () {});
  }

  function toggleWishlist(btn, productId) {
    if (!ghLoggedIn()) {
      showToast('Please log in to use your wishlist');
      setTimeout(function () {
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname.split('/').pop());
      }, 900);
      return;
    }
    var active = btn.classList.contains('gh-active');
    btn.disabled = true;
    var action = active ? ghWishlistRemove(productId) : ghWishlistAdd(productId);
    action
      .then(function () {
        if (active) {
          WISHLIST_IDS.delete(productId);
          showToast('Removed from Wishlist');
        } else {
          WISHLIST_IDS.add(productId);
          showToast('Added to Wishlist');
        }
        syncWishlistIcons();
      })
      .catch(function (err) {
        showToast((err && err.message) || 'Could not update wishlist', true);
      })
      .finally(function () { btn.disabled = false; });
  }

  /* ---------------- add to cart / buy now ---------------- */

  function addToCart(productId, qty) {
    var q = Math.max(1, Number(qty) || 1);
    return ghAddToCartApi(productId, q)
      .then(function () {
        showToast('Added to cart');
        refreshBadge();
        if ($('.gh-drawer-cart.gh-open')) renderMiniCart();
        return true;
      })
      .catch(function (err) {
        showToast((err && err.message) || 'Could not add to cart', true);
        return false;
      });
  }

  function buyNow(productId, qty) {
    if (typeof window.ghBuyNow === 'function') {
      window.ghBuyNow(productId, qty);
    } else {
      addToCart(productId, qty);
    }
  }

  function bindProductClicks(scope) {
    if (!scope) return;
    scope.addEventListener('click', function (e) {
      var qvClose = e.target.closest('[data-gh-qv-close]');
      if (qvClose) {
        closeQuickView();
        return;
      }
      var wishBtn = e.target.closest('[data-gh-wish]');
      if (wishBtn) {
        toggleWishlist(wishBtn, wishBtn.dataset.ghWish);
        return;
      }
      var qv = e.target.closest('[data-gh-qv]');
      if (qv) {
        openQuickView(qv.dataset.ghQv);
        return;
      }
      var add = e.target.closest('[data-gh-add]');
      if (add) {
        if (add.disabled) return;
        var original = add.innerHTML;
        add.disabled = true;
        addToCart(add.dataset.ghAdd, 1).then(function (ok) {
          if (ok) {
            add.innerHTML = '<i class="fa-solid fa-check"></i> Added';
            setTimeout(function () { add.innerHTML = original; }, 1100);
          } else {
            add.innerHTML = original;
          }
          add.disabled = false;
        });
        return;
      }
      var buy = e.target.closest('[data-gh-buy]');
      if (buy) {
        if (buy.disabled) return;
        buyNow(buy.dataset.ghBuy, 1);
      }
    });
  }

  /* ---------------- mini cart drawer ---------------- */

  function openMiniCart() {
    var drawer = $('.gh-drawer-cart');
    if (!drawer) return;
    drawer.classList.add('gh-open');
    lockBody(true);
    renderMiniCart();
  }

  function closeMiniCart() {
    var drawer = $('.gh-drawer-cart');
    if (drawer) drawer.classList.remove('gh-open');
    if (!$('.gh-search-overlay.gh-show') && !$('.gh-modal.gh-show') && !$('.gh-drawer.gh-open')) lockBody(false);
  }

  function cartItemHtml(item, product) {
    if (!product) return '';
    var pct = ghDiscountPercent(product);
    var price = pct > 0 ? product.discountPrice : product.price;
    return '<div class="gh-cart-item" data-cart-item="' + escAttr(item._id || item.productId) + '">' +
      '<a href="product-details.html?id=' + encodeURIComponent(product._id || item.productId) + '"><img src="' + escAttr(ghAssetUrl(product.images && product.images[0])) + '" alt="' + escAttr(product.name) + '" loading="lazy"></a>' +
      '<div class="gh-cart-item-info">' +
      '<h4>' + esc(product.name) + '</h4>' +
      '<div class="gh-ci-price">' + ghMoney(price) + '</div>' +
      '<div class="gh-cart-item-row">' +
      '<div class="gh-qty"><button type="button" data-gh-cart-step="-1" aria-label="Decrease"><i class="fa-solid fa-minus"></i></button><input type="text" value="' + item.quantity + '" readonly><button type="button" data-gh-cart-step="1" aria-label="Increase"><i class="fa-solid fa-plus"></i></button></div>' +
      '<button type="button" class="gh-cart-remove" data-gh-cart-remove aria-label="Remove"><i class="fa-solid fa-trash-can"></i></button>' +
      '</div></div></div>';
  }

  function renderMiniCart() {
    var body = $('.gh-drawer-cart-body');
    var head = $('.gh-drawer-cart-head h3 span');
    var totalEl = $('.gh-cart-total b');
    if (!body) return;

    body.innerHTML = '<p class="gh-note"><i class="fa-solid fa-spinner fa-spin"></i> Loading cart...</p>';

    var task = ghLoggedIn()
      ? ghApi('/api/cart').then(function (d) {
        return (d.cart || []).map(function (c) {
          return { id: c._id, productId: c.product._id, quantity: c.quantity, product: c.product };
        });
      })
      : Promise.all(ghGuestCart().map(function (g) {
        return ghFetchJSON(API + '/api/products/' + encodeURIComponent(g.productId))
          .then(function (d) { return { id: 'g-' + g.productId, productId: g.productId, quantity: g.quantity, product: d.product }; })
          .catch(function () { return null; });
      })).then(function (list) { return list.filter(Boolean); });

    task
      .then(function (items) {
        if (head) head.textContent = '(' + items.length + ')';
        if (!items.length) {
          body.innerHTML = '<div class="gh-cart-empty"><i class="fa-solid fa-basket-shopping"></i><h4>Your cart is empty</h4><p>Add some greenery to your cart and let the magic grow.</p><button type="button" class="gh-btn gh-btn--sm" data-gh-continue>Continue Shopping</button></div>';
          var continueBtn = $('[data-gh-continue]', body);
          if (continueBtn) continueBtn.addEventListener('click', closeMiniCart);
          if (totalEl) totalEl.textContent = ghMoney(0);
          return;
        }
        var subtotal = items.reduce(function (sum, it) {
          var pct = ghDiscountPercent(it.product);
          var price = Number(pct > 0 ? it.product.discountPrice : it.product.price) || 0;
          return sum + price * Number(it.quantity || 1);
        }, 0);
        body.innerHTML = items.map(function (it) { return cartItemHtml(it, it.product); }).join('');
        if (totalEl) totalEl.textContent = ghMoney(subtotal);
        $$('img', body).forEach(ghHandleImageError);
      })
      .catch(function () {
        body.innerHTML = '<div class="gh-cart-empty"><i class="fa-solid fa-triangle-exclamation"></i><h4>Could not load cart</h4><p>Please try again.</p></div>';
        if (totalEl) totalEl.textContent = ghMoney(0);
      });
  }

  function bindMiniCart() {
    $$('[data-gh-open-cart]').forEach(function (b) {
      b.addEventListener('click', openMiniCart);
    });
    var drawer = $('.gh-drawer-cart');
    if (!drawer) return;

    $$('.gh-drawer-cart-head .gh-modal-close, [data-gh-cart-close]', drawer).forEach(function (b) {
      b.addEventListener('click', closeMiniCart);
    });

    // Bind on the whole drawer (not just .gh-drawer-cart-body): the
    // "Checkout" button lives in .gh-drawer-cart-foot, which is a sibling
    // of the body, so clicks there never reached a handler bound to the body.
    drawer.addEventListener('click', function (e) {
      var stepBtn = e.target.closest('[data-gh-cart-step]');
      if (stepBtn) {
        var itemEl = stepBtn.closest('[data-cart-item]');
        var qtyEl = $('.gh-qty input', itemEl);
        var next = Math.max(1, (Number(qtyEl.value) || 1) + Number(stepBtn.dataset.ghCartStep));
        var key = itemEl.dataset.cartItem;
        if (ghLoggedIn()) {
          ghApi('/api/cart/' + encodeURIComponent(key), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: next })
          }).then(function () {
            qtyEl.value = next;
            renderMiniCart();
            refreshBadge();
          }).catch(function (err) { showToast((err && err.message) || 'Update failed', true); });
        } else {
          var guest = ghGuestCart();
          guest.forEach(function (g) { if (g.productId === key.replace(/^g-/, '')) g.quantity = next; });
          ghSaveGuestCart(guest);
          qtyEl.value = next;
          renderMiniCart();
          refreshBadge();
        }
        return;
      }
      var removeBtn = e.target.closest('[data-gh-cart-remove]');
      if (removeBtn) {
        var itemEl2 = removeBtn.closest('[data-cart-item]');
        var key2 = itemEl2 ? itemEl2.dataset.cartItem : '';
        var doRemove = ghLoggedIn()
          ? ghApi('/api/cart/' + encodeURIComponent(key2), { method: 'DELETE' })
          : Promise.resolve().then(function () {
            var guest = ghGuestCart().filter(function (g) { return g.productId !== key2.replace(/^g-/, ''); });
            ghSaveGuestCart(guest);
          });
        doRemove.then(function () {
          showToast('Item removed from cart');
          renderMiniCart();
          refreshBadge();
        }).catch(function (err) { showToast((err && err.message) || 'Remove failed', true); });
        return;
      }
      var checkout = e.target.closest('[data-gh-checkout]');
      if (checkout) {
        window.location.href = ghLoggedIn() ? 'checkout.html' : 'login.html?redirect=' + encodeURIComponent('checkout.html');
      }
    });
  }

  /* ---------------- newsletter ---------------- */

  function bindNewsletter() {
    var pop = $('.gh-news-pop');
    var popShown = sessionStorage.getItem('gh_news_pop');
    if (pop && !popShown) {
      setTimeout(function () { pop.classList.add('gh-show'); }, 5000);
    }
    if (pop) {
      $$('.gh-news-pop-close', pop).forEach(function (b) {
        b.addEventListener('click', function () {
          pop.classList.remove('gh-show');
          sessionStorage.setItem('gh_news_pop', '1');
        });
      });
      var form = $('.gh-news-pop-body', pop);
      if (form) form.addEventListener('submit', function (e) {
        e.preventDefault();
        subscribeNewsletter($('input', form));
      });
    }

    $$('[data-gh-newsletter]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        subscribeNewsletter($('input', form));
      });
    });
  }

  function subscribeNewsletter(input) {
    if (!input) return;
    var email = input.value.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      showToast('Please enter a valid email', true);
      return;
    }
    input.value = '';
    showToast('Subscribed! Welcome to the Green Hub family');
    var pop = $('.gh-news-pop');
    if (pop) {
      pop.classList.remove('gh-show');
      sessionStorage.setItem('gh_news_pop', '1');
    }
  }

  /* ---------------- floating buttons ---------------- */

  function bindBackTop() {
    var btn = $('.gh-backtop');
    if (!btn) return;
    window.addEventListener('scroll', function () {
      btn.classList.toggle('gh-show', window.scrollY > 420);
    }, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------------- ripple ---------------- */

  function bindRipple() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.gh-btn');
      if (!btn) return;
      var rect = btn.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height);
      var span = document.createElement('span');
      span.className = 'gh-ripple';
      span.style.width = span.style.height = size + 'px';
      span.style.left = (e.clientX - rect.left - size / 2) + 'px';
      span.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(span);
      setTimeout(function () { span.remove(); }, 650);
    });
  }

  /* ---------------- reveal ---------------- */

  function bindReveal() {
    var els = $$('[data-gh-reveal]');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('gh-in'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('gh-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) { observer.observe(el); });
  }

  /* ---------------- products page ---------------- */

  var productsPage = {
    cats: [],
    page: 1,
    pages: 0,
    loaded: [],
    filters: { category: '', search: '', sort: 'newest' },
    active: false
  };

  function initProductsPage() {
    var grid = $('[data-products-grid]');
    if (!grid) return;
    productsPage.active = true;

    var params = new URLSearchParams(window.location.search);
    productsPage.filters.search = params.get('search') || '';
    var catParam = params.get('category') || '';
    var sortParam = params.get('sort') || '';

    var searchInput = $('[data-products-search]');
    if (searchInput) {
      searchInput.value = productsPage.filters.search;
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          productsPage.filters.search = this.value.trim();
          resetAndLoad();
        }
      });
    }

    var sortSel = $('[data-products-sort]');
    if (sortSel) {
      sortSel.value = sortParam || 'newest';
      sortSel.addEventListener('change', function () {
        productsPage.filters.sort = this.value;
        applyClientSort();
      });
    }

    ghFetchJSON(API + '/api/categories/all')
      .then(function (data) {
        productsPage.cats = data.categories || [];
        renderChips();
        if (catParam) {
          var match = productsPage.cats.find(function (c) { return c._id === catParam || c.slug === catParam; });
          if (match) {
            productsPage.filters.category = match._id;
            $$('.gh-chip').forEach(function (c) {
              c.classList.toggle('gh-active', c.dataset.catId === match._id);
            });
          } else {
            productsPage.filters.category = catParam;
          }
        }
        loadPage(1);
      })
      .catch(function () {
        productsPage.cats = [];
        renderChips();
        loadPage(1);
      });

    function renderChips() {
      var wrap = $('[data-filter-chips]');
      if (!wrap) return;
      wrap.innerHTML = '<button type="button" class="gh-chip gh-active" data-cat-id="">All</button>' +
        productsPage.cats.map(function (c) {
          return '<button type="button" class="gh-chip" data-cat-id="' + escAttr(c._id) + '">' + esc(c.name) + '</button>';
        }).join('');
      $$('.gh-chip', wrap).forEach(function (chip) {
        chip.addEventListener('click', function () {
          productsPage.filters.category = chip.dataset.catId || '';
          $$('.gh-chip', wrap).forEach(function (c) { c.classList.toggle('gh-active', c === chip); });
          resetAndLoad();
        });
      });
    }

    function resetAndLoad() {
      productsPage.page = 1;
      productsPage.loaded = [];
      loadPage(1);
    }

    function applyClientSort() {
      if (!productsPage.loaded.length) return;
      var arr = productsPage.loaded.slice();
      var sort = productsPage.filters.sort;
      if (sort === 'price-low') arr.sort(function (a, b) { return (a.discountPrice || a.price) - (b.discountPrice || b.price); });
      if (sort === 'price-high') arr.sort(function (a, b) { return (b.discountPrice || b.price) - (a.discountPrice || a.price); });
      if (sort === 'popular') arr.sort(function (a, b) { return Number(ghRatingOf(b._id).rate) - Number(ghRatingOf(a._id).rate); });
      if (sort === 'discount') arr.sort(function (a, b) { return ghDiscountPercent(b) - ghDiscountPercent(a); });
      fillGrid(grid, arr);
    }

    function loadPage(page) {
      var url = API + '/api/products?status=active&page=' + page + '&limit=12';
      if (productsPage.filters.category) url += '&category=' + encodeURIComponent(productsPage.filters.category);
      if (productsPage.filters.search) url += '&search=' + encodeURIComponent(productsPage.filters.search);

      var countEl = $('[data-count]');
      var loadMoreWrap = $('[data-loadmore-wrap]');
      if (page === 1) {
        grid.innerHTML = '';
        for (var i = 0; i < 8; i++) grid.appendChild(buildSkeleton());
      }
      if (loadMoreWrap) loadMoreWrap.style.display = 'none';

      ghFetchJSON(url)
        .then(function (data) {
          var products = data.products || [];
          productsPage.pages = data.pages || 0;
          if (page === 1) productsPage.loaded = [];
          productsPage.loaded = productsPage.loaded.concat(products);
          if (countEl) countEl.innerHTML = '<b>' + data.total + '</b> products';
          if (!productsPage.loaded.length) {
            grid.innerHTML = '<div class="gh-error-box" style="grid-column:1/-1"><i class="fa-solid fa-seedling"></i><h3>No products found</h3><p>Try a different category or search term.</p></div>';
            return;
          }
          fillGrid(grid, productsPage.loaded);
          applyClientSort();
          if (productsPage.page < productsPage.pages) {
            if (loadMoreWrap) loadMoreWrap.style.display = 'flex';
          }
        })
        .catch(function () {
          gridError(grid);
          var retry = $('[data-gh-retry]', grid);
          if (retry) retry.addEventListener('click', function () { resetAndLoad(); });
        });
    }

    var loadMoreBtn = $('[data-loadmore]');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', function () {
        productsPage.page += 1;
        loadPage(productsPage.page);
      });
    }

    $$('[data-gh-retry]').forEach(function (b) {
      b.addEventListener('click', function () { resetAndLoad(); });
    });
  }

  /* ---------------- account icon ---------------- */

  function bindAccount() {
    $$('[data-gh-account]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.location.href = ghLoggedIn() ? 'profile.html' : 'login.html';
      });
    });
    $$('[data-gh-wishlist-link]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.location.href = ghLoggedIn() ? 'wishlist.html' : 'login.html?redirect=' + encodeURIComponent('wishlist.html');
      });
    });
  }

  /* ---------------- footer year ---------------- */

  function bindFooterYear() {
    $$('[data-year]').forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  /* ---------------- init ---------------- */

  function init() {
    bindThemeToggle();
    bindHeaderScroll();
    bindDrawer();
    buildHeroSlides();
    loadHomeBanners();
    renderCategories();
    initCategoryCarousel();
    loadPopularPlants();
    loadOffers();
    startSaleTimer();
    renderRecent();
    bindSearch();
    bindMiniCart();
    bindNewsletter();
    bindBackTop();
    bindRipple();
    bindReveal();
    bindAccount();
    bindFooterYear();
    bindProductClicks(document);
    loadWishlistState();
    initProductsPage();
    refreshBadge();

    var searchValue = new URLSearchParams(window.location.search).get('search');
    if (searchValue && $('[data-products-search]')) {
      runSearch(searchValue);
    }

    $$('.gh-modal').forEach(function (m) {
      m.addEventListener('click', function (e) {
        if (e.target === m) closeQuickView();
      });
    });

    $$('.gh-footer a[href="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ghBuildCard = buildCard;
})();
