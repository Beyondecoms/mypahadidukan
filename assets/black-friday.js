/* Black Friday landing page.
   One clock drives every Black Friday section on the page: the hero countdown
   and the button and label text for each phase (live / ended).
   The sale end date comes from Theme settings → Black Friday sale. */
(function () {
  'use strict';

  if (window.mpdBlackFriday) return;
  window.mpdBlackFriday = true;

  var loadedAt = Date.now();

  function readSale() {
    var el = document.querySelector('[data-bf-sale]');
    if (!el) return null;
    return {
      end: Date.parse(el.dataset.end),
      preview: el.dataset.preview || 'auto'
    };
  }

  // Preview phases run a realistic clock, offset like the design's preview.
  function clockNow(sale) {
    var real = Date.now();
    var elapsed = real - loadedAt;
    if (sale.preview === 'live') return sale.end - (1 * 86400 + 7 * 3600 + 14 * 60 + 42) * 1000 + elapsed;
    if (sale.preview === 'ended') return sale.end + 3600000;
    return real;
  }

  function phaseAt(sale, now) {
    if (isNaN(sale.end)) return 'live';
    return now < sale.end ? 'live' : 'ended';
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function showFor(root, phase) {
    root.querySelectorAll('[data-bf-when]').forEach(function (el) {
      el.hidden = el.dataset.bfWhen.split(' ').indexOf(phase) === -1;
    });
  }

  /* ── Hero ─────────────────────────────────────────── */

  function applyHero(hero, phase) {
    var d = hero.dataset;
    var label = hero.querySelector('[data-bf-label]');
    var sub = hero.querySelector('[data-bf-sub]');
    var timer = hero.querySelector('[data-bf-timer]');
    if (label) label.textContent = d['label' + cap(phase)] || '';
    if (sub) sub.textContent = d['sub' + cap(phase)] || '';
    if (timer) timer.setAttribute('aria-label', d['aria' + cap(phase)] || '');
    showFor(hero, phase);
  }

  function tickHero(hero, sale, phase, now) {
    var diff = phase === 'ended' ? 0 : Math.max(0, sale.end - now);
    var s = Math.floor(diff / 1000);
    var parts = {
      dd: pad(Math.floor(s / 86400)),
      hh: pad(Math.floor((s % 86400) / 3600)),
      mm: pad(Math.floor((s % 3600) / 60)),
      ss: pad(s % 60)
    };
    Object.keys(parts).forEach(function (k) {
      var el = hero.querySelector('[data-bf-' + k + ']');
      if (el && el.textContent !== parts[k]) el.textContent = parts[k];
    });
  }

  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* ── Deals ────────────────────────────────────────── */

  function initDeals(root) {
    var grid = root.querySelector('[data-bf-grid]');
    if (!grid) return null;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('[data-bf-card]'));
    var state = { root: root, grid: grid, cards: cards, filter: 'all', phase: null };

    root.querySelectorAll('[data-bf-chip]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.filter = chip.dataset.bfChip;
        root.querySelectorAll('[data-bf-chip]').forEach(function (c) {
          c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
        });
        var title = root.querySelector('[data-bf-title]');
        if (title) title.textContent = state.filter === 'all' ? root.dataset.title : chip.dataset.label;
        render(state);
      });
    });

    grid.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-bf-add]');
      if (!btn || btn.disabled) return;
      addToCart(btn);
    });

    return state;
  }

  function render(state) {
    var root = state.root;
    var d = root.dataset;
    var phase = state.phase;
    var order = state.cards.slice();

    if (phase === 'live') {
      order.sort(function (a, b) {
        return Number(b.dataset.pct) - Number(a.dataset.pct) || Number(a.dataset.index) - Number(b.dataset.index);
      });
    } else {
      order.sort(function (a, b) {
        return Number(a.dataset.index) - Number(b.dataset.index);
      });
    }

    var shown = 0;
    order.forEach(function (card) {
      var cats = (card.dataset.cats || '').split(' ');
      var visible = state.filter === 'all' || cats.indexOf(state.filter) !== -1;
      card.hidden = !visible;
      if (visible) shown += 1;
      state.grid.appendChild(card);
    });

    var count = root.querySelector('[data-bf-count]');
    if (count) count.textContent = (d['count' + cap(phase)] || '').replace('[count]', shown);
    var empty = root.querySelector('[data-bf-empty]');
    if (empty) empty.hidden = shown !== 0;
  }

  function applyDeals(state, phase) {
    state.phase = phase;
    var d = state.root.dataset;
    state.cards.forEach(function (card) {
      var available = card.dataset.available === 'true';
      card.dataset.phase = phase;
      card.classList.toggle('is-soldout', phase === 'live' && !available);
      setText(card, '[data-bf-strip]', d['strip' + cap(phase)]);

      var btn = card.querySelector('[data-bf-add]');
      if (btn) {
        var label = phase === 'live' ? (available ? d.btnLive : d.btnSoldout) : d.btnEnded;
        btn.textContent = label;
        btn.dataset.label = label;
        btn.disabled = phase !== 'live' || !available;
      }
    });
    render(state);
  }

  function setText(scope, selector, value) {
    var el = scope.querySelector(selector);
    if (el && value != null && el.textContent !== value) el.textContent = value;
  }

  // Same cart flow as the theme's product sliders: add, refresh the drawer, open it.
  function addToCart(btn) {
    var label = btn.dataset.label || btn.textContent;
    btn.disabled = true;
    btn.textContent = btn.closest('[data-bf-deals]').dataset.btnAdding || 'Adding...';

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: btn.dataset.variantId,
        quantity: 1,
        sections: ['cart-drawer'],
        sections_url: window.location.pathname
      })
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (added) {
        if (added && added.sections && added.sections['cart-drawer']) {
          var html = new DOMParser().parseFromString(added.sections['cart-drawer'], 'text/html');
          swap(html, '#nc-body');
          var breakdown = html.querySelector('.nc-price-breakdown');
          if (breakdown) {
            var old = document.querySelector('.nc-price-breakdown');
            if (old) old.replaceWith(breakdown);
            else {
              var footer = document.querySelector('.cart-drawer__footer');
              if (footer) footer.insertAdjacentElement('beforebegin', breakdown);
            }
          }
          swap(html, '.cart-drawer__footer');
        }
        if (typeof window.ncCartOpen === 'function') window.ncCartOpen();
        return fetch('/cart.js', { headers: { 'X-Requested-With': 'XMLHttpRequest' } }).then(function (r) {
          return r.json();
        });
      })
      .then(function (cart) {
        if (typeof publish !== 'undefined' && typeof PUB_SUB_EVENTS !== 'undefined') {
          publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: cart });
        }
        if (typeof window.ncUpdatePriceBreakdown === 'function') window.ncUpdatePriceBreakdown(cart);
      })
      .catch(function (error) {
        console.error(error);
      })
      .finally(function () {
        btn.textContent = label;
        btn.disabled = false;
      });
  }

  function swap(doc, selector) {
    var fresh = doc.querySelector(selector);
    var current = document.querySelector(selector);
    if (fresh && current) current.replaceWith(fresh);
  }

  /* ── Clock ────────────────────────────────────────── */

  var interval = null;

  function start() {
    clearInterval(interval);
    var sale = readSale();
    if (!sale) return;

    var heroes = Array.prototype.slice.call(document.querySelectorAll('[data-bf-hero]'));
    var deals = Array.prototype.slice
      .call(document.querySelectorAll('[data-bf-deals]'))
      .map(initDeals)
      .filter(Boolean);
    var others = Array.prototype.slice.call(document.querySelectorAll('[data-bf-phased]'));
    var current = null;

    function tick() {
      var now = clockNow(sale);
      var phase = phaseAt(sale, now);
      if (phase !== current) {
        current = phase;
        heroes.forEach(function (hero) {
          applyHero(hero, phase);
        });
        deals.forEach(function (state) {
          applyDeals(state, phase);
        });
        others.forEach(function (el) {
          showFor(el, phase);
        });
      }
      heroes.forEach(function (hero) {
        tickHero(hero, sale, phase, now);
      });
    }

    tick();
    interval = setInterval(tick, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // Theme editor: a section re-renders in place, so pick up its new markup and settings.
  document.addEventListener('shopify:section:load', start);
})();
