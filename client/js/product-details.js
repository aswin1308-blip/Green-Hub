/* ==========================================
        GREEN HUB - PRODUCT-DETAILS.JS (premium)
        Loads a product by ?id= (or first active),
        renders the premium details layout and wires
        Add to Cart / Buy Now / Wishlist / Related.
========================================== */

(function () {
  var RECENT_KEY = 'gh_recent';

  function apiBase() {
    return (window.GH_API_BASE) || 'http://localhost:5000';
  }

  function money(n) {
    return window.ghMoney ? window.ghMoney(n) : '₹' + Number(n || 0).toLocaleString('en-IN');
  }

  function assetUrl(p) {
    return window.ghAssetUrl ? window.ghAssetUrl(p) : (p || '');
  }

  function handleImageError(img) {
    if (window.ghHandleImageError) {
      window.ghHandleImageError(img);
    } else if (img) {
      img.addEventListener('error', function () {
        if (!img.dataset.ghFallback) { img.dataset.ghFallback = '1'; img.src = '../images/no-image.svg'; }
      });
    }
  }

  function starsHtml(rate) {
    var full = Math.round(Number(rate));
    var html = '';
    for (var i = 1; i <= 5; i++) {
      html += '<i class="fa' + (i <= full ? 's' : 'r') + ' fa-star"></i>';
    }
    return html;
  }

  function ratingOf(id) {
    var h = 0;
    var s = String(id || '');
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    h = Math.abs(h);
    return { rate: (4 + (h % 11) / 10).toFixed(1), count: 14 + (h % 187) };
  }

  function toast(msg, isError) {
    if (window.showToast) { window.showToast(msg, isError); return; }
    alert(msg);
  }

  function refreshBadge() {
    if (window.ghRefreshCartBadge) window.ghRefreshCartBadge();
  }

  function saveRecent(productId) {
    try {
      var list = JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
      list = list.filter(function (id) { return id !== productId; });
      list.unshift(productId);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10)));
    } catch (e) { /* ignore */ }
  }

  function setSpinner(btn, textEl, on, label) {
    if (!btn) return;
    btn.disabled = on;
    if (!textEl) return;
    if (on) {
      textEl.innerHTML = '<span class="gh-btn-spinner" aria-hidden="true"></span>' + (label || '');
    } else {
      textEl.textContent = label || '';
    }
  }

  function getQty() {
    var input = document.getElementById('pd-qty');
    return Math.max(1, Math.min(99, parseInt(input && input.value, 10) || 1));
  }

  function currentPrice(product) {
    return Number(product.discountPrice) || Number(product.price) || 0;
  }

  function loadProduct(id) {
    var url = id
      ? apiBase() + '/api/products/' + encodeURIComponent(id)
      : apiBase() + '/api/products?status=active&limit=1';
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('Failed to load product');
      return res.json();
    }).then(function (data) {
      if (id) return data.product || null;
      return (data.products && data.products[0]) || null;
    });
  }

  function render(product) {
    var nameEl = document.getElementById('pd-name');
    var imgEl = document.getElementById('pd-image');
    var descEl = document.getElementById('pd-desc');
    var rating = ratingOf(product._id);
    var price = currentPrice(product);
    var was = Number(product.price) || 0;
    var pct = 0;
    if (product.discountPrice > 0 && was > price) {
      pct = Math.round(((was - price) / was) * 100);
    }

    if (nameEl) nameEl.textContent = product.name || 'Product';
    document.title = 'Green Hub | ' + (product.name || 'Product');

    var banner = document.querySelector('[data-pd-name-banner]');
    if (banner) banner.textContent = product.name || 'Product Details';
    var crumb = document.querySelector('[data-pd-crumb]');
    if (crumb) crumb.textContent = product.name || 'Product Details';

    var catEl = document.querySelector('[data-pd-cat]');
    if (catEl) {
      catEl.textContent = product.category && product.category.name
        ? product.category.name
        : 'Plants';
    }

    var starsEl = document.querySelector('[data-pd-stars]');
    if (starsEl) starsEl.innerHTML = starsHtml(rating.rate);
    var ratingInfo = document.querySelector('[data-pd-rating]');
    if (ratingInfo) {
      var b = ratingInfo.querySelector('b');
      var span = ratingInfo.querySelector('span');
      if (b) b.textContent = rating.rate;
      if (span) span.textContent = '(' + rating.count + ' reviews)';
    }

    var nowEl = document.querySelector('[data-pd-now]');
    var wasEl = document.querySelector('[data-pd-was]');
    var pctEl = document.querySelector('[data-pd-pct]');
    if (nowEl) nowEl.textContent = money(price);
    if (wasEl) { wasEl.style.display = pct > 0 ? '' : 'none'; wasEl.textContent = money(was); }
    if (pctEl) { pctEl.style.display = pct > 0 ? '' : 'none'; pctEl.textContent = '-' + pct + '%'; }
    var offBadge = document.querySelector('[data-pd-off]');
    if (offBadge) { offBadge.style.display = pct > 0 ? '' : 'none'; offBadge.textContent = '-' + pct + '%'; }

    if (descEl) descEl.textContent = product.description || '';

    var stockEl = document.querySelector('[data-pd-stock]');
    var stock = Number(product.stock) || 0;
    if (stockEl) {
      if (stock <= 0) {
        stockEl.innerHTML = '<span class="gh-card-stock gh-low"><i class="fa-solid fa-circle-xmark"></i> Out of stock</span>';
      } else if (stock <= 8) {
        stockEl.innerHTML = '<span class="gh-card-stock gh-low"><i class="fa-solid fa-circle-exclamation"></i> Only ' + stock + ' left in stock</span>';
      } else {
        stockEl.innerHTML = '<span class="gh-card-stock gh-in"><i class="fa-solid fa-circle-check"></i> In stock, ready to ship</span>';
      }
    }

    var stockNote = document.querySelector('[data-pd-stock-note]');
    if (stockNote) {
      stockNote.textContent = stock > 0 ? 'Free delivery on orders above ₹499' : 'Currently unavailable';
    }

    var benefits = document.querySelector('[data-pd-benefits]');
    if (benefits) {
      var attrs = product.attributes && typeof product.attributes === 'object' ? product.attributes : {};
      var benefitKeys = Object.keys(attrs).filter(function (k) {
        return /benefit|care|tip/i.test(k);
      });
      if (benefitKeys.length) {
        benefits.innerHTML = '';
        benefitKeys.forEach(function (k) {
          var li = document.createElement('li');
          li.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + String(attrs[k]);
          benefits.appendChild(li);
        });
      } else {
        benefits.innerHTML = '';
        ['Purifies Air', 'Easy to Maintain', 'Low Water Requirement', 'Improves Indoor Decoration'].forEach(function (b) {
          var li = document.createElement('li');
          li.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + b;
          benefits.appendChild(li);
        });
      }
    }

    renderSpecs(product);
    renderImages(product);
    bindActions(product);
    loadRelated(product);
    saveRecent(product._id);
  }

  function renderSpecs(product) {
    var mount = document.querySelector('[data-pd-specs]');
    if (!mount) return;
    var rows = [
      ['Product Name', product.name || '—'],
      ['Category', product.category && product.category.name ? product.category.name : 'Plants'],
      ['Price', money(currentPrice(product)) + (product.discountPrice > 0 ? ' <s>' + money(product.price) + '</s>' : '')],
      ['Availability', (Number(product.stock) > 0 ? 'In Stock (' + product.stock + ' left)' : 'Out of Stock')],
      ['Delivery', '2–5 business days across India'],
    ];
    var attrs = product.attributes && typeof product.attributes === 'object' ? product.attributes : {};
    Object.keys(attrs).forEach(function (k) {
      if (/benefit|care|tip/i.test(k)) return;
      rows.push([String(k).replace(/_/g, ' ').replace(/^\w/, function (c) { return c.toUpperCase(); }), String(attrs[k])]);
    });
    mount.innerHTML = '';
    rows.forEach(function (row) {
      var item = document.createElement('div');
      item.className = 'gh-spec-row';
      item.innerHTML = '<span>' + row[0] + '</span><b>' + row[1] + '</b>';
      mount.appendChild(item);
    });
  }

  function renderImages(product) {
    var imgEl = document.getElementById('pd-image');
    var thumbs = document.querySelector('[data-pd-thumbs]');
    if (!imgEl) return;

    var images = (product.images && product.images.length ? product.images : [product.image])
      .map(assetUrl)
      .filter(Boolean);

    var setMain = function (src) {
      imgEl.src = src;
      imgEl.dataset.ghFallback = '';
      handleImageError(imgEl);
      if (thumbs) {
        Array.prototype.forEach.call(thumbs.children, function (t) {
          t.classList.toggle('gh-active', t.dataset.ghThumb === src);
        });
      }
    };

    if (!images.length) {
      imgEl.src = '../images/no-image.svg';
      imgEl.alt = product.name || 'Product';
      return;
    }

    imgEl.alt = product.name || 'Product';
    setMain(images[0]);

    if (thumbs) {
      thumbs.innerHTML = '';
      images.forEach(function (src) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gh-pd-thumb';
        btn.dataset.ghThumb = src;
        btn.setAttribute('aria-label', 'View image');
        var im = document.createElement('img');
        im.src = src;
        im.alt = '';
        im.loading = 'lazy';
        handleImageError(im);
        btn.appendChild(im);
        btn.addEventListener('click', function () { setMain(src); });
        thumbs.appendChild(btn);
      });
      var first = thumbs.firstChild;
      if (first) first.classList.add('gh-active');
    }
  }

  function bindZoom() {
    var wrap = document.querySelector('[data-pd-zoom]');
    var img = document.getElementById('pd-image');
    if (!wrap || !img) return;

    wrap.addEventListener('mousemove', function (e) {
      var rect = wrap.getBoundingClientRect();
      var x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
      var y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
      wrap.classList.add('gh-zooming');
      img.style.transformOrigin = x + '% ' + y + '%';
      img.style.transform = 'scale(1.9)';
    });
    wrap.addEventListener('mouseleave', function () {
      wrap.classList.remove('gh-zooming');
      img.style.transform = '';
    });
  }

  function bindActions(product) {
    var addBtn = document.getElementById('pd-add');
    var buyBtn = document.getElementById('pd-buy');
    var addText = document.querySelector('[data-pd-add-text]');
    var buyText = document.querySelector('[data-pd-buy-text]');
    var minusBtn = document.querySelector('[data-pd-qty-minus]');
    var plusBtn = document.querySelector('[data-pd-qty-plus]');
    var qtyInput = document.getElementById('pd-qty');
    var wishBtn = document.querySelector('[data-pd-wish]');
    var shareEl = document.querySelector('[data-pd-share]');
    var stock = Number(product.stock) || 0;

    if (minusBtn) {
      minusBtn.addEventListener('click', function () {
        if (qtyInput) qtyInput.value = Math.max(1, getQty() - 1);
      });
    }
    if (plusBtn) {
      plusBtn.addEventListener('click', function () {
        if (qtyInput) qtyInput.value = Math.min(99, getQty() + 1);
      });
    }

    var add = function () {
      if (addBtn.disabled) return;
      setSpinner(addBtn, addText, true, 'Adding...');
      window.ghAddToCart(product._id, getQty())
        .then(function () {
          toast('Added to cart');
          refreshBadge();
        })
        .catch(function (err) {
          toast((err && err.message) || 'Could not add to cart', true);
        })
        .finally(function () {
          setSpinner(addBtn, addText, false, 'Add to Cart');
        });
    };

    var buy = function () {
      if (buyBtn.disabled) return;
      setSpinner(buyBtn, buyText, true, 'Redirecting...');
      if (window.ghBuyNow) {
        window.ghBuyNow(product._id, getQty());
      } else {
        window.ghAddToCart(product._id, getQty())
          .then(function () { window.location.href = 'checkout.html'; })
          .catch(function (err) {
            toast((err && err.message) || 'Could not start checkout', true);
            setSpinner(buyBtn, buyText, false, 'Buy Now');
          });
      }
    };

    if (addBtn) addBtn.addEventListener('click', add);
    if (buyBtn) buyBtn.addEventListener('click', buy);

    if (stock <= 0) {
      if (addBtn) { addBtn.disabled = true; if (addText) addText.textContent = 'Out of Stock'; }
      if (buyBtn) { buyBtn.disabled = true; if (buyText) buyText.textContent = 'Out of Stock'; }
    }

    if (wishBtn) {
      var renderWish = function (ids) {
        var active = ids.indexOf(product._id) !== -1;
        wishBtn.classList.toggle('gh-active', active);
        wishBtn.innerHTML = '<i class="fa-' + (active ? 'solid' : 'regular') + ' fa-heart"></i> ' + (active ? 'In Wishlist' : 'Add to Wishlist');
      };
      if (window.ghGetWishlist) {
        window.ghGetWishlist().then(function (list) {
          renderWish((list || []).map(function (p) { return p._id; }));
        }).catch(function () {});
      }
      wishBtn.addEventListener('click', function () {
        var isActive = wishBtn.classList.contains('gh-active');
        var api = isActive ? window.ghRemoveFromWishlist : window.ghAddToWishlist;
        if (!api) return;
        api(product._id)
          .then(function () {
            renderWish(isActive ? [] : [product._id]);
            toast(isActive ? 'Removed from wishlist' : 'Added to wishlist');
          })
          .catch(function (err) {
            toast((err && err.message) || 'Please log in to use your wishlist', true);
          });
      });
    }

    if (shareEl) {
      shareEl.style.cursor = 'pointer';
      shareEl.addEventListener('click', function () {
        var url = window.location.href;
        if (navigator.share) {
          navigator.share({ title: product.name, url: url }).catch(function () {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(function () { toast('Link copied to clipboard'); });
        }
      });
    }
  }

  function loadRelated(product) {
    var mount = document.querySelector('[data-related-grid]');
    if (!mount) return;
    mount.innerHTML = '';
    for (var i = 0; i < 4; i++) {
      var sk = document.createElement('div');
      sk.className = 'gh-skeleton';
      sk.innerHTML = '<div class="gh-skeleton-media"></div><div class="gh-skeleton-line"></div><div class="gh-skeleton-line gh-skeleton-line--short"></div>';
      mount.appendChild(sk);
    }

    var params = 'status=active&limit=8';
    if (product.category && (product.category._id || product.category)) {
      var catId = product.category._id || product.category;
      if (catId && typeof catId === 'string') params += '&category=' + encodeURIComponent(catId);
    }

    fetch(apiBase() + '/api/products?' + params)
      .then(function (res) { return res.ok ? res.json() : Promise.reject(new Error('Failed')); })
      .then(function (data) {
        var items = (data.products || []).filter(function (p) { return p._id !== product._id; });
        if (!items.length) {
          return fetch(apiBase() + '/api/products?status=active&limit=8')
            .then(function (r) { return r.ok ? r.json() : { products: [] }; })
            .then(function (fallback) {
              fillRelated(mount, (fallback.products || []).filter(function (p) { return p._id !== product._id; }).slice(0, 4));
            });
        }
        fillRelated(mount, items.slice(0, 4));
      })
      .catch(function () {
        mount.innerHTML = '';
      });

    function fillRelated(mountEl, items) {
      mountEl.innerHTML = '';
      if (!items.length) {
        mountEl.innerHTML = '<p class="gh-note">No related products right now.</p>';
        return;
      }
      items.forEach(function (p) {
        if (window.ghBuildCard) {
          mountEl.appendChild(window.ghBuildCard(p));
        }
      });
    }
  }

  function init() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');

    loadProduct(id)
      .then(function (product) {
        if (!product) throw new Error('not found');
        render(product);
        bindZoom();
      })
      .catch(function () {
        var nameEl = document.getElementById('pd-name');
        if (nameEl) nameEl.textContent = 'Product not found';
        var descEl = document.getElementById('pd-desc');
        if (descEl) descEl.textContent = 'The product you are looking for is no longer available.';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
