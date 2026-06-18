(function () {
  // DOM Elements
  let headingEl = null;
  let searchInput = null;
  let countEl = null;
  let loadingEl = null;
  let emptyEl = null;
  let emptyTermEl = null;
  let productTitleEl = null;
  let resultsGrid = null;
  let blogTitleEl = null;
  let blogGrid = null;

  let ALL_PRODUCTS = [];
  let ALL_ARTICLES = [];
  let debounceTimer = null;
  let isCatalogLoaded = false;

  // Normalization helper (diacritics removal, lowercased, punctuation-free)
  function normalizeString(str) {
    return String(str || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents/diacritics
      .replace(/[^a-z0-9\s]/g, " ")    // Replace punctuation with spaces
      .replace(/\s+/g, " ")
      .trim();
  }

  // Shopify CDN image resizer that respects query parameters
  function resizeShopifyImage(src) {
    if (!src) return "";
    try {
      const url = new URL(src, window.location.origin);
      url.pathname = url.pathname.replace(/(\.[^.\/]+)$/, "_600x$1");
      return url.toString();
    } catch (e) {
      // Punctuation fallback in case of invalid URL structure
      return src.replace(/(\.[^.\/\?]+)(\?.*)?$/, "_600x$1$2");
    }
  }

  // Formatting Money (INR formatted in Rupees, no division by 100)
  function formatMoney(amountString) {
    const amount = parseFloat(amountString || 0);
    return "₹" + amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // Fetch paginated products.json
  async function fetchAllProducts() {
    let products = [];
    let page = 1;
    let shouldFetch = true;

    while (shouldFetch) {
      try {
        const response = await fetch(`/products.json?limit=250&page=${page}`);
        if (!response.ok) {
          throw new Error(`Response status code: ${response.status}`);
        }
        const data = await response.json();
        const batch = data.products || [];

        if (batch.length === 0) {
          break;
        }

        products = products.concat(batch);
        if (batch.length < 250) {
          shouldFetch = false;
        } else {
          page++;
        }
      } catch (err) {
        console.error(`[SearchEngine] fetchAllProducts failed at page ${page}:`, err);
        throw err; // bubble up to handle in loading handler
      }
    }

    console.log(`[SearchEngine] fetchAllProducts loaded total products count: ${products.length}`);
    return products;
  }

  // Fetch blogs + articles from inline Liquid JSON block (bypassing non-existent blogs.json)
  async function fetchAllArticles() {
    let articles = [];
    try {
      const dataEl = document.getElementById("mpd-blogs-data");
      if (dataEl) {
        const parsed = JSON.parse(dataEl.textContent || "[]");
        console.log(`[SearchEngine] Loaded ${parsed.length} articles from inline Liquid JSON.`);
        
        // Map fields to match search logic expectations
        articles = parsed.map(a => {
          a._blog_handle = a.blog_handle;
          a._blog_title = a.blog_title;
          return a;
        });
      }
    } catch (err) {
      console.warn("[SearchEngine] fetchAllArticles failed, falling back to empty list:", err);
      return []; // fallback gracefully
    }

    console.log(`[SearchEngine] fetchAllArticles loaded total articles count: ${articles.length}`);
    return articles;
  }

  // Check product availability based on available boolean and variant stock levels
  function isProductAvailable(p) {
    if (p.available !== false) {
      return true;
    }
    const variants = p.variants || [];
    if (variants.length === 0) {
      return false;
    }
    return variants.some(v => {
      // If inventory_management is null, it means inventory is not tracked (always available)
      if (v.inventory_management === null || v.inventory_management === undefined) {
        return true;
      }
      return v.inventory_quantity > 0;
    });
  }

  // Score product based on matching words (title, tags, product_type, vendor, handle)
  function scoreProduct(p, term) {
    if (!isProductAvailable(p)) {
      return -1;
    }

    // Exclude draft/archived if status field is present
    if (p.status && (p.status === 'draft' || p.status === 'archived')) {
      return -1;
    }

    const normQuery = normalizeString(term);
    const queryWords = normQuery.split(" ").filter(Boolean);
    if (queryWords.length === 0) return -1;

    const titleNorm = normalizeString(p.title);
    const tagsNorm = normalizeString((p.tags || []).join(" "));
    const typeNorm = normalizeString(p.product_type);
    const vendorNorm = normalizeString(p.vendor);
    const handleNorm = normalizeString(p.handle);

    const haystack = `${titleNorm} ${tagsNorm} ${typeNorm} ${vendorNorm} ${handleNorm}`;
    const targetWords = haystack.split(" ").filter(Boolean);

    // Verify all terms are present as startsWith/endsWith in target words (fuzzy/prefix/suffix matching)
    const allMatched = queryWords.every(qWord =>
      targetWords.some(tWord => tWord.startsWith(qWord) || tWord.endsWith(qWord))
    );
    if (!allMatched) return -1;

    let score = 0;

    // Direct match boosts
    if (titleNorm === normQuery) {
      score += 1000;
    } else if (titleNorm.startsWith(normQuery)) {
      score += 500;
    } else if (titleNorm.includes(normQuery)) {
      score += 300;
    }

    // Individual word matches weights
    queryWords.forEach(word => {
      if (titleNorm.includes(word)) score += 50;
      if (tagsNorm.includes(word)) score += 30;
      if (typeNorm.includes(word)) score += 20;
      if (vendorNorm.includes(word)) score += 10;
      if (handleNorm.includes(word)) score += 5;
    });

    return score;
  }

  // Score articles based on matching words (title, tags, body_html, blog_title)
  function scoreArticle(a, term) {
    const normQuery = normalizeString(term);
    const queryWords = normQuery.split(" ").filter(Boolean);
    if (queryWords.length === 0) return -1;

    const titleNorm = normalizeString(a.title);
    const tagsNorm = normalizeString((a.tags || []).join(" "));
    const bodyNorm = normalizeString(a.body_html || a.summary_html);
    const blogTitleNorm = normalizeString(a.blog_title || a._blog_title);

    const haystack = `${titleNorm} ${tagsNorm} ${bodyNorm} ${blogTitleNorm}`;
    const targetWords = haystack.split(" ").filter(Boolean);

    const allMatched = queryWords.every(qWord =>
      targetWords.some(tWord => tWord.startsWith(qWord) || tWord.endsWith(qWord))
    );
    if (!allMatched) return -1;

    let score = 0;

    if (titleNorm === normQuery) {
      score += 500;
    } else if (titleNorm.startsWith(normQuery)) {
      score += 250;
    } else if (titleNorm.includes(normQuery)) {
      score += 150;
    }

    queryWords.forEach(word => {
      if (titleNorm.includes(word)) score += 40;
      if (tagsNorm.includes(word)) score += 20;
      if (blogTitleNorm.includes(word)) score += 10;
    });

    return score;
  }

  // HTML Markup generator for product cards using original theme styles/classes
  function productCardHTML(p) {
    const variants = p.variants || [];
    const firstVar = variants[0] || {};
    const price = firstVar.price || "0";
    const compareAt = firstVar.compare_at_price || "0";
    const hasDisc = parseFloat(compareAt) > parseFloat(price);
    const disc = hasDisc
      ? Math.round(((parseFloat(compareAt) - parseFloat(price)) / parseFloat(compareAt)) * 100)
      : 0;

    const imgObj = (p.images && p.images[0]) || {};
    const img = imgObj.src
      ? resizeShopifyImage(imgObj.src)
      : "https://cdn.shopify.com/s/images/admin/no-image-large.gif";
    const alt = imgObj.alt || p.title;
    const url = `/products/${p.handle}`;

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
              <span class="sale-price">${formatMoney(price)}</span>
              ${hasDisc ? `<span class="compare-price">${formatMoney(compareAt)}</span>` : ""}
            </div>
            <a href="${url}" class="search-card-btn">
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 576 512" style="display:inline-block; vertical-align:middle; margin-right:4px;">
                <path d="M0 24C0 10.7 10.7 0 24 0H69.5c22 0 41.5 12.8 50.6 32h411c26.3 0 45.5 25 38.6 50.4l-41 152.3c-8.5 31.4-37 53.3-69.5 53.3H170.7l5.4 28.5c2.2 11.3 12.1 19.5 23.6 19.5H488c13.3 0 24 10.7 24 24s-10.7 24-24 24H199.7c-34.6 0-64.3-24.6-70.7-58.5L77.4 54.5c-.7-3.8-4-6.5-7.9-6.5H24C10.7 48 0 37.3 0 24zm128 464a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm336-48a48 48 0 1 1 0 96 48 48 0 1 1 0-96z"/>
              </svg>
              Add to cart
            </a>
          </div>
        </div>
      </div>
    `;
  }

  // HTML Markup generator for blog cards
  function blogCardHTML(a) {
    const url = `/blogs/${a._blog_handle}/${a.handle}`;
    const img = a.image?.src
      ? resizeShopifyImage(a.image.src)
      : "";
    const alt = a.image?.alt || a.title;
    const date = a.published_at || "";

    const rawExcerpt = a.summary_html || a.body_html || "";
    const plainText = rawExcerpt.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const excerpt = plainText.length > 110
      ? plainText.substring(0, 110) + "…"
      : plainText;

    return `
      <div class="m:column m:w-1/2 sm:m:w-4/12 lg:m:w-3/12">
        <a href="${url}" class="search-blog-card">
          ${img ? `
          <div class="search-blog-card__img-wrap">
            <img src="${img}" alt="${alt}" loading="lazy" class="search-blog-card__img" />
          </div>` : ""}
          <div class="search-blog-card__body">
            <span class="search-blog-card__meta">${a._blog_title || ""} ${date ? " · " + date : ""}</span>
            <h3 class="search-blog-card__title">${a.title}</h3>
            ${excerpt ? `<p class="search-blog-card__excerpt">${excerpt}</p>` : ""}
            <span class="search-blog-card__readmore">Read More →</span>
          </div>
        </a>
      </div>
    `;
  }

  // Search execution pipeline
  function runSearch(term) {
    term = (term || "").trim();

    // Update main heading
    if (headingEl) {
      headingEl.textContent = term
        ? `Products matching "${term}"`
        : "Search";
    }

    // Clear and exit if query is too short
    if (!term || term.length < 2) {
      resultsGrid.innerHTML = "";
      if (blogGrid) blogGrid.innerHTML = "";
      if (countEl) countEl.textContent = "";
      if (emptyEl) emptyEl.style.display = "none";
      if (productTitleEl) productTitleEl.style.display = "none";
      if (blogTitleEl) blogTitleEl.style.display = "none";
      return;
    }

    if (!isCatalogLoaded) {
      if (countEl) {
        countEl.textContent = "Catalog is still loading. Please search in a moment…";
        countEl.style.color = "#c85b43";
      }
      return;
    }

    // Filter and score products
    const scoredProducts = ALL_PRODUCTS
      .map(p => ({ p, score: scoreProduct(p, term) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

    // Filter and score articles
    const scoredArticles = ALL_ARTICLES
      .map(a => ({ a, score: scoreArticle(a, term) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

    // Log query term, scored products and scored articles count
    console.log(`[SearchEngine] runSearch: term="${term}" | Matches: ${scoredProducts.length} products, ${scoredArticles.length} articles.`);

    const totalResults = scoredProducts.length + scoredArticles.length;

    // Reset styles on count element
    if (countEl) {
      countEl.style.color = "#555";
    }

    // Display total result count
    if (countEl) {
      countEl.textContent = totalResults > 0
        ? `${totalResults} result${totalResults !== 1 ? "s" : ""} found for "${term}"`
        : `0 results found for "${term}"`;
    }

    // Handle empty state
    if (totalResults === 0) {
      resultsGrid.innerHTML = "";
      if (blogGrid) blogGrid.innerHTML = "";
      if (productTitleEl) productTitleEl.style.display = "none";
      if (blogTitleEl) blogTitleEl.style.display = "none";
      if (emptyEl) {
        emptyEl.style.display = "block";
        if (emptyTermEl) emptyTermEl.textContent = term;
      }
      return;
    }

    if (emptyEl) emptyEl.style.display = "none";

    // Populate products
    if (scoredProducts.length > 0) {
      if (productTitleEl) productTitleEl.style.display = "block";
      resultsGrid.innerHTML = scoredProducts.map(x => productCardHTML(x.p)).join("");
    } else {
      if (productTitleEl) productTitleEl.style.display = "none";
      resultsGrid.innerHTML = "";
    }

    // Populate blogs
    if (blogGrid) {
      if (scoredArticles.length > 0) {
        if (blogTitleEl) blogTitleEl.style.display = "block";
        blogGrid.innerHTML = scoredArticles.map(x => blogCardHTML(x.a)).join("");
      } else {
        if (blogTitleEl) blogTitleEl.style.display = "none";
        blogGrid.innerHTML = "";
      }
    }
  }

  // Initialization function
  async function init() {
    headingEl = document.getElementById("custom-search-heading");
    searchInput = document.getElementById("custom-search-input");
    countEl = document.getElementById("custom-search-count");
    loadingEl = document.getElementById("custom-search-loading");
    emptyEl = document.getElementById("custom-search-empty");
    emptyTermEl = document.getElementById("empty-term");
    productTitleEl = document.getElementById("search-products-title");
    resultsGrid = document.getElementById("custom-search-results");
    blogTitleEl = document.getElementById("search-blogs-title");
    blogGrid = document.getElementById("custom-blog-results");

    if (!searchInput || !resultsGrid) {
      console.warn("[SearchEngine] Search input or results container missing from DOM.");
      return;
    }

    if (loadingEl) loadingEl.style.display = "flex";

    try {
      const [products, articles] = await Promise.all([
        fetchAllProducts(),
        fetchAllArticles()
      ]);

      ALL_PRODUCTS = products;
      ALL_ARTICLES = articles;
      isCatalogLoaded = true;

      // Log total loaded items count
      console.log(`[SearchEngine] Initialization completed: ${ALL_PRODUCTS.length} products, ${ALL_ARTICLES.length} articles loaded.`);

      // Re-run initial search once catalog has completed loading
      const currentQuery = searchInput.value.trim();
      if (currentQuery) {
        runSearch(currentQuery);
      }
    } catch (err) {
      // Display fetch error in count element and console log it
      console.error("[SearchEngine] Error loading search catalogs:", err);
      if (countEl) {
        countEl.textContent = "Error: Failed to load search catalog. Please check your connection and refresh the page.";
        countEl.style.color = "#d32f2f";
      }
    }

    if (loadingEl) loadingEl.style.display = "none";

    // Read ?q= query parameter on page load
    const queryParams = new URLSearchParams(window.location.search);
    const initialQuery = queryParams.get("q") || "";
    if (initialQuery) {
      searchInput.value = initialQuery;
      runSearch(initialQuery);
    }

    // Add inputs event listener with 300ms debounce
    searchInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const term = searchInput.value;
        const url = new URL(window.location.href);
        if (term) {
          url.searchParams.set("q", term);
        } else {
          url.searchParams.delete("q");
        }
        window.history.replaceState({}, "", url.toString());
        runSearch(term);
      }, 300);
    });

    // Form submit handler to run immediately
    const searchForm = searchInput.closest("form");
    if (searchForm) {
      searchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        clearTimeout(debounceTimer);
        const term = searchInput.value;
        const url = new URL(window.location.href);
        if (term) {
          url.searchParams.set("q", term);
        } else {
          url.searchParams.delete("q");
        }
        window.history.replaceState({}, "", url.toString());
        runSearch(term);
      });
    }
  }

  // Timing Bug Fix: Ensure DOM is completely ready before executing
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
