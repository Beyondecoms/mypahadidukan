/**
 * Loyalty page ↔ YourToken
 *
 * - [data-lp-login] links ("Start Earning", and the fallback hero button) open
 *   the YourToken widget: its sign-in for guests, rewards for members. Without
 *   the widget on the page they work as plain links.
 * - <loyalty-hero> shows the member dashboard (points, tier progress by spend,
 *   tier ladder) in place of the banner while the shopper has a YourToken
 *   session. Guests keep the banner: the image banner, or YourToken's own (app
 *   block). On small screens without a mobile image, the image banner swipes
 *   sideways: it opens on the first panel and the arrows step between panels.
 * - <loyalty-earn> replaces the static "ways to earn" cards with YourToken's
 *   live cards (rendered by the Loyalty Page app block) once they load. The live
 *   cards keep YourToken's actions (add birthday, follow, ...) and borrow the
 *   look of the static card with the same icon.
 *
 * The session and API calls are the ones the YourToken widget itself uses.
 */
(() => {
  if (window.LoyaltyPage) return;

  const API = 'https://api.yourtoken.io/api/v1';
  const SESSION_KEY = 'widget_session';

  const readStorage = (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  };

  /** Opens the YourToken widget: its sign-in for guests, rewards for members. */
  function openYourToken() {
    if (typeof window.showYtLoyalty !== 'function') return false;
    window.showYtLoyalty();
    if (window.ytapp) {
      window.ytapp.loyaltyWidgetOpen = true;
      window.dispatchEvent(new CustomEvent('loyaltyWidgetOpenChanged'));
    }
    return true;
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest && event.target.closest('[data-lp-login]');
    if (!trigger || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (openYourToken()) event.preventDefault();
  });

  /* ── Member dashboard ─────────────────────────────────────────────────── */

  async function ytGet(path, params) {
    const token = readStorage(SESSION_KEY);
    if (!token) return null;
    const response = await fetch(`${API}${path}?${new URLSearchParams(params)}`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    if (!response.ok) throw new Error(`YourToken ${path} responded ${response.status}`);
    return response.json();
  }

  let brandIdRequest = null;

  function getBrandId(storeId) {
    if (window.ytapp && window.ytapp.brandId) return Promise.resolve(window.ytapp.brandId);
    try {
      const cached = JSON.parse(readStorage('ytBrandData') || 'null');
      if (cached && cached.brandId) return Promise.resolve(cached.brandId);
    } catch (error) {
      // Ignore a malformed cache and ask the API instead.
    }
    if (!brandIdRequest) {
      brandIdRequest = fetch(`${API}/brand/shopify/${storeId}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((brand) => (brand && brand.brandId) || null)
        .catch(() => null);
    }
    return brandIdRequest;
  }

  /** Banner swipe on small screens: snap stops at the centre of each panel. */
  function bindHeroSwipe(root) {
    const scroller = root.querySelector('[data-lp-hero-scroller]');
    const stops = scroller ? [...scroller.querySelectorAll('[data-lp-hero-stop]')] : [];
    const prev = root.querySelector('[data-lp-hero-prev]');
    const next = root.querySelector('[data-lp-hero-next]');
    if (!stops.length || !prev || !next) return;

    // Scroll positions that centre each stop, limited to what can be scrolled.
    const targets = () => {
      const max = scroller.scrollWidth - scroller.clientWidth;
      return stops.map((stop) => Math.min(max, Math.max(0, stop.offsetLeft - scroller.clientWidth / 2)));
    };
    const scrollable = () => scroller.scrollWidth - scroller.clientWidth > 1;

    const sync = () => {
      const left = scroller.scrollLeft;
      const points = targets();
      prev.hidden = !scrollable() || !points.some((point) => point < left - 2);
      next.hidden = !scrollable() || !points.some((point) => point > left + 2);
    };

    prev.addEventListener('click', () => {
      const left = scroller.scrollLeft;
      const point = targets().filter((value) => value < left - 2).pop();
      if (point !== undefined) scroller.scrollTo({ left: point, behavior: 'smooth' });
    });
    next.addEventListener('click', () => {
      const left = scroller.scrollLeft;
      const point = targets().find((value) => value > left + 2);
      if (point !== undefined) scroller.scrollTo({ left: point, behavior: 'smooth' });
    });

    scroller.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    if (scrollable()) scroller.scrollLeft = targets()[0];
    sync();
  }

  class LoyaltyHero extends HTMLElement {
    connectedCallback() {
      bindHeroSwipe(this);
      this.member = this.querySelector('[data-lp-member]');
      const configElement = this.querySelector('[data-lp-config]');
      if (!this.member || !configElement) return;

      try {
        this.config = JSON.parse(configElement.textContent);
      } catch (error) {
        return;
      }

      this.money = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: this.config.currency || 'INR',
        maximumFractionDigits: 0,
      });

      this.querySelectorAll('[data-lp-req]').forEach((element, index) => {
        const tier = this.config.tiers[index];
        if (tier) element.textContent = this.formatMoney(tier.spend);
      });

      this.update = this.update.bind(this);
      this.onStorage = (event) => {
        if (!event.key || event.key === SESSION_KEY || event.key === 'yt-auth-state') this.update();
      };
      document.addEventListener('yt:auth:state-updated', this.update);
      document.addEventListener('yt:auth:session-expired', this.update);
      window.addEventListener('storage', this.onStorage);
      this.update();
    }

    disconnectedCallback() {
      if (!this.update) return;
      document.removeEventListener('yt:auth:state-updated', this.update);
      document.removeEventListener('yt:auth:session-expired', this.update);
      window.removeEventListener('storage', this.onStorage);
    }

    formatMoney(amount) {
      return this.money.format(Math.max(0, Math.round(Number(amount) || 0)));
    }

    update() {
      // The hero's inline guard has already dropped a session the store no longer backs.
      const signedIn = Boolean(readStorage(SESSION_KEY));
      this.dataset.state = signedIn ? 'member' : 'guest';
      if (signedIn) {
        this.load();
      } else {
        this.loadedSession = null;
      }
    }

    async load() {
      const session = readStorage(SESSION_KEY);
      if (this.loadedSession === session) return;
      this.loadedSession = session;

      const storeId = (window.ytapp && window.ytapp.storeId) || this.dataset.shopId;
      this.member.setAttribute('data-loading', '');
      try {
        const brandId = await getBrandId(storeId);
        const userParams = { includeUserBrandLink: 'true', includeUserLtv: 'true' };
        if (brandId) userParams.brandId = brandId;
        const [points, user] = await Promise.all([
          ytGet('/loyalty-points/brand-user', {
            shopifyStoreId: storeId,
            creationMethod: 'loyalty_points_coupons',
          }).catch(() => null),
          ytGet('/users/me', userParams).catch(() => null),
        ]);
        if (this.loadedSession !== session) return;
        // Nothing came back (expired session, API down): keep YourToken's own banner.
        if (!points && !user) {
          this.loadedSession = null;
          this.dataset.state = 'guest';
          return;
        }
        this.render(points, user);
      } finally {
        this.member.removeAttribute('data-loading');
      }
    }

    render(pointsData, user) {
      const { tiers } = this.config;
      const link = (user && user.userBrandLink) || {};
      const points = Math.max(0, Math.round(Number(pointsData && pointsData.points) || 0));
      const spendValue = typeof link.tierPeriodLtv === 'number' ? link.tierPeriodLtv : link.currentLtv;
      const spend = Math.max(0, Number(spendValue) || 0);

      // Tier from spend, unless YourToken has assigned one of these tiers itself.
      let level = 0;
      tiers.forEach((tier, index) => {
        if (spend >= tier.spend) level = index + 1;
      });
      const assigned = link.rewardTier && typeof link.rewardTier.name === 'string' ? link.rewardTier.name : '';
      const assignedIndex = tiers.findIndex((tier) => tier.name.toLowerCase() === assigned.toLowerCase());
      if (assignedIndex > -1) level = assignedIndex + 1;

      const current = level > 0 ? tiers[level - 1] : null;
      const next = tiers[level] || null;

      this.member.dataset.tier = String(level);
      this.setText('[data-lp-points]', points.toLocaleString('en-IN'));
      this.setText(
        '[data-lp-status]',
        current
          ? `${this.config.prefix} ${current.name}`.trim().toUpperCase()
          : spend > 0
          ? `${this.config.prefix} ${this.config.memberLabel}`.trim().toUpperCase()
          : this.config.startText
      );
      this.setText('[data-lp-tier-name]', current ? current.name : this.config.memberLabel);

      const art = this.querySelector('[data-lp-art]');
      if (art) {
        art.src = current ? current.badgeLarge : this.config.art;
        art.width = current ? 400 : 363;
        art.height = current ? 400 : 235;
      }

      const sinceValue = link.rewardTierAcquiredAt || link.createdAt;
      const since = sinceValue ? new Date(sinceValue) : null;
      const sinceElement = this.querySelector('[data-lp-since]');
      if (sinceElement) {
        const valid = since && !Number.isNaN(since.getTime());
        sinceElement.textContent = valid ? since.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
        sinceElement.closest('.lp-member__since').hidden = !valid;
      }

      const progress = next ? Math.min(1, spend / Math.max(1, next.spend)) : 1;
      const percent = Math.round(progress * 100);
      const bar = this.querySelector('[data-lp-bar]');
      if (bar) bar.setAttribute('aria-valuenow', String(percent));
      const fill = this.querySelector('[data-lp-fill]');
      if (fill) fill.style.width = `${Math.max(5, percent)}%`;

      const nextBadge = this.querySelector('[data-lp-next-badge]');
      if (nextBadge) nextBadge.src = (next || current || tiers[0]).badge;

      const spent = this.querySelector('[data-lp-spent]');
      if (spent) {
        spent.textContent = this.formatMoney(spend);
        spent.hidden = !next;
      }

      const goal = this.querySelector('[data-lp-goal]');
      if (goal) {
        if (next) {
          const tierName = document.createElement('b');
          tierName.textContent = `${this.config.prefix} ${next.name}`.trim();
          const [before, after = ''] = this.config.goalText
            .replace('[amount]', this.formatMoney(next.spend - spend))
            .split('[tier]');
          goal.replaceChildren(before, tierName, after);
        } else {
          goal.innerHTML = this.config.topText;
        }
      }

      this.querySelectorAll('[data-lp-ladder]').forEach((item) => {
        const unlocked = Number(item.dataset.lpLadder) <= level;
        item.classList.toggle('is-unlocked', unlocked);
        const status = item.querySelector('[data-lp-ladder-status]');
        if (status) status.hidden = !unlocked;
      });
    }

    setText(selector, text) {
      const element = this.querySelector(selector);
      if (element) element.textContent = text;
    }
  }

  /* ── Live "ways to earn" cards ────────────────────────────────────────── */

  const EARN_TYPES = [
    ['birthday', /birthday/i],
    ['instagram', /instagram/i],
    ['feedback', /feedback|review/i],
    ['signup', /sign\s*up/i],
    ['first-order', /first order/i],
    ['youtube', /youtube/i],
    ['facebook', /facebook/i],
    ['twitter', /twitter/i],
  ];
  const CARD_VARIABLES = ['--card-end', '--card-title', '--card-edge'];

  class LoyaltyEarn extends HTMLElement {
    connectedCallback() {
      this.app = this.querySelector('[data-lp-earn-app]');
      if (!this.app) return;

      // Static cards, by reward type, with their position in the grid.
      this.looks = {};
      this.querySelectorAll('[data-lp-earn-type]').forEach((card, index) => {
        const type = card.dataset.lpEarnType;
        if (!this.looks[type]) this.looks[type] = { card, order: index };
      });

      this.observer = new MutationObserver(() => this.sync());
      this.observer.observe(this.app, { childList: true, subtree: true });
      this.sync();
    }

    disconnectedCallback() {
      if (this.observer) this.observer.disconnect();
    }

    sync() {
      const items = this.app.querySelectorAll('.yt-loyalty-page-ways-to-earn-item');
      if (!items.length) return;
      items.forEach((item) => this.dress(item));
      if (!this.hasAttribute('data-live')) this.setAttribute('data-live', '');
    }

    dress(item) {
      if (item.hasAttribute('data-lp-type')) return;
      const titleElement = item.querySelector('.yt-loyalty-page-ways-to-earn-item-title');
      const title = titleElement ? titleElement.textContent : '';
      const match = EARN_TYPES.find(([, pattern]) => pattern.test(title));
      const type = match ? match[0] : 'other';
      item.setAttribute('data-lp-type', type);

      // YourToken lists rewards in its own order; follow the static cards'.
      const look = this.looks[type];
      item.style.setProperty('order', look ? String(look.order) : '50');
      if (!look) return;
      CARD_VARIABLES.forEach((name) => {
        const value = look.card.style.getPropertyValue(name);
        if (value) item.style.setProperty(name, value);
      });
      const icon = look.card.querySelector('img');
      if (icon) {
        item.style.setProperty('--card-icon', `url("${icon.currentSrc || icon.src}")`);
        item.setAttribute('data-lp-icon', '');
      }
    }
  }

  if (!customElements.get('loyalty-hero')) customElements.define('loyalty-hero', LoyaltyHero);
  if (!customElements.get('loyalty-earn')) customElements.define('loyalty-earn', LoyaltyEarn);

  window.LoyaltyPage = { openYourToken };
})();
