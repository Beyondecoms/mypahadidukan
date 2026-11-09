const fs = require('fs');
const liveHtml = fs.readFileSync('C:/Users/abala/.gemini/antigravity/brain/9a5ad720-e9f0-4a99-b96f-2685b9aeb643/scratch/live-article.html', 'utf8');

const startMarker = 'class="article-content-body rte" itemprop="articleBody">';
const startIdx = liveHtml.indexOf(startMarker) + startMarker.length;
const endIdx = liveHtml.indexOf('<!-- ── FAQ SECTION', startIdx);
let lastDiv = liveHtml.lastIndexOf('</div>', endIdx);
const realBody = liveHtml.substring(startIdx, lastDiv);

const testTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Real Body Test</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 20px; }
    .article-content-body { max-width: 800px; margin: 0 auto; }
    .article-products-section--slider { background: #e6f4f0; padding: 20px; border: 2px solid #008b75; margin: 30px 0; border-radius: 16px; }
  </style>
</head>
<body>
  <div id="debug-box" style="padding: 15px; background: #fff8e8; margin-bottom: 20px; font-weight: bold; font-size: 18px;"></div>
  <div class="article-content-body rte" itemprop="articleBody">
    ${realBody}
  </div>

  <template id="bp-slider-tpl">
    <section class="article-products-section article-products-section--slider">
      <h3>From My Pahadi Dukan (INJECTED)</h3>
    </section>
  </template>

  <script>
    window.addEventListener('DOMContentLoaded', function() {
      var contentEl = document.querySelector('.article-content-body');
      var bpSliderTpl = document.getElementById('bp-slider-tpl');
      var debugBox = document.getElementById('debug-box');

      if (bpSliderTpl && !contentEl.querySelector('.article-products-section--slider')) {
        var blocks = Array.from(contentEl.children).filter(function(node) {
          return node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE' && node.tagName !== 'TEMPLATE';
        });

        var totalContentHeight = contentEl.scrollHeight || contentEl.offsetHeight;
        var targetHeight = totalContentHeight * 0.20;
        var contentTop = contentEl.getBoundingClientRect().top + window.pageYOffset;
        var bestBlock = blocks[0];
        var minDiff = Infinity;
        var matchedIndex = -1;

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
            matchedIndex = b;
            break;
          }
        }

        if (bestBlock) {
          var frag = bpSliderTpl.content ? bpSliderTpl.content.cloneNode(true) : null;
          var sliderNode = frag ? frag.firstElementChild : (bpSliderTpl.firstElementChild ? bpSliderTpl.firstElementChild.cloneNode(true) : null);
          if (sliderNode) {
            bestBlock.insertAdjacentElement('afterend', sliderNode);
          }
        }

        debugBox.innerHTML = 'Total Blocks: ' + blocks.length +
          '<br>Matched Index: ' + matchedIndex + ' of ' + blocks.length +
          '<br>Total Height: ' + totalContentHeight + 'px, Target 20%: ' + targetHeight + 'px' +
          '<br>Inserted after: <' + (bestBlock ? bestBlock.tagName : 'NONE') + '> ' + (bestBlock ? bestBlock.textContent.substring(0, 80) : '');
      }
    });
  </script>
</body>
</html>`;

fs.writeFileSync('c:/Users/abala/OneDrive/Desktop/mypahadidukan/mypahadidukan/scratch/test-real-body.html', testTemplate);
console.log('Written test-real-body.html');

