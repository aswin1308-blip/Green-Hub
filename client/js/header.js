(function () {
  'use strict';

  var root = document.querySelector('[data-gh-header-root]');
  if (!root) return;

  var page = (window.location.pathname.split('/').pop() || 'index.html').split('?')[0];

  // Category dropdowns are 100% dynamic — hydrated from
  // GET /api/categories/nav (showInNavDropdown: true, grouped by navGroup).
  // No hardcoded category lists live here; a group with zero matching
  // categories renders as a plain link (no chevron, no dropdown).

  var NAV = [
    { label: 'Home', href: 'index.html' },
    { label: 'All Products', href: 'products.html' },
    { label: 'Plants', href: 'products.html', mega: true, group: 'Plants' },
    { label: 'Pot Plants', href: 'products.html', group: 'Pot Plants', hide: 'gh-nav-hide-lg gh-hide-1' },
    { label: 'Bulbs &amp; Seeds', href: 'products.html', group: 'Bulbs & Seeds', hide: 'gh-nav-hide-lg gh-hide-1' },
    { label: 'Planters', href: 'products.html', group: 'Planters', hide: 'gh-nav-hide-lg gh-hide-2' },
    { label: 'Gardening Kit', href: 'products.html', mega: true, group: 'Gardening Kit', hide: 'gh-nav-hide-lg gh-hide-2' },
    { label: 'Offers', href: 'products.html?sort=discount', mega: true },
    { label: 'More', href: '#', mega: true, more: true }
  ];

  var QUICK_STANDARD =
    '<a href="products.html">All Products</a>' +
    '<a href="products.html?sort=popular">Best Sellers</a>' +
    '<a href="products.html?sort=discount">Today\'s Deals</a>' +
    '<a href="wishlist.html">My Wishlist</a>';

  var QUICK_MORE =
    '<a href="products.html">All Products</a>' +
    '<a href="product-details.html">Product Details</a>' +
    '<a href="wishlist.html">My Wishlist</a>' +
    '<a href="cart.html">My Cart</a>' +
    '<a href="orders.html">My Orders</a>' +
    '<a href="profile.html">My Profile</a>' +
    '<a href="about.html">About Us</a>' +
    '<a href="contact.html">Contact Us</a>';

  var MEGA_BANNER =
    '<a class="gh-mega-banner" href="products.html?sort=discount">' +
    '<small>Limited Time</small>' +
    '<strong>Flat 25% OFF</strong>' +
    '<span>Use code GREEN25 at checkout</span>' +
    '</a>';

  function megaHtml(quick, group) {
    return '<div class="gh-mega">' +
      '<div class="gh-mega-cols">' +
      '<div>' +
      '<h4>Shop by Category</h4>' +
      '<div class="gh-mega-cat-grid" data-mega-cats' + (group ? ' data-mega-group="' + group + '"' : '') + '></div>' +
      '</div>' +
      '<div class="gh-mega-quick">' +
      '<h4>Quick Links</h4>' +
      quick +
      '</div>' +
      '</div>' +
      MEGA_BANNER +
      '</div>';
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr(str) {
    return esc(str).replace(/'/g, '&#39;');
  }

  // Empty container — hydration (hydrateNav) fills it with the categories
  // belonging to this nav group, or converts the item to a plain link.
  function dropdownHtml() {
    return '<div class="gh-dropdown"></div>';
  }

  function navItemHtml(item, active) {
    var cls = 'gh-nav-link' + (active ? ' gh-active' : '');
    var hasSub = item.group || item.mega;
    var link = '<a href="' + item.href + '" class="' + cls + '">' +
      item.label + (hasSub ? ' <i class="fa-solid fa-chevron-down"></i>' : '') + '</a>';
    var sub = '';
    if (item.group && !item.mega) sub = dropdownHtml();
    if (item.mega) sub = megaHtml(item.more ? QUICK_MORE : QUICK_STANDARD, item.group);
    return '<div class="gh-nav-item' + (item.hide ? ' ' + item.hide : '') + '"' +
      (item.group ? ' data-nav-group="' + item.group + '"' : '') + '>' + link + sub + '</div>';
  }

  function activeIndex() {
    if (page === 'index.html') return 0;
    if (page === 'products.html' || page === 'product-details.html' || page === 'checkout.html' || page === 'order-success.html') return 1;
    return 8;
  }

  function tickerHtml() {
    var spans =
      '<span><i class="fa-solid fa-seedling"></i> Monsoon Sale Live &ndash; Flat 25% Off on Seeds</span>' +
      '<span><i class="fa-solid fa-truck-fast"></i> Free Delivery on Orders Above &#8377;499</span>' +
      '<span><i class="fa-solid fa-tag"></i> Use Code GREEN25 at Checkout</span>';
    return '<div class="gh-ticker" aria-hidden="true"><div class="gh-ticker-track">' + spans + spans + '</div></div>';
  }

  function navHtml() {
    var active = activeIndex();
    var html = '';
    for (var i = 0; i < NAV.length; i++) {
      html += navItemHtml(NAV[i], i === active);
    }
    return html;
  }

  function actionsHtml() {
    return '<div class="gh-header-actions">' +
      '<button type="button" class="gh-icon-btn gh-theme-toggle" aria-label="Toggle dark mode"><i class="fa-solid fa-moon"></i></button>' +
      '<button type="button" class="gh-icon-btn" data-gh-open-search aria-label="Search"><i class="fa-solid fa-magnifying-glass"></i></button>' +
      '<button type="button" class="gh-icon-btn" data-gh-account aria-label="Account"><i class="fa-regular fa-user"></i></button>' +
      '<button type="button" class="gh-icon-btn" data-gh-wishlist-link aria-label="Wishlist"><i class="fa-regular fa-heart"></i></button>' +
      '<button type="button" class="gh-icon-btn" data-gh-open-cart aria-label="Cart"><i class="fa-solid fa-cart-shopping"></i><span class="gh-cart-badge">0</span></button>' +
      '<button type="button" class="gh-hamburger" aria-label="Open menu"><span></span><span></span><span></span></button>' +
      '</div>';
  }

  function headerHtml() {
    return '<header class="gh-header">' +
      '<div class="gh-container gh-header-inner">' +
      '<a href="index.html" class="gh-logo" aria-label="Green Hub Home">' +
      '<img src="../images/logo.svg" alt="Green Hub" width="80" height="48">' +
      '</a>' +
      '<nav class="gh-nav" aria-label="Main navigation">' + navHtml() + '</nav>' +
      actionsHtml() +
      '</div>' +
      '</header>';
  }

  function drawerHtml() {
    var subs = [
      ['gh-sub-plants', 'Plants', 'Plants'],
      ['gh-sub-pot', 'Pot Plants', 'Pot Plants'],
      ['gh-sub-bulbs', 'Bulbs &amp; Seeds', 'Bulbs & Seeds'],
      ['gh-sub-planters', 'Planters', 'Planters'],
      ['gh-sub-kit', 'Gardening Kit', 'Gardening Kit']
    ];
    var body = '<div class="gh-drawer-item"><a class="gh-drawer-link" href="index.html">Home</a></div>' +
      '<div class="gh-drawer-item"><a class="gh-drawer-link" href="products.html">All Products</a></div>';
    for (var i = 0; i < subs.length; i++) {
      body += '<div class="gh-drawer-item">' +
        '<button type="button" class="gh-drawer-link" data-sub="' + subs[i][0] + '">' + subs[i][1] + ' <i class="fa-solid fa-chevron-down"></i></button>' +
        '<div class="gh-drawer-sub" id="' + subs[i][0] + '" data-mega-cats data-mega-group="' + subs[i][2] + '"></div>' +
        '</div>';
    }
    body += '<div class="gh-drawer-item">' +
      '<button type="button" class="gh-drawer-link" data-sub="gh-sub-more">More <i class="fa-solid fa-chevron-down"></i></button>' +
      '<div class="gh-drawer-sub" id="gh-sub-more">' +
      '<a href="products.html?sort=discount">Today\'s Deals</a>' +
      '<a href="wishlist.html">My Wishlist</a>' +
      '<a href="cart.html">My Cart</a>' +
      '<a href="orders.html">My Orders</a>' +
      '<a href="profile.html">My Profile</a>' +
      '<a href="about.html">About Us</a>' +
      '<a href="contact.html">Contact Us</a>' +
      '</div></div>';
    return '<aside class="gh-drawer" aria-label="Mobile menu">' +
      '<div class="gh-drawer-head">' +
      '<a href="index.html"><img src="../images/logo.svg" alt="Green Hub"></a>' +
      '<button type="button" class="gh-drawer-close" aria-label="Close menu"><i class="fa-solid fa-xmark"></i></button>' +
      '</div>' +
      '<div class="gh-drawer-body">' + body + '</div>' +
      '<div class="gh-drawer-foot">' +
      '<a href="login.html" class="gh-btn gh-btn--sm">Sign In</a>' +
      '<a href="products.html" class="gh-btn gh-btn--sm gh-btn--outline">Shop Now</a>' +
      '</div>' +
      '</aside>';
  }

  function searchHtml() {
    return '<div class="gh-search-overlay" role="dialog" aria-label="Search">' +
      '<div class="gh-search-panel">' +
      '<div class="gh-search-bar">' +
      '<i class="fa-solid fa-magnifying-glass"></i>' +
      '<input type="text" placeholder="Search plants, seeds, planters..." aria-label="Search products" autocomplete="off">' +
      '<button type="button" class="gh-search-clear" aria-label="Clear"><i class="fa-solid fa-xmark"></i></button>' +
      '</div>' +
      '<div class="gh-search-suggest"><div data-search-results></div></div>' +
      '<div style="margin-top:22px;display:grid;gap:18px">' +
      '<div>' +
      '<h5 style="font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--gh-grey);margin-bottom:12px">Recent Searches</h5>' +
      '<div class="gh-search-tags" data-recent-searches></div>' +
      '</div>' +
      '<div>' +
      '<h5 style="font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--gh-grey);margin-bottom:12px">Popular Categories</h5>' +
      '<div class="gh-search-tags" data-pop-cats></div>' +
      '</div>' +
      '</div>' +
      '<button type="button" class="gh-search-close"><i class="fa-solid fa-arrow-left"></i> Press Esc to close</button>' +
      '</div>' +
      '</div>';
  }

  function cartDrawerHtml() {
    return '<aside class="gh-drawer-cart" aria-label="Shopping cart">' +
      '<div class="gh-drawer-cart-head">' +
      '<h3>Your Cart <span>(0)</span></h3>' +
      '<button type="button" class="gh-modal-close" data-gh-cart-close aria-label="Close cart"><i class="fa-solid fa-xmark"></i></button>' +
      '</div>' +
      '<div class="gh-drawer-cart-body"></div>' +
      '<div class="gh-drawer-cart-foot">' +
      '<div class="gh-cart-total"><span>Subtotal</span><b>&#8377;0</b></div>' +
      '<div class="gh-cart-cta">' +
      '<a href="cart.html" class="gh-btn gh-btn--outline">View Cart</a>' +
      '<button type="button" class="gh-btn" data-gh-checkout>Checkout</button>' +
      '</div>' +
      '</div>' +
      '</aside>';
  }

  // Single source of truth for every navbar category dropdown (desktop
  // dropdowns, mega grids and the mobile drawer). Reads ONLY categories
  // with showInNavDropdown:true grouped by navGroup. Any group with zero
  // matching categories becomes a plain link: chevron removed, panel hidden.
  function hydrateNav() {
    var apiBase = (typeof window.GH_API_BASE !== 'undefined' ? window.GH_API_BASE : 'https://greenhub1.onrender.com');
    fetch(apiBase + '/api/categories/nav')
      .then(function (res) { return res.ok ? res.json() : Promise.reject(new Error('Failed')); })
      .then(function (data) {
        var byGroup = {};
        var any = false;
        ((data && data.groups) || []).forEach(function (g) {
          byGroup[g.navGroup] = g.categories || [];
          if (g.categories && g.categories.length) any = true;
        });

        NAV.forEach(function (item) {
          if (!item.group) return;
          var cats = byGroup[item.group] || [];
          var itemEl = root.querySelector('.gh-nav-item[data-nav-group="' + item.group + '"]');
          if (!itemEl) return;

          if (!cats.length || !any) {
            // Zero categories for this group -> plain link, no dropdown
            var chevron = itemEl.querySelector('.gh-nav-link .fa-chevron-down');
            if (chevron) chevron.style.display = 'none';
            var panel = itemEl.querySelector('.gh-dropdown, .gh-mega');
            if (panel) panel.style.display = 'none';
            itemEl.classList.add('gh-nav-empty');
            return;
          }

          // Plain dropdown links
          var dd = itemEl.querySelector('.gh-dropdown');
          if (dd) {
            dd.innerHTML = cats.map(function (c) {
              return '<a href="products.html?category=' + encodeURIComponent(c._id) + '">' + esc(c.name) + '</a>';
            }).join('');
          }

          // Mega grids + mobile drawer subs (image cards)
          var grid = itemEl.querySelector('[data-mega-cats][data-mega-group="' + item.group + '"]');
          if (grid) fillMegaGrid(grid, cats);
        });

        // Mobile drawer: fill subs + collapse empty ones
        var drawerSubs = root.querySelectorAll('.gh-drawer-sub[data-mega-group]');
        drawerSubs.forEach(function (sub) {
          var group = sub.getAttribute('data-mega-group');
          var cats = byGroup[group] || [];
          if (!cats.length || !any) {
            var btn = root.querySelector('[data-sub="' + sub.id + '"]');
            if (btn) {
              var chevron = btn.querySelector('.fa-chevron-down');
              if (chevron) chevron.style.display = 'none';
            }
            sub.style.display = 'none';
            return;
          }
          fillMegaGrid(sub, cats);
        });
      })
      .catch(function () {
        // API unavailable: never show placeholders — every grouped item
        // falls back to a plain link.
        NAV.forEach(function (item) {
          if (!item.group) return;
          var itemEl = root.querySelector('.gh-nav-item[data-nav-group="' + item.group + '"]');
          if (!itemEl) return;
          var chevron = itemEl.querySelector('.gh-nav-link .fa-chevron-down');
          if (chevron) chevron.style.display = 'none';
          var panel = itemEl.querySelector('.gh-dropdown, .gh-mega');
          if (panel) panel.style.display = 'none';
        });
        root.querySelectorAll('.gh-drawer-sub[data-mega-group]').forEach(function (sub) {
          var btn = root.querySelector('[data-sub="' + sub.id + '"]');
          if (btn) {
            var chevron = btn.querySelector('.fa-chevron-down');
            if (chevron) chevron.style.display = 'none';
          }
          sub.style.display = 'none';
        });
      });
  }

  function fillMegaGrid(mount, cats) {
    mount.innerHTML = cats.slice(0, 4).map(function (c) {
      return '<a class="gh-mega-cat-link" href="products.html?category=' + encodeURIComponent(c._id) + '">' +
        '<img src="' + escAttr(ghAssetUrl(c.image)) + '" alt="' + escAttr(c.name) + '" loading="lazy">' +
        '<span>' + esc(c.name) + '</span></a>';
    }).join('');
    var imgs = mount.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      if (typeof ghHandleImageError === 'function') ghHandleImageError(imgs[i]);
    }
  }

  function footerHtml() {
    return '<footer class="gh-footer">' +
      '<div class="gh-container">' +
      '<div class="gh-footer-grid">' +
      '<div class="gh-footer-brand">' +
      '<img src="../images/logo.svg" alt="Green Hub">' +
      '<p>Your trusted online nursery for healthy plants, fresh seeds and premium gardening essentials. Your dream garden is just a click away.</p>' +
      '<div class="gh-footer-social">' +
      '<a href="#" aria-label="Facebook"><i class="fa-brands fa-facebook-f"></i></a>' +
      '<a href="#" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>' +
      '<a href="#" aria-label="YouTube"><i class="fa-brands fa-youtube"></i></a>' +
      '<a href="#" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>' +
      '</div>' +
      '</div>' +
      '<div class="gh-footer-links">' +
      '<h3>Quick Links</h3>' +
      '<a href="index.html">Home</a>' +
      '<a href="products.html">All Products</a>' +
      '<a href="products.html?sort=discount">Today\'s Offers</a>' +
      '<a href="wishlist.html">Wishlist</a>' +
      '<a href="orders.html">My Orders</a>' +
      '</div>' +
      '<div class="gh-footer-links">' +
      '<h3>Customer Service</h3>' +
      '<a href="about.html">About Us</a>' +
      '<a href="contact.html">Contact Us</a>' +
      '<a href="login.html">Login / Register</a>' +
      '<a href="profile.html">My Account</a>' +
      '<a href="cart.html">My Cart</a>' +
      '</div>' +
      '<div class="gh-footer-news">' +
      '<h3>Our Newsletter</h3>' +
      '<p>Subscribe to get news about special discounts and new arrivals.</p>' +
      '<form data-gh-newsletter>' +
      '<input type="email" placeholder="Enter your email" aria-label="Email address" required>' +
      '<button type="submit">Subscribe</button>' +
      '</form>' +
      '<div class="gh-footer-social" style="margin-top:18px">' +
      '<a href="https://wa.me/919876543210" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>' +
      '<a href="tel:+919876543210" aria-label="Call us"><i class="fa-solid fa-phone"></i></a>' +
      '<a href="mailto:support@greenhub.com" aria-label="Email us"><i class="fa-solid fa-envelope"></i></a>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="gh-footer-bottom">' +
      '<p>&copy; <span data-year>' + new Date().getFullYear() + '</span> Green Hub. All Rights Reserved.</p>' +
      '<div class="gh-footer-payments">' +
      '<span>We accept</span>' +
      '<i class="fa-brands fa-cc-visa"></i>' +
      '<i class="fa-brands fa-cc-mastercard"></i>' +
      '<i class="fa-brands fa-cc-amex"></i>' +
      '<i class="fa-brands fa-cc-paypal"></i>' +
      '<i class="fa-brands fa-google-pay"></i>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</footer>';
  }

  root.innerHTML =
    tickerHtml() +
    headerHtml() +
    '<div class="gh-backdrop" aria-hidden="true"></div>' +
    drawerHtml() +
    searchHtml() +
    cartDrawerHtml();

  hydrateNav();

  // Shared footer — pages without the premium footer markup
  // just mount an empty [data-gh-footer-root] and get it injected.
  var footerRoot = document.querySelector('[data-gh-footer-root]');
  if (footerRoot) footerRoot.innerHTML = footerHtml();
})();
