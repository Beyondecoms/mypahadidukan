(function () {
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function resizeShopifyImage(imageSrc) {
    if (!imageSrc) {
      return "";
    }

    try {
      var url = new URL(imageSrc, window.location.origin);
      url.pathname = url.pathname.replace(/(\.[^.\/]+)$/, "_480x$1");
      return url.toString();
    } catch (error) {
      return imageSrc;
    }
  }

  function formatMoney(value) {
    var amount = Number.parseFloat(value || 0);

    if (!Number.isFinite(amount)) {
      amount = 0;
    }

    var formatter = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    });

    return "₹" + formatter.format(amount);
  }

  function stripHtml(value) {
    var temp = document.createElement("div");
    temp.innerHTML = value || "";
    return (temp.textContent || temp.innerText || "").replace(/\s+/g, " ").trim();
  }

  function truncateText(value, length) {
    if (value.length <= length) {
      return value;
    }

    return value.slice(0, length).trim() + "…";
  }

  function formatArticleDate(value) {
    var date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function dedupeProducts(products) {
    var seen = Object.create(null);

    return products.filter(function (product) {
      var key = String(product && (product.id || product.handle || product.title || ""));

      if (!key || seen[key]) {
        return false;
      }

      seen[key] = true;
      return true;
    });
  }

  function getProductPriceData(product) {
    var firstVariant = product && Array.isArray(product.variants) && product.variants.length
      ? product.variants[0]
      : null;
    var price = Number.parseFloat(firstVariant && firstVariant.price ? firstVariant.price : 0);
    var compareAt = Number.parseFloat(firstVariant && firstVariant.compare_at_price ? firstVariant.compare_at_price : 0);

    if (!Number.isFinite(price)) {
      price = 0;
    }

    if (!Number.isFinite(compareAt)) {
      compareAt = 0;
    }

    return {
      price: price,
      compareAt: compareAt,
      hasDiscount: compareAt > price,
    };
  }

  function buildProductCard(product) {
    var priceData = getProductPriceData(product);
    var discountPct = priceData.hasDiscount
      ? Math.round(((priceData.compareAt - priceData.price) / priceData.compareAt) * 100)
      : 0;
    var imageSrc = product && Array.isArray(product.images) && product.images.length
      ? resizeShopifyImage(product.images[0].src)
      : "";
    var title = escapeHtml(product && product.title ? product.title : "");
    var productUrl = "/products/" + encodeURIComponent(product.handle || "");
    var imageMarkup = imageSrc
      ? '<a href="' + productUrl + '"><img src="' + imageSrc + '" alt="' + title + '" loading="lazy" class="mpd-product-card__img" /></a>'
      : '<a href="' + productUrl + '"><div class="mpd-product-card__placeholder"></div></a>';

    var card = ''
      + '<div class="mpd-product-card">'
      + '  <div class="mpd-product-card__img-wrap">'
      +      (priceData.hasDiscount
              ? '<span class="mpd-badge mpd-badge--discount">-' + escapeHtml(discountPct) + '%</span>'
              : '')
      +      imageMarkup
      + '  </div>'
      + '  <div class="mpd-product-card__body">'
      + '    <h3 class="mpd-product-card__title">'
      + '      <a href="' + productUrl + '">' + title + '</a>'
      + '    </h3>'
      + '    <div class="mpd-product-card__price">'
      + '      <span class="mpd-price--sale">' + escapeHtml(formatMoney(priceData.price)) + '</span>'
      +        (priceData.hasDiscount
                ? '<span class="mpd-price--compare">' + escapeHtml(formatMoney(priceData.compareAt)) + '</span>'
                : '')
      + '    </div>'
      + '    <a href="' + productUrl + '" class="mpd-btn-cart">View Product</a>'
      + '  </div>'
      + '</div>';

    return '<div class="mpd-col">' + card + '</div>';
  }

  function buildBlogCard(article) {
    var articleUrl = "/blogs/" + encodeURIComponent(article.blog_handle || "") + "/" + encodeURIComponent(article.handle || "");
    var imageSrc = article.image && article.image.src ? resizeShopifyImage(article.image.src) : "";
    var title = escapeHtml(article.title || "");
    var date = escapeHtml(formatArticleDate(article.published_at));
    var sourceText = escapeHtml(article.blog_title || "");
    var excerptSource = stripHtml(article.summary_html || article.body_html || "");
    var excerpt = escapeHtml(truncateText(excerptSource, 100));
    var imageMarkup = imageSrc
      ? '<div class="mpd-blog-card__img-wrap"><img src="' + imageSrc + '" alt="' + title + '" loading="lazy" class="mpd-blog-card__img" /></div>'
      : '';

    var card = ''
      + '<a href="' + articleUrl + '" class="mpd-blog-card-link">'
      + '  <div class="mpd-blog-card">'
      +        imageMarkup
      + '    <div class="mpd-blog-card__body">'
      + '      <span class="mpd-blog-card__meta">' + sourceText + (date ? ' · ' + date : '') + '</span>'
      + '      <h3 class="mpd-blog-card__title">' + title + '</h3>'
      + '      <p class="mpd-blog-card__excerpt">' + excerpt + '</p>'
      + '      <span class="mpd-blog-card__cta">Read More →</span>'
      + '    </div>'
      + '  </div>'
      + '</a>';

    return '<div class="mpd-col">' + card + '</div>';
  }

  document.addEventListener("DOMContentLoaded", function () {
    var searchInput = document.getElementById("mpd-search-input");
    var heading = document.getElementById("mpd-heading");
    var resultsWrap = document.getElementById("mpd-results-wrap");
    var loading = document.getElementById("mpd-loading");
    var error = document.getElementById("mpd-error");
    var empty = document.getElementById("mpd-empty");
    var emptyTerm = document.getElementById("mpd-empty-term");
    var productsSection = document.getElementById("mpd-products-section");
    var blogsSection = document.getElementById("mpd-blogs-section");
    var productGrid = document.getElementById("mpd-product-grid");
    var blogGrid = document.getElementById("mpd-blog-grid");

    var allProducts = [];
    var allArticles = [];
    var debounceTimer = null;

    if (!searchInput || !heading || !resultsWrap || !loading || !error || !empty || !emptyTerm || !productsSection || !blogsSection || !productGrid || !blogGrid) {
      return;
    }

    // #region debug-point A:init
    fetch("http://127.0.0.1:7777/event", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "mpd-search-no-results",
        runId: "pre-fix",
        hypothesisId: "A",
        location: "assets/mpd-search.js:DOMContentLoaded",
        msg: "[DEBUG] search page initialized",
        data: {
          path: window.location.pathname,
          search: window.location.search,
          inputValue: searchInput.value,
          hasResultsWrap: Boolean(resultsWrap),
          hasProductGrid: Boolean(productGrid),
          hasBlogGrid: Boolean(blogGrid)
        },
        ts: Date.now()
      })
    }).catch(function () {});
    // #endregion

    function showLoading() {
      loading.style.display = "flex";
      error.style.display = "none";
      empty.style.display = "none";
      productsSection.style.display = "none";
      blogsSection.style.display = "none";
    }

    function hideLoading() {
      loading.style.display = "none";
    }

    function showFetchError(message) {
      hideLoading();
      error.textContent = message;
      error.style.display = "block";
      productsSection.style.display = "none";
      blogsSection.style.display = "none";
      empty.style.display = "none";
      productGrid.innerHTML = "";
      blogGrid.innerHTML = "";
    }

    function updateUrl(term) {
      var url = new URL(window.location.href);

      if (term) {
        url.searchParams.set("q", term);
      } else {
        url.searchParams.delete("q");
      }

      window.history.replaceState({}, "", url.toString());
    }

    async function fetchAllProducts() {
      var collected = [];
      var page = 1;
      var keepFetching = true;

      while (keepFetching) {
        var response = await fetch("/products.json?limit=250&page=" + page, {
          credentials: "same-origin",
        });

        if (!response.ok) {
          throw new Error("Products request failed with status " + response.status);
        }

        var data = await response.json();
        var products = Array.isArray(data.products) ? data.products : [];
        // #region debug-point B:products-page
        fetch("http://127.0.0.1:7777/event", {
          method: "POST",
          body: JSON.stringify({
            sessionId: "mpd-search-no-results",
            runId: "pre-fix",
            hypothesisId: "B",
            location: "assets/mpd-search.js:fetchAllProducts",
            msg: "[DEBUG] fetched products page",
            data: {
              page: page,
              count: products.length,
              sampleTitles: products.slice(0, 5).map(function (product) {
                return product && product.title ? product.title : "";
              })
            },
            ts: Date.now()
          })
        }).catch(function () {});
        // #endregion
        collected = collected.concat(products);

        if (products.length < 250) {
          keepFetching = false;
        } else {
          page += 1;
        }
      }

      return dedupeProducts(collected);
    }

    async function fetchAllArticles() {
      var blogsResponse = await fetch("/blogs.json", {
        credentials: "same-origin",
      });

      if (blogsResponse.status === 404) {
        // #region debug-point H:blogs-404-fallback
        fetch("http://127.0.0.1:7777/event", {
          method: "POST",
          body: JSON.stringify({
            sessionId: "mpd-search-no-results",
            runId: "post-fix",
            hypothesisId: "H",
            location: "assets/mpd-search.js:fetchAllArticles",
            msg: "[DEBUG] blogs endpoint unavailable, falling back to empty article list",
            data: {
              status: blogsResponse.status
            },
            ts: Date.now()
          })
        }).catch(function () {});
        // #endregion
        return [];
      }

      if (!blogsResponse.ok) {
        throw new Error("Blogs request failed with status " + blogsResponse.status);
      }

      var blogsData = await blogsResponse.json();
      var blogs = Array.isArray(blogsData.blogs) ? blogsData.blogs : [];
      var articlePromises = blogs.map(async function (blog) {
        var page = 1;
        var keepFetching = true;
        var blogArticles = [];

        while (keepFetching) {
          var articlesResponse = await fetch("/blogs/" + encodeURIComponent(blog.handle) + "/articles.json?limit=250&page=" + page, {
            credentials: "same-origin",
          });

          if (!articlesResponse.ok) {
            throw new Error("Articles request failed for blog " + blog.handle + " with status " + articlesResponse.status);
          }

          var articlesData = await articlesResponse.json();
          var articles = Array.isArray(articlesData.articles) ? articlesData.articles : [];

          articles.forEach(function (article) {
            article.blog_handle = blog.handle;
            article.blog_title = blog.title;
          });

          blogArticles = blogArticles.concat(articles);

          if (articles.length < 250) {
            keepFetching = false;
          } else {
            page += 1;
          }
        }

        return blogArticles;
      });

      var articleGroups = await Promise.all(articlePromises);
      var flattenedArticles = articleGroups.flat();
      // #region debug-point C:articles-loaded
      fetch("http://127.0.0.1:7777/event", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "mpd-search-no-results",
          runId: "pre-fix",
          hypothesisId: "C",
          location: "assets/mpd-search.js:fetchAllArticles",
          msg: "[DEBUG] fetched all articles",
          data: {
            count: flattenedArticles.length,
            sampleTitles: flattenedArticles.slice(0, 5).map(function (article) {
              return article && article.title ? article.title : "";
            })
          },
          ts: Date.now()
        })
      }).catch(function () {});
      // #endregion
      return flattenedArticles;
    }

    function runSearch(term) {
      var normalizedTerm = String(term || "").trim().toLowerCase();
      console.log("[MPD Search] Searching for: " + normalizedTerm);
      // #region debug-point D:run-search
      fetch("http://127.0.0.1:7777/event", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "mpd-search-no-results",
          runId: "pre-fix",
          hypothesisId: "D",
          location: "assets/mpd-search.js:runSearch",
          msg: "[DEBUG] runSearch invoked",
          data: {
            term: term,
            normalizedTerm: normalizedTerm,
            productsLoaded: allProducts.length,
            articlesLoaded: allArticles.length
          },
          ts: Date.now()
        })
      }).catch(function () {});
      // #endregion

      if (!normalizedTerm || normalizedTerm.length < 2) {
        productGrid.innerHTML = "";
        blogGrid.innerHTML = "";
        productsSection.style.display = "none";
        blogsSection.style.display = "none";
        empty.style.display = "none";
        error.style.display = "none";
        heading.textContent = "Search";
        return;
      }

      var matchedProducts = allProducts
        .filter(function (product) {
          return Boolean(product)
            && product.available === true
            && String(product.title || "").toLowerCase().includes(normalizedTerm);
        })
        .sort(function (left, right) {
          var leftTitle = String(left.title || "").toLowerCase();
          var rightTitle = String(right.title || "").toLowerCase();
          var leftStarts = leftTitle.indexOf(normalizedTerm) === 0 ? 0 : 1;
          var rightStarts = rightTitle.indexOf(normalizedTerm) === 0 ? 0 : 1;

          if (leftStarts !== rightStarts) {
            return leftStarts - rightStarts;
          }

          return leftTitle.localeCompare(rightTitle);
        });

      var matchedArticles = allArticles
        .filter(function (article) {
          return Boolean(article)
            && String(article.title || "").toLowerCase().includes(normalizedTerm);
        })
        .sort(function (left, right) {
          return String(left.title || "").localeCompare(String(right.title || ""));
        });

      console.log("[MPD Search] Products matched: " + matchedProducts.length + " | Articles matched: " + matchedArticles.length);
      // #region debug-point E:match-results
      fetch("http://127.0.0.1:7777/event", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "mpd-search-no-results",
          runId: "pre-fix",
          hypothesisId: "E",
          location: "assets/mpd-search.js:runSearch:results",
          msg: "[DEBUG] search results computed",
          data: {
            normalizedTerm: normalizedTerm,
            matchedProducts: matchedProducts.length,
            matchedArticles: matchedArticles.length,
            productTitles: matchedProducts.slice(0, 10).map(function (product) {
              return product && product.title ? product.title : "";
            }),
            articleTitles: matchedArticles.slice(0, 10).map(function (article) {
              return article && article.title ? article.title : "";
            })
          },
          ts: Date.now()
        })
      }).catch(function () {});
      // #endregion

      if (matchedProducts.length > 0) {
        heading.textContent = 'Products matching "' + normalizedTerm + '"';
      } else if (matchedArticles.length > 0) {
        heading.textContent = 'Articles matching "' + normalizedTerm + '"';
      } else {
        heading.textContent = 'No results for "' + normalizedTerm + '"';
      }

      if (matchedProducts.length === 0 && matchedArticles.length === 0) {
        emptyTerm.textContent = normalizedTerm;
        empty.style.display = "block";
        productsSection.style.display = "none";
        blogsSection.style.display = "none";
        productGrid.innerHTML = "";
        blogGrid.innerHTML = "";
        return;
      }

      empty.style.display = "none";

      if (matchedProducts.length > 0) {
        productsSection.style.display = "block";
        productGrid.innerHTML = matchedProducts.map(buildProductCard).join("");
      } else {
        productsSection.style.display = "none";
        productGrid.innerHTML = "";
      }

      if (matchedArticles.length > 0) {
        blogsSection.style.display = "block";
        blogGrid.innerHTML = matchedArticles.map(buildBlogCard).join("");
      } else {
        blogsSection.style.display = "none";
        blogGrid.innerHTML = "";
      }
    }

    function handleLiveSearch() {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(function () {
        var term = searchInput.value;
        updateUrl(term);
        runSearch(term);
      }, 300);
    }

    searchInput.addEventListener("input", handleLiveSearch);

    if (searchInput.form) {
      searchInput.form.addEventListener("submit", function (event) {
        event.preventDefault();
        var term = searchInput.value;
        updateUrl(term);
        runSearch(term);
      });
    }

    showLoading();

    Promise.allSettled([fetchAllProducts(), fetchAllArticles()])
      .then(function (results) {
        var productsResult = results[0];
        var articlesResult = results[1];

        if (productsResult.status !== "fulfilled") {
          throw productsResult.reason;
        }

        allProducts = productsResult.value;
        allArticles = articlesResult.status === "fulfilled" ? articlesResult.value : [];

        // #region debug-point F:catalog-loaded
        fetch("http://127.0.0.1:7777/event", {
          method: "POST",
          body: JSON.stringify({
            sessionId: "mpd-search-no-results",
            runId: "post-fix",
            hypothesisId: "F",
            location: "assets/mpd-search.js:Promise.allSettled",
            msg: "[DEBUG] catalog finished loading",
            data: {
              productsLoaded: allProducts.length,
              articlesLoaded: allArticles.length,
              articlesStatus: articlesResult.status,
              articlesError: articlesResult.status === "rejected"
                ? (articlesResult.reason && articlesResult.reason.message ? articlesResult.reason.message : String(articlesResult.reason))
                : "",
              honeyProducts: allProducts
                .filter(function (product) {
                  return String(product && product.title ? product.title : "").toLowerCase().includes("honey");
                })
                .slice(0, 10)
                .map(function (product) {
                  return {
                    title: product.title,
                    available: product.available,
                    handle: product.handle
                  };
                }),
              honeyArticles: allArticles
                .filter(function (article) {
                  return String(article && article.title ? article.title : "").toLowerCase().includes("honey");
                })
                .slice(0, 10)
                .map(function (article) {
                  return {
                    title: article.title,
                    handle: article.handle,
                    blog_handle: article.blog_handle
                  };
                })
            },
            ts: Date.now()
          })
        }).catch(function () {});
        // #endregion

        console.log("[MPD Search] Products loaded: " + allProducts.length);
        console.log("[MPD Search] Articles loaded: " + allArticles.length);

        hideLoading();

        var initialTerm = new URLSearchParams(window.location.search).get("q") || "";

        if (initialTerm && initialTerm.trim().length >= 2) {
          searchInput.value = initialTerm;
          runSearch(initialTerm);
        } else {
          heading.textContent = "Search";
        }
      })
      .catch(function (fetchError) {
        // #region debug-point G:fetch-error
        fetch("http://127.0.0.1:7777/event", {
          method: "POST",
          body: JSON.stringify({
            sessionId: "mpd-search-no-results",
            runId: "pre-fix",
            hypothesisId: "G",
            location: "assets/mpd-search.js:catch",
            msg: "[DEBUG] fetch pipeline failed",
            data: {
              error: fetchError && fetchError.message ? fetchError.message : String(fetchError)
            },
            ts: Date.now()
          })
        }).catch(function () {});
        // #endregion
        console.log("[MPD Search] Fetch error: " + (fetchError && fetchError.message ? fetchError.message : fetchError));
        showFetchError("Could not load results. Please check your connection and refresh.");
      });
  });
})();
