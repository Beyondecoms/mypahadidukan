(function () {

  // ─── DOM REFS ────────────────────────────────────────────────────────────────
  const searchInput   = document.getElementById("custom-search-input");
  const resultsGrid   = document.getElementById("custom-search-results");
  const blogGrid      = document.getElementById("custom-blog-results");
  const countEl       = document.getElementById("custom-search-count");
  const loadingEl     = document.getElementById("custom-search-loading");
  const emptyEl       = document.getElementById("custom-search-empty");
  const headingEl     = document.getElementById("custom-search-heading");
  const productTitle  = document.getElementById("search-products-title");
  const blogTitle     = document.getElementById("search-blogs-title");

  let ALL_PRODUCTS = [];
  let ALL_ARTICLES = [];
  let debounceTimer = null;
  let dataLoaded    = false;

  // ─── FETCH ALL PRODUCTS via /products.json (paginated) ───────────────────────
  async function fetchAllProducts() {
    let products = [];
    let page = 1;

    while (true) {
      const res  = await fetch(`/products.json?limit=250&page=${page}`);
      const data = await res.json();
      const batch = data.products || [];

      if (batch.length === 0) break;
      products = products.concat(batch);
      if (batch.length < 250) break;
      page++;
    }

    return products;
  }

  // ─── FETCH ALL BLOGS + ARTICLES via /blogs.json then /blogs/{handle}/articles.json ──
  async function fetchAllArticles() {
    // 1. Get all blog handles
    const blogsRes  = await fetch("/blogs.json");
    const blogsData = await blogsRes.json();
    const blogs     = blogsData.blogs || [];

    let articles = [];

    // 2. For each blog, paginate through articles
    for (const blog of blogs) {
      let page = 1;

      while (true) {
        const res  = await fetch(`/blogs/${blog.handle}/articles.json?limit=250&page=${page}`);
        const data = await res.json();
        const batch = data.articles || [];

        if (batch.length === 0) break;

        // Attach blog handle + title to each article for URL building
        batch.forEach(a => {
          a._blog_handle = blog.handle;
          a._blog_title  = blog.title;
        });

        articles = articles.concat(batch);
        if (batch.length < 250) break;
        page++;
      }
    }

    return articles;
  }

  // ─── SCORING — products ──────────────────────────────────────────────────────
  function scoreProduct(p, term) {
    // Hide sold-out: available = false means all variants sold out
    if (p.available === false) return -1;

    const words = term.toLowerCase().trim().split(/\s+/);

    const haystack = [
      p.title        || "",
      p.vendor       || "",
      p.product_type || "",
      (p.tags || []).join(" "),
      p.body_html    || "",
    ].join(" ").toLowerCase();

    // Every word must appear somewhere
    if (!words.every(w => haystack.includes(w))) return -1;

    let score = 0;
    const titleLow = (p.title || "").toLowerCase();
    words.forEach(w => {
      score += titleLow.includes(w) ? 10 : 1;
    });

    return score;
  }

  // ─── SCORING — articles ──────────────────────────────────────────────────────
  function scoreArticle(a, term) {
    const words = term.toLowerCase().trim().split(/\s+/);

    const haystack = [
      a.title          || "",
      a.body_html      || "",
      a.summary_html   || "",
      a.author         || "",
      a._blog_title    || "",
      (a.tags || []).join(" "),
    ].join(" ").toLowerCase();

    if (!words.every(w => haystack.includes(w))) return -1;

    let score = 0;
    const titleLow = (a.title || "").toLowerCase();
    words.forEach(w => {
      score += titleLow.includes(w) ? 10 : 1;
    });

    return score;
  }

  // ─── MONEY FORMAT ────────────────────────────────────────────────────────────
  function money(paise) {
    // /products.json returns price in paise (e.g. "55000" = ₹550.00)
    const amount = parseFloat(paise) / 100;
    return "₹" + amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // ─── PRODUCT CARD ─────────────────────────────────────────────────────────────
  function productCardHTML(p) {
    // Pick the first available variant for price
    const variants   = p.variants || [];
    const firstVar   = variants[0] || {};
    const price      = firstVar.price      || "0";
    const compareAt  = firstVar.compare_at_price || "0";
    const hasDisc    = parseFloat(compareAt) > parseFloat(price);
    const disc       = hasDisc
      ? Math.round(((parseFloat(compareAt) - parseFloat(price)) / parseFloat(compareAt)) * 100)
      : 0;

    // Images: /products.json gives images array
    const imgObj = (p.images && p.images[0]) || {};
    const img    = imgObj.src
      ? imgObj.src.replace(/(\.[^.]+)$/, "_600x$1")   // Shopify CDN resize
      : "https://cdn.shopify.com/s/images/admin/no-image-medium.gif";
    const alt    = imgObj.alt || p.title;
    const url    = `/products/${p.handle}`;

    return `
    <div class="m:column m:w-1/2 sm:m:w-4/12 lg:m:w-3/12">
      <div class="search-product-card">
        <div class="search-product-card__image-wrapper">
          ${hasDisc ? `<span class="discount-badge">-${disc}%</span>` : ""}
          <a href="${url}">
            <img src="${img}" alt="${alt}" loading="lazy" class="search-product-card__image" />
          </a>
        </div>
        <div class="search-product-card__content">
          <h3 class="search-product-card__title"><a href="${url}">${p.title}</a></h3>
          <div class="search-product-card__price">
            <span class="sale-price">${money(price)}</span>
            ${hasDisc ? `<span class="compare-price">${money(compareAt)}</span>` : ""}
          </div>
          <a href="${url}" class="search-card-btn">
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 576 512">
              <path d="M0 24C0 10.7 10.7 0 24 0H69.5c22 0 41.5 12.8 50.6 32h411c26.3 0 45.5 25 38.6 50.4l-41 152.3c-8.5 31.4-37 53.3-69.5 53.3H170.7l5.4 28.5c2.2 11.3 12.1 19.5 23.6 19.5H488c13.3 0 24 10.7 24 24s-10.7 24-24 24H199.7c-34.6 0-64.3-24.6-70.7-58.5L77.4 54.5c-.7-3.8-4-6.5-7.9-6.5H24C10.7 48 0 37.3 0 24zm128 464a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm336-48a48 48 0 1 1 0 96 48 48 0 1 1 0-96z"/>
            </svg>
            Add to cart
          </a>
        </div>
      </div>
    </div>`;
  }

  // ─── BLOG CARD ────────────────────────────────────────────────────────────────
  function blogCardHTML(a) {
    const url     = `/blogs/${a._blog_handle}/${a.handle}`;
    const img     = a.image?.src
      ? a.image.src.replace(/(\.[^.]+)$/, "_600x$1")
      : "";
    const alt     = a.image?.alt || a.title;

    const date    = new Date(a.published_at).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric"
    });

    // Strip HTML from summary
    const rawExcerpt  = a.summary_html || a.body_html || "";
    const plainText   = rawExcerpt.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const excerpt     = plainText.length > 110
      ? plainText.substring(0, 110) + "…"
      : plainText;

    return `
    <div class="m:column m:w-1/2 sm:m:w-4/12 lg:m:w-3/12">
      <a href="${url}" class="search-blog-card">
        ${img ? `<div class="search-blog-card__img-wrap">
          <img src="${img}" alt="${alt}" loading="lazy" class="search-blog-card__img" />
        </div>` : ""}
        <div class="search-blog-card__body">
          <span class="search-blog-card__meta">${a._blog_title} · ${date}</span>
          <h3 class="search-blog-card__title">${a.title}</h3>
          ${excerpt ? `<p class="search-blog-card__excerpt">${excerpt}</p>` : ""}
          <span class="search-blog-card__readmore">Read More →</span>
        </div>
      </a>
    </div>`;
  }

  // ─── RUN SEARCH ──────────────────────────────────────────────────────────────
  function runSearch(term) {
    term = (term || "").trim();

    // Update heading
    if (headingEl) {
      headingEl.textContent = term
        ? `Products matching "${term}"`
        : "Search";
    }

    // Clear if blank
    if (!term || term.length < 2) {
      resultsGrid.innerHTML = "";
      if (blogGrid)      blogGrid.innerHTML = "";
      if (countEl)       countEl.textContent = "";
      if (emptyEl)       emptyEl.style.display = "none";
      if (productTitle)  productTitle.style.display = "none";
      if (blogTitle)     blogTitle.style.display = "none";
      return;
    }

    // Wait for data if still loading
    if (!dataLoaded) {
      if (countEl) countEl.textContent = "Still loading catalogue…";
      return;
    }

    const scored = ALL_PRODUCTS
      .map(p  => ({ p,  score: scoreProduct(p,  term) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const scoredA = ALL_ARTICLES
      .map(a  => ({ a,  score: scoreArticle(a,  term) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const total = scored.length + scoredA.length;

    // Count
    if (countEl) {
      countEl.textContent = total > 0
        ? `${total} result${total !== 1 ? "s" : ""} for "${term}"`
        : "";
    }

    // Empty state
    if (total === 0) {
      resultsGrid.innerHTML = "";
      if (blogGrid) blogGrid.innerHTML = "";
      if (productTitle) productTitle.style.display = "none";
      if (blogTitle)    blogTitle.style.display = "none";
      if (emptyEl) {
        emptyEl.style.display = "block";
        const termEl = document.getElementById("empty-term");
        if (termEl) termEl.textContent = term;
      }
      return;
    }

    if (emptyEl) emptyEl.style.display = "none";

    // Products section
    if (scored.length > 0) {
      if (productTitle) productTitle.style.display = "";
      resultsGrid.innerHTML = scored.map(({ p }) => productCardHTML(p)).join("");
    } else {
      if (productTitle) productTitle.style.display = "none";
      resultsGrid.innerHTML = "";
    }

    // Blog section
    if (blogGrid) {
      if (scoredA.length > 0) {
        if (blogTitle) blogTitle.style.display = "";
        blogGrid.innerHTML = scoredA.map(({ a }) => blogCardHTML(a)).join("");
      } else {
        if (blogTitle)    blogTitle.style.display = "none";
        blogGrid.innerHTML = "";
      }
    }
  }

  // ─── INIT ────────────────────────────────────────────────────────────────────
  async function init() {
    if (!searchInput || !resultsGrid) return;

    if (loadingEl) loadingEl.style.display = "flex";

    try {
      [ALL_PRODUCTS, ALL_ARTICLES] = await Promise.all([
        fetchAllProducts(),
        fetchAllArticles(),
      ]);
      dataLoaded = true;
      console.log(`[SearchEngine] ${ALL_PRODUCTS.length} products, ${ALL_ARTICLES.length} articles loaded.`);
    } catch (err) {
      console.error("[SearchEngine] Fetch failed:", err);
    }

    if (loadingEl) loadingEl.style.display = "none";

    // Run on page load if ?q= is in URL
    const initialTerm = new URLSearchParams(window.location.search).get("q") || "";
    if (initialTerm) {
      searchInput.value = initialTerm;
      runSearch(initialTerm);
    }

    // Live search
    searchInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const term = searchInput.value;
        const url  = new URL(window.location.href);
        url.searchParams.set("q", term);
        window.history.replaceState({}, "", url);
        runSearch(term);
      }, 300);
    });
  }

  document.addEventListener("DOMContentLoaded", init);

})();