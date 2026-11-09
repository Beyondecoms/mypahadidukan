const fs = require('fs');
let liveHtml = fs.readFileSync('C:/Users/abala/.gemini/antigravity/brain/9a5ad720-e9f0-4a99-b96f-2685b9aeb643/scratch/live-article.html', 'utf8');

// Replace the old injection snippet with the new one
const oldSnippet = `      // ── Inject Blog Products Slider at ~20% of Article Content ──
      var bpSliderTpl = document.getElementById('bp-slider-tpl');
      if (bpSliderTpl && !contentEl.querySelector('.article-products-section--slider')) {
        var blocks = Array.from(contentEl.children).filter(function(node) {
          return node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE' && node.tagName !== 'TEMPLATE';
        });

        if (blocks.length > 0) {
          var totalContentHeight = contentEl.scrollHeight || contentEl.offsetHeight;
          var targetHeight = totalContentHeight * 0.20;
          var contentTop = contentEl.getBoundingClientRect().top + window.pageYOffset;
          var bestBlock = blocks[0];
          var minDiff = Infinity;

          for (var b = 0; b < blocks.length; b++) {
            var block = blocks[b];
            var blockBottom = (block.getBoundingClientRect().bottom + window.pageYOffset) - contentTop;
            var diff = Math.abs(blockBottom - targetHeight);

            if (diff < minDiff) {
              minDiff = diff;
              bestBlock = block;
            }

            if (blockBottom >= targetHeight && (block.tagName === 'P' || block.tagName === 'UL' || block.tagName === 'OL' || block.tagName === 'DIV' || block.tagName === 'BLOCKQUOTE')) {
              bestBlock = block;
              break;
            }
          }

          if (bestBlock) {
            var frag = bpSliderTpl.content ? bpSliderTpl.content.cloneNode(true) : null;
            var sliderNode = frag ? frag.firstElementChild : (bpSliderTpl.firstElementChild ? bpSliderTpl.firstElementChild.cloneNode(true) : null);
            if (sliderNode) {
              bestBlock.insertAdjacentElement('afterend', sliderNode);
              initBpSlider(sliderNode);
            }
          }
        }
      }`;

const newSnippet = `      // ── Inject Blog Products Slider at ~20% of Article Content ──
      var bpSliderTpl = document.getElementById('bp-slider-tpl');
      if (bpSliderTpl && !contentEl.querySelector('.article-products-section--slider')) {
        function getTopBlocks(parent) {
          var children = Array.from(parent.children).filter(function(node) {
            return node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE' && node.tagName !== 'TEMPLATE';
          });
          if (children.length === 1 && children[0].children && children[0].children.length > 2) {
            return getTopBlocks(children[0]);
          }
          return children;
        }

        var blocks = getTopBlocks(contentEl);

        if (blocks.length > 0) {
          var totalTextLength = 0;
          for (var i = 0; i < blocks.length; i++) {
            totalTextLength += (blocks[i].textContent || '').trim().length;
          }

          var targetTextLength = totalTextLength * 0.20;
          var accumulatedLength = 0;
          var bestBlock = null;

          for (var b = 0; b < blocks.length; b++) {
            var block = blocks[b];
            accumulatedLength += (block.textContent || '').trim().length;

            var isHeading = /^H[1-6]$/.test(block.tagName);
            var isSuitable = (block.tagName === 'P' || block.tagName === 'UL' || block.tagName === 'OL' || block.tagName === 'DIV' || block.tagName === 'BLOCKQUOTE') && !isHeading;

            if (accumulatedLength >= targetTextLength && isSuitable) {
              bestBlock = block;
              break;
            }
          }

          if (!bestBlock) {
            var fallbackIdx = Math.max(0, Math.min(blocks.length - 1, Math.floor(blocks.length * 0.20)));
            while (fallbackIdx < blocks.length - 1 && /^H[1-6]$/.test(blocks[fallbackIdx].tagName)) {
              fallbackIdx++;
            }
            bestBlock = blocks[fallbackIdx];
          }

          if (bestBlock) {
            var frag = bpSliderTpl.content ? bpSliderTpl.content.cloneNode(true) : null;
            var sliderNode = frag ? frag.firstElementChild : (bpSliderTpl.firstElementChild ? bpSliderTpl.firstElementChild.cloneNode(true) : null);
            if (sliderNode) {
              bestBlock.insertAdjacentElement('afterend', sliderNode);
              initBpSlider(sliderNode);
            }
          }
        }
      }`;

// In case whitespace differs, let's find the section
const idx = liveHtml.indexOf('// ── Inject Blog Products Slider at ~20% of Article Content ──');
if (idx !== -1) {
  const endIdx = liveHtml.indexOf('// FAQ sits right after the body', idx);
  liveHtml = liveHtml.substring(0, idx) + newSnippet + '\n\n    ' + liveHtml.substring(endIdx);
  fs.writeFileSync('C:/Users/abala/.gemini/antigravity/brain/9a5ad720-e9f0-4a99-b96f-2685b9aeb643/scratch/test-article-verified.html', liveHtml);
  console.log('Saved test-article-verified.html');
} else {
  console.log('Could not find injection point in live-article.html');
}

