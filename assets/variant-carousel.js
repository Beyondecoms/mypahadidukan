if (!customElements.get('variant-carousel')) {
  class VariantCarousel extends HTMLElement {
    constructor() {
      super();
      this.isDown = false;
      this.hasMoved = false;
      this.startX = 0;
      this.scrollLeftStart = 0;
      this.onScroll = this.updateNav.bind(this);
      this.onResize = this.updateNav.bind(this);
    }

    connectedCallback() {
      this.track = this.querySelector('.m-product-option--content');
      this.prevBtn = this.querySelector('.m-variant-carousel__btn--prev');
      this.nextBtn = this.querySelector('.m-variant-carousel__btn--next');

      if (!this.track) return;

      if (this.prevBtn) {
        this.prevBtn.addEventListener('click', this.handlePrev.bind(this));
      }

      if (this.nextBtn) {
        this.nextBtn.addEventListener('click', this.handleNext.bind(this));
      }

      this.track.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onResize);

      this.initDragToScroll();
      if (this.querySelector('.has-badge')) {
        this.classList.add('has-group-badges');
        this.track?.classList.add('has-group-badges');
        this.querySelectorAll('.rich-variant-card').forEach((c) => c.classList.add('has-group-badges'));
      }
      this.normalizeVariantImageSizes();

      // Delay initial update slightly to ensure DOM & fonts/images layout is computed
      requestAnimationFrame(() => {
        this.updateNav();
        this.scrollToSelectedVariant();
      });
    }

    disconnectedCallback() {
      if (this.track) {
        this.track.removeEventListener('scroll', this.onScroll);
      }
      window.removeEventListener('resize', this.onResize);
    }

    getScrollAmount() {
      const card = this.track.querySelector('.m-product-option--node');
      if (card) {
        const style = window.getComputedStyle(this.track);
        const gap = parseFloat(style.columnGap || style.gap) || 12;
        // Scroll by 2 cards width or 1 card width depending on track size
        const cardWidth = card.offsetWidth + gap;
        return this.track.clientWidth > 320 ? cardWidth * 2 : cardWidth;
      }
      return 260;
    }

    handlePrev(e) {
      e?.preventDefault();
      if (!this.track) return;
      this.track.scrollBy({
        left: -this.getScrollAmount(),
        behavior: 'smooth'
      });
    }

    handleNext(e) {
      e?.preventDefault();
      if (!this.track) return;
      this.track.scrollBy({
        left: this.getScrollAmount(),
        behavior: 'smooth'
      });
    }

    updateNav() {
      if (!this.track) return;

      const { scrollLeft, scrollWidth, clientWidth } = this.track;
      const maxScroll = Math.max(0, scrollWidth - clientWidth);

      // If no overflow, disable or hide navigation
      if (maxScroll <= 2) {
        if (this.prevBtn) this.prevBtn.disabled = true;
        if (this.nextBtn) this.nextBtn.disabled = true;
        this.classList.add('no-scroll');
        return;
      }

      this.classList.remove('no-scroll');

      const isStart = scrollLeft <= 3;
      const isEnd = scrollLeft >= maxScroll - 3;

      if (this.prevBtn) {
        this.prevBtn.disabled = isStart;
        this.prevBtn.setAttribute('aria-disabled', isStart ? 'true' : 'false');
      }

      if (this.nextBtn) {
        this.nextBtn.disabled = isEnd;
        this.nextBtn.setAttribute('aria-disabled', isEnd ? 'true' : 'false');
      }
    }

    scrollToSelectedVariant() {
      if (!this.track) return;
      const selectedNode = this.track.querySelector('.m-product-option--node__selected') ||
        this.track.querySelector('input:checked')?.closest('.m-product-option--node');

      if (!selectedNode) return;

      const trackRect = this.track.getBoundingClientRect();
      const nodeRect = selectedNode.getBoundingClientRect();

      // If the selected node is clipped or out of view, center it in the track
      if (nodeRect.left < trackRect.left || nodeRect.right > trackRect.right) {
        const offsetLeft = selectedNode.offsetLeft - this.track.offsetLeft;
        const targetScroll = offsetLeft - (this.track.clientWidth / 2) + (selectedNode.offsetWidth / 2);
        this.track.scrollTo({
          left: Math.max(0, targetScroll),
          behavior: 'smooth'
        });
      }
    }

    initDragToScroll() {
      if (!this.track) return;

      const onMouseDown = (e) => {
        // Only trigger on primary (left) button
        if (e.button !== 0) return;
        this.isDown = true;
        this.hasMoved = false;
        this.track.classList.add('is-dragging');
        this.startX = e.pageX - this.track.offsetLeft;
        this.scrollLeftStart = this.track.scrollLeft;
      };

      const onMouseMove = (e) => {
        if (!this.isDown) return;
        const x = e.pageX - this.track.offsetLeft;
        const walk = x - this.startX;
        if (Math.abs(walk) > 4) {
          this.hasMoved = true;
        }
        this.track.scrollLeft = this.scrollLeftStart - walk;
      };

      const onMouseUpOrLeave = (e) => {
        if (!this.isDown) return;
        this.isDown = false;
        this.track.classList.remove('is-dragging');
      };

      const onClick = (e) => {
        if (this.hasMoved) {
          // Prevent accidental clicks on child inputs/labels when dragging
          e.preventDefault();
          e.stopPropagation();
          this.hasMoved = false;
        }
      };

      this.track.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUpOrLeave);
      this.track.addEventListener('click', onClick, true);
    }

    normalizeVariantImageSizes() {
      VariantCarousel.normalizeAllImages(this);
    }

    static normalizeImage(img) {
      if (!img || img.dataset.sizeNormalized === 'true') return;

      const doNormalize = () => {
        try {
          if (!img.naturalWidth || !img.naturalHeight) return;

          const card = img.closest('.rich-variant-card');
          const cardText = card ? card.innerText || '' : '';
          const isMultiPack = card?.dataset.multiPack === 'true' || /\b([2-9]\s*X|[2-9]\s*Bottles?|Pack of [2-9]|1200ml|600ml|900ml)\b/i.test(cardText);

          if (isMultiPack) {
            if (card) {
              card.dataset.multiPack = 'true';
              card.classList.add('is-multi-pack');
            }
            img.style.transform = 'none';
            img.dataset.sizeNormalized = 'true';
            return;
          }

          // Skip if already explicitly scaled via CSS
          const computed = window.getComputedStyle(img);
          if (computed.transform && computed.transform !== 'none') {
            img.dataset.sizeNormalized = 'true';
            return;
          }

          const size = 48;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return;

          ctx.drawImage(img, 0, 0, size, size);
          const data = ctx.getImageData(0, 0, size, size).data;

          const isBg = (idx) => {
            const a = data[idx + 3];
            if (a < 30) return true;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            return r > 240 && g > 240 && b > 240;
          };

          let minY = size, maxY = -1, minX = size, maxX = -1;
          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const idx = (y * size + x) * 4;
              if (!isBg(idx)) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }

          if (maxY >= minY && maxX >= minX) {
            const contentH = (maxY - minY + 1) / size;
            const contentW = (maxX - minX + 1) / size;

            if (contentW > 0.68) {
              img.style.transform = 'none';
            } else if (contentH < 0.78) {
              let scale = 0.85 / contentH;
              const maxScaleByW = 0.95 / contentW;
              scale = Math.min(scale, maxScaleByW);
              scale = Math.max(1.0, Math.min(1.45, scale));
              if (scale > 1.05) {
                img.style.transform = `scale(${scale.toFixed(2)})`;
                img.style.transformOrigin = 'center center';
              }
            }
          }
          img.dataset.sizeNormalized = 'true';
        } catch (e) {
          img.dataset.sizeNormalized = 'true';
        }
      };

      if (img.complete && img.naturalWidth > 0) {
        doNormalize();
      } else {
        img.addEventListener('load', doNormalize, { once: true });
      }
    }

    static normalizeAllImages(root = document) {
      const images = root.querySelectorAll('.rich-variant-card__image');
      images.forEach((img) => VariantCarousel.normalizeImage(img));
    }
  }

  customElements.define('variant-carousel', VariantCarousel);

  // Helper to ensure badged groups maintain identical baseline on all cards
  function alignCardBaselines(root = document) {
    root.querySelectorAll('.m-product-option--content, .m-variant-carousel').forEach((container) => {
      if (container.querySelector('.has-badge')) {
        container.classList.add('has-group-badges');
        container.querySelectorAll('.rich-variant-card').forEach((card) => {
          card.classList.add('has-group-badges');
        });
      }
    });
  }

  // Normalize images and align card baselines across page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      alignCardBaselines();
      VariantCarousel.normalizeAllImages();
    });
  } else {
    alignCardBaselines();
    VariantCarousel.normalizeAllImages();
  }

  // Handle dynamic section loads & variant changes
  document.addEventListener('shopify:section:load', () => {
    alignCardBaselines();
    VariantCarousel.normalizeAllImages();
  });
  window.addEventListener('variant:change', () => {
    requestAnimationFrame(() => {
      alignCardBaselines();
      VariantCarousel.normalizeAllImages();
    });
  });
}

