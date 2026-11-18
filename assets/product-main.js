/*
 * Product page: sections/product-main.liquid (desktop layout),
 * snippets/product-main-mobile.liquid (mobile layout) and
 * snippets/product-sticky-bar.liquid.
 *
 * One state holds the selected pack and quantity. Every control (pack cards,
 * quantity, Add to Cart, Buy It Now, sticky bar) reads and writes it, so both
 * layouts and the sticky bar always add the same pack and quantity.
 * Pack data comes from <script type="application/json" data-pm-data>.
 */
(function () {
  'use strict';

  if (window.PMProduct) return;

  var BREAKPOINT = '(max-width: 768px)';

  function qsa(root, selector) {
    return Array.prototype.slice.call(root.querySelectorAll(selector));
  }

  function setHidden(el, hidden) {
    if (el) el.hidden = Boolean(hidden);
  }

  function rootUrl(path) {
    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    return root + path;
  }

  function lowStockText(data, variant) {
    if (!variant || typeof variant.stock !== 'number') return '';
    if (variant.stock <= 0 || variant.stock > data.lowStock) return '';
    return data.lowStockText.replace('[count]', variant.stock);
  }

  /* ── State ─────────────────────────────────────────────────────────────── */

  function createStore(data) {
    var listeners = [];
    var state = { variantId: data.currentVariant, qty: 1 };

    function find(id) {
      id = Number(id);
      for (var i = 0; i < data.variants.length; i++) {
        if (data.variants[i].id === id) return data.variants[i];
      }
      return null;
    }

    function maxQty(variant) {
      var max = data.maxQty > 0 ? data.maxQty : 99;
      if (variant && variant.deny && typeof variant.stock === 'number' && variant.stock > 0) {
        max = Math.min(max, variant.stock);
      }
      return max;
    }

    function updateUrl(id) {
      try {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', id);
        window.history.replaceState(window.history.state, '', url.toString());
      } catch (error) {}
    }

    var store = {
      data: data,
      state: state,
      find: find,
      variant: function () {
        return find(state.variantId);
      },
      maxQty: function () {
        return maxQty(find(state.variantId));
      },
      set: function (patch) {
        var reason = 'refresh';
        if (patch.variantId != null) {
          var variant = find(patch.variantId);
          if (variant && variant.id !== state.variantId) {
            state.variantId = variant.id;
            reason = 'variant';
          }
        }
        if (patch.qty != null) {
          state.qty = patch.qty;
          if (reason === 'refresh') reason = 'qty';
        }
        state.qty = Math.max(1, Math.min(Math.floor(state.qty) || 1, store.maxQty()));
        if (reason === 'variant') updateUrl(state.variantId);
        listeners.forEach(function (listener) {
          listener(store.variant(), state, reason);
        });
      },
      subscribe: function (listener) {
        listeners.push(listener);
        listener(store.variant(), state, 'init');
      },
    };
    return store;
  }

  /* ── Cart ──────────────────────────────────────────────────────────────── */

  function refreshCartDrawer(sectionHtml) {
    if (!sectionHtml) return;
    var html = new DOMParser().parseFromString(sectionHtml, 'text/html');

    var newBody = html.querySelector('#nc-body');
    var oldBody = document.querySelector('#nc-body');
    if (newBody && oldBody) oldBody.replaceWith(newBody);

    var newBreakdown = html.querySelector('.nc-price-breakdown');
    if (newBreakdown) {
      var oldBreakdown = document.querySelector('.nc-price-breakdown');
      if (oldBreakdown) {
        oldBreakdown.replaceWith(newBreakdown);
      } else {
        var footer = document.querySelector('.cart-drawer__footer');
        if (footer) footer.insertAdjacentElement('beforebegin', newBreakdown);
      }
    }

    var newFooter = html.querySelector('.cart-drawer__footer');
    var oldFooter = document.querySelector('.cart-drawer__footer');
    if (newFooter && oldFooter) oldFooter.replaceWith(newFooter);
  }

  function openCartDrawer() {
    if (typeof window.ncCartOpen === 'function') {
      window.ncCartOpen();
      return;
    }
    var drawer = document.getElementById('nc-cart-drawer');
    if (drawer) {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  }

  function showCartError(button, message) {
    var holder = button.closest('[data-pm-root]');
    var target = holder && holder.querySelector('[data-pm-cart-error]');
    if (!target) target = document.querySelector('[data-psb-cart-error]');
    if (!target) return;
    target.textContent = message;
    target.hidden = false;
    clearTimeout(target._pmTimer);
    target._pmTimer = setTimeout(function () {
      target.hidden = true;
    }, 6000);
  }

  function addToCart(store, button, source) {
    var variant = store.variant();
    if (!variant || !variant.available || button.dataset.busy === 'true') return;

    button.dataset.busy = 'true';
    button.disabled = true;
    button.textContent = store.data.labels.adding;

    fetch(rootUrl('cart/add.js'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        id: variant.id,
        quantity: store.state.qty,
        sections: ['cart-drawer'],
        sections_url: window.location.pathname,
      }),
    })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(body.description || body.message || store.data.labels.error);
          }
          return body;
        });
      })
      .then(function (added) {
        refreshCartDrawer(added.sections && added.sections['cart-drawer']);
        openCartDrawer();
        return fetch(rootUrl('cart.js'), { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      })
      .then(function (response) {
        return response.json();
      })
      .then(function (cart) {
        if (typeof publish !== 'undefined' && typeof PUB_SUB_EVENTS !== 'undefined') {
          publish(PUB_SUB_EVENTS.cartUpdate, { source: source, cartData: cart });
        }
        if (typeof window.ncUpdatePriceBreakdown === 'function') {
          window.ncUpdatePriceBreakdown(cart);
        }
      })
      .catch(function (error) {
        console.error(error);
        showCartError(button, error && error.message ? error.message : store.data.labels.error);
      })
      .finally(function () {
        delete button.dataset.busy;
        store.set({});
      });
  }

  function buyNowFallback(store) {
    var variant = store.variant();
    if (!variant || !variant.available) return;
    window.location.href = rootUrl('cart/' + variant.id + ':' + store.state.qty);
  }

  function renderCartButton(button, variant, labels) {
    if (!button || button.dataset.busy === 'true') return;
    var available = Boolean(variant && variant.available);
    button.disabled = !available;
    button.textContent = available ? labels.add : labels.soldOut;
  }

  /* ── Gallery ───────────────────────────────────────────────────────────── */

  function bindGallery(root) {
    var slides = qsa(root, '.pm-main-slide');
    var dots = qsa(root, '.pm-main-dot');
    var thumbs = qsa(root, '.pm-thumb');
    var counter = root.querySelector('[data-pm-counter]');
    var current = Math.max(0, slides.findIndex(function (slide) {
      return slide.classList.contains('active');
    }));

    function go(index, scrollThumb) {
      if (!slides.length) return;
      index = (index + slides.length) % slides.length;
      current = index;
      slides.forEach(function (slide, i) {
        slide.classList.toggle('active', i === index);
        slide.setAttribute('aria-hidden', i === index ? 'false' : 'true');
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle('active', i === index);
        dot.setAttribute('aria-current', i === index ? 'true' : 'false');
      });
      thumbs.forEach(function (thumb, i) {
        thumb.classList.toggle('active', i === index);
        thumb.setAttribute('aria-current', i === index ? 'true' : 'false');
      });
      if (counter) counter.textContent = index + 1 + ' / ' + slides.length;

      var thumb = thumbs[index];
      var strip = thumb && thumb.parentElement;
      if (scrollThumb !== false && strip && strip.scrollWidth > strip.clientWidth) {
        var offset = thumb.getBoundingClientRect().left - strip.getBoundingClientRect().left;
        strip.scrollBy({ left: offset - (strip.clientWidth - thumb.offsetWidth) / 2, behavior: 'smooth' });
      }
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () {
        go(i);
      });
    });
    thumbs.forEach(function (thumb, i) {
      thumb.addEventListener('click', function () {
        go(i);
      });
      thumb.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          go(i);
        }
      });
    });

    var prev = root.querySelector('.pm-main-arrow-prev');
    var next = root.querySelector('.pm-main-arrow-next');
    if (prev) prev.addEventListener('click', function () { go(current - 1); });
    if (next) next.addEventListener('click', function () { go(current + 1); });

    var slider = root.querySelector('.pm-main-image-slider');
    if (slider && slides.length > 1) {
      var startX = 0;
      var startY = 0;
      slider.addEventListener('touchstart', function (event) {
        startX = event.changedTouches[0].screenX;
        startY = event.changedTouches[0].screenY;
      }, { passive: true });
      slider.addEventListener('touchend', function (event) {
        var deltaX = event.changedTouches[0].screenX - startX;
        var deltaY = event.changedTouches[0].screenY - startY;
        // Ignore taps and mostly vertical swipes (page scrolling).
        if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) return;
        go(deltaX < 0 ? current + 1 : current - 1);
      }, { passive: true });
    }

    go(current, false);
    return { go: go };
  }

  /* ── Pack scroller (dots on desktop, progress bar on mobile) ───────────── */

  function bindPackScroller(root, withDots) {
    var grid = root.querySelector('.pm-variants-grid');
    var dotsEl = root.querySelector('.pm-variants-dots');
    var bar = root.querySelector('.pm-variants-bar');
    var fill = root.querySelector('.pm-variants-bar-fill');
    if (!grid) return;
    var cards = qsa(grid, '.pm-variant-card');
    var pages = 1;
    var perView = 1;

    function buildDots() {
      if (!withDots || !dotsEl || !cards.length) return;
      dotsEl.innerHTML = '';
      var cardWidth = cards[0].offsetWidth;
      if (!cardWidth) return;
      perView = Math.max(1, Math.round(grid.clientWidth / (cardWidth + 12)));
      pages = Math.max(1, Math.ceil(cards.length / perView));
      if (pages <= 1) return;
      for (var i = 0; i < pages; i++) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'pm-variants-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', 'Show packs ' + (i * perView + 1) + ' onwards');
        dot.dataset.page = i;
        dotsEl.appendChild(dot);
      }
    }

    function updateOverflow() {
      var overflowing = grid.scrollWidth > grid.clientWidth + 2;
      if (dotsEl) dotsEl.style.display = withDots && overflowing ? '' : 'none';
      if (bar) bar.style.display = overflowing ? '' : 'none';
    }

    if (dotsEl) {
      dotsEl.addEventListener('click', function (event) {
        var dot = event.target.closest('.pm-variants-dot');
        if (!dot) return;
        var card = cards[Math.min(Number(dot.dataset.page) * perView, cards.length - 1)];
        if (card) grid.scrollTo({ left: card.offsetLeft - grid.offsetLeft, behavior: 'smooth' });
      });
    }

    grid.addEventListener('scroll', function () {
      var maxScroll = grid.scrollWidth - grid.clientWidth;
      var progress = maxScroll > 0 ? grid.scrollLeft / maxScroll : 0;
      if (fill) fill.style.width = progress * 100 + '%';
      if (dotsEl && pages > 1) {
        var active = Math.max(0, Math.min(Math.round(progress * (pages - 1)), pages - 1));
        qsa(dotsEl, '.pm-variants-dot').forEach(function (dot, i) {
          dot.classList.toggle('active', i === active);
        });
      }
    }, { passive: true });

    function refresh() {
      buildDots();
      updateOverflow();
    }
    refresh();
    window.addEventListener('resize', refresh);
    window.matchMedia(BREAKPOINT).addEventListener('change', refresh);
  }

  /* ── Accordions and coupons ────────────────────────────────────────────── */

  function bindAccordions(root) {
    var buttons = qsa(root, '.pm-accordion-btn');
    buttons.forEach(function (button) {
      var body = button.nextElementSibling;
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', function () {
        var opening = !button.classList.contains('open');
        buttons.forEach(function (other) {
          var otherBody = other.nextElementSibling;
          other.classList.remove('open');
          other.setAttribute('aria-expanded', 'false');
          if (otherBody) otherBody.style.maxHeight = null;
        });
        if (opening && body) {
          button.classList.add('open');
          button.setAttribute('aria-expanded', 'true');
          body.style.maxHeight = body.scrollHeight + 'px';
        }
      });
    });
  }

  function bindCoupons(root) {
    qsa(root, '.pm-coupon-copy, .pm-coupon-s-copy').forEach(function (button) {
      var icon = button.innerHTML;
      button.addEventListener('click', function () {
        var code = (button.dataset.code || '').replace(/<[^>]*>/g, '').trim();
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(code).then(function () {
          button.textContent = '✓';
          setTimeout(function () {
            button.innerHTML = icon;
          }, 1500);
        });
      });
    });
  }

  /* ── One layout (desktop or mobile) ────────────────────────────────────── */

  function bindLayout(root, store) {
    var labels = store.data.labels;
    var cards = qsa(root, '.pm-variant-card');
    var gallery = bindGallery(root);
    var minus = root.querySelector('[data-pm-qty-minus]');
    var plus = root.querySelector('[data-pm-qty-plus]');
    var qtyValue = root.querySelector('[data-pm-qty-value]');
    var qtyNote = root.querySelector('[data-pm-qty-note]');
    var price = root.querySelector('[data-pm-price]');
    var compare = root.querySelector('[data-pm-compare]');
    var discount = root.querySelector('[data-pm-discount]');
    var stock = root.querySelector('[data-pm-stock]');
    var atc = root.querySelector('[data-pm-atc]');
    var buy = root.querySelector('[data-pm-buy]');
    var formVariant = root.querySelector('[data-pm-form-variant]');
    var formQty = root.querySelector('[data-pm-form-qty]');
    var wishlist = root.querySelector('[data-pm-wishlist]');

    bindPackScroller(root, root.dataset.pmRoot === 'desktop');
    bindAccordions(root);
    bindCoupons(root);

    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        store.set({ variantId: card.dataset.variantId });
      });
      card.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          store.set({ variantId: card.dataset.variantId });
        }
      });
    });

    if (minus) minus.addEventListener('click', function () { store.set({ qty: store.state.qty - 1 }); });
    if (plus) plus.addEventListener('click', function () { store.set({ qty: store.state.qty + 1 }); });
    if (atc) atc.addEventListener('click', function () { addToCart(store, atc, 'product-main-' + root.dataset.pmRoot); });
    if (buy) {
      // GoKwik handles the click through the button's onclick when it has loaded.
      buy.addEventListener('click', function () {
        if (typeof window.onBuyNowClick !== 'function') buyNowFallback(store);
      });
    }

    store.subscribe(function (variant, state, reason) {
      if (!variant) return;

      cards.forEach(function (card) {
        var selected = Number(card.dataset.variantId) === variant.id;
        card.classList.toggle('active', selected);
        card.setAttribute('aria-checked', selected ? 'true' : 'false');
      });

      if (price) price.textContent = '₹' + variant.price;
      if (compare) {
        compare.textContent = variant.compare ? '₹' + variant.compare : '';
        setHidden(compare, !variant.compare);
      }
      if (discount) {
        discount.textContent = variant.discount + '% off';
        setHidden(discount, !variant.compare || !variant.discount);
      }
      if (stock) {
        var text = lowStockText(store.data, variant);
        stock.textContent = text;
        setHidden(stock, !text);
      }

      var max = store.maxQty();
      if (qtyValue) qtyValue.textContent = state.qty;
      if (minus) minus.disabled = state.qty <= 1;
      if (plus) plus.disabled = state.qty >= max;
      if (qtyNote) {
        qtyNote.textContent = labels.maxQty.replace('[count]', max);
        setHidden(qtyNote, !(state.qty >= max && max > 1 && max < 99));
      }

      renderCartButton(atc, variant, labels);
      if (buy) buy.disabled = !variant.available;
      if (formVariant) formVariant.value = variant.id;
      if (formQty) formQty.value = state.qty;
      if (wishlist) wishlist.setAttribute('data-variant-id', variant.id);

      if (reason === 'variant' && variant.image >= 0) gallery.go(variant.image);
    });
  }

  /* ── Sticky bar ────────────────────────────────────────────────────────── */

  function bindStickyBar(store) {
    var bar = document.getElementById('psb-bar');
    if (!bar) return;
    var labels = store.data.labels;
    var selects = qsa(bar, '.psb-variant-select');
    var buttons = qsa(bar, '[data-psb-atc]');
    var price = bar.querySelector('.psb-price');
    var compare = bar.querySelector('.psb-compare');
    var discount = bar.querySelector('.psb-discount');

    selects.forEach(function (select) {
      select.addEventListener('change', function () {
        store.set({ variantId: select.value });
      });
    });
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        addToCart(store, button, 'product-sticky-bar');
      });
    });

    store.subscribe(function (variant) {
      if (!variant) return;
      selects.forEach(function (select) {
        select.value = String(variant.id);
      });
      if (price) price.textContent = '₹' + variant.price;
      if (compare) {
        compare.textContent = variant.compare ? '₹' + variant.compare : '';
        setHidden(compare, !variant.compare);
      }
      if (discount) {
        discount.textContent = variant.discount + '%off';
        setHidden(discount, !variant.compare || !variant.discount);
      }
      buttons.forEach(function (button) {
        renderCartButton(button, variant, labels);
      });
    });

    // Show the bar once the page's own Add to Cart has scrolled out of view.
    function pageButton() {
      var candidates = qsa(document, '[data-pm-atc], .pm-out');
      for (var i = 0; i < candidates.length; i++) {
        if (candidates[i].offsetParent !== null) return candidates[i];
      }
      return null;
    }

    function checkVisibility() {
      var button = pageButton();
      var buttonVisible = false;
      if (button) {
        var rect = button.getBoundingClientRect();
        buttonVisible = rect.top < window.innerHeight && rect.bottom > 0;
      }
      var footer = document.querySelector('footer');
      var footerVisible = false;
      if (footer) {
        var footerRect = footer.getBoundingClientRect();
        footerVisible = footerRect.height > 20 && footerRect.top < window.innerHeight - 100;
      }
      bar.style.display = buttonVisible || footerVisible ? 'none' : 'flex';
    }

    window.addEventListener('scroll', checkVisibility, { passive: true });
    window.addEventListener('resize', checkVisibility, { passive: true });
    checkVisibility();
  }

  /* ── Page-wide: delivery check, share, reviews link ────────────────────── */

  function placeDeliveryCheck() {
    var section = document.querySelector('.pm-desktop-only .pm-delivery-section');
    var desktopRight = section && section.parentElement;
    var placeholder = document.querySelector('.pm-mobile-delivery-placeholder');
    if (!section || !desktopRight || !placeholder) return;
    var anchor = section.nextElementSibling;
    var query = window.matchMedia(BREAKPOINT);

    function place() {
      if (query.matches) {
        placeholder.appendChild(section);
      } else {
        desktopRight.insertBefore(section, anchor && anchor.parentElement === desktopRight ? anchor : null);
      }
    }
    place();
    query.addEventListener('change', place);
  }

  function startShiprocket() {
    // Shiprocket's script loads on its own; give it up to 20 seconds, call it
    // once, and don't retry when it throws.
    var attempts = 0;
    (function attempt() {
      if (typeof window.editPromisePincode === 'function') {
        try {
          window.editPromisePincode();
        } catch (error) {
          console.warn('Shiprocket delivery check could not start:', error);
        }
        return;
      }
      attempts += 1;
      if (attempts < 40) setTimeout(attempt, 500);
    })();
  }

  // Height of the fixed or sticky header covering the top of the screen, if any.
  function headerOffset() {
    var el = document.elementFromPoint(window.innerWidth / 2, 1);
    while (el && el !== document.body && el !== document.documentElement) {
      var position = window.getComputedStyle(el).position;
      if (position === 'fixed' || position === 'sticky') {
        var rect = el.getBoundingClientRect();
        return rect.top <= 1 ? Math.max(0, rect.bottom) : 0;
      }
      el = el.parentElement;
    }
    return 0;
  }

  // Images between here and the target load while the page scrolls and push
  // it down, so check again once scrolling stops and settle on the target.
  function scrollToTarget(target) {
    function targetTop() {
      return target.getBoundingClientRect().top + window.pageYOffset - headerOffset() - 16;
    }
    var expected = targetTop();
    function settle() {
      // Stop correcting once the shopper scrolls somewhere else.
      if (Math.abs(window.pageYOffset - expected) > 40 && !settle.first) return;
      settle.first = false;
      var top = targetTop();
      if (Math.abs(top - window.pageYOffset) > 4) window.scrollTo({ top: top, behavior: 'auto' });
      expected = top;
    }
    settle.first = true;
    window.scrollTo({ top: expected, behavior: 'smooth' });
    // Skip a scrollend left over from scrolling just before the tap.
    setTimeout(function () {
      if ('onscrollend' in window) window.addEventListener('scrollend', settle, { once: true });
    }, 100);
    setTimeout(settle, 1200);
    setTimeout(settle, 2500);
  }

  function bindPageLinks(store) {
    // Judge.me also scrolls on clicks to #judgeme_product_reviews, without
    // allowing for the fixed header; handle them first and stop it there.
    document.addEventListener('click', function (event) {
      var reviewsLink = event.target.closest('a[href="#judgeme_product_reviews"]');
      if (!reviewsLink || !reviewsLink.closest('[data-pm-root]')) return;
      var target = document.getElementById('judgeme_product_reviews');
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      scrollToTarget(target);
    }, true);

    document.addEventListener('click', function (event) {
      var share = event.target.closest('[data-pm-share]');
      if (!share) return;
      var url = window.location.href;
      var status = share.parentElement && share.parentElement.querySelector('[data-pm-share-status]');
      function copied() {
        if (!status) return;
        status.textContent = store.data.labels.linkCopied;
        status.hidden = false;
        clearTimeout(status._pmTimer);
        status._pmTimer = setTimeout(function () {
          status.hidden = true;
        }, 2500);
      }
      if (navigator.share) {
        navigator.share({ title: share.dataset.title || document.title, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(copied).catch(function () {});
      }
    });
  }

  /* ── Start ─────────────────────────────────────────────────────────────── */

  function init() {
    var dataEl = document.querySelector('script[data-pm-data]');
    if (!dataEl) return;
    var data;
    try {
      data = JSON.parse(dataEl.textContent);
    } catch (error) {
      console.error('Product data could not be read', error);
      return;
    }

    var store = createStore(data);
    window.PMProduct = store;

    qsa(document, '[data-pm-root]').forEach(function (root) {
      try {
        bindLayout(root, store);
      } catch (error) {
        console.error(error);
      }
    });
    bindStickyBar(store);
    bindPageLinks(store);
    placeDeliveryCheck();
    startShiprocket();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
