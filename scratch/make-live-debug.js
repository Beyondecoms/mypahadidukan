const fs = require('fs');
const html = fs.readFileSync('C:/Users/abala/.gemini/antigravity/brain/9a5ad720-e9f0-4a99-b96f-2685b9aeb643/scratch/live-article.html', 'utf8');

// Let's create an html file that loads live-article.html with an alert or console logger showing exactly where slider was placed
let modHtml = html.replace('// ── Inject Blog Products Slider at ~20% of Article Content ──', `
      // ── LOG INJECTION DETAILS ──
      var contentEl = document.querySelector('.article-content-body');
      var bpSliderTpl = document.getElementById('bp-slider-tpl');
      var blocks = contentEl ? Array.from(contentEl.children).filter(function(node) {
        return node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE' && node.tagName !== 'TEMPLATE';
      }) : [];
      console.log('--- INJECTION DEBUG ---');
      console.log('contentEl found:', !!contentEl);
      console.log('blocks count:', blocks.length);
      console.log('first block tag:', blocks[0] ? blocks[0].tagName : 'none');
      console.log('last block tag:', blocks[blocks.length-1] ? blocks[blocks.length-1].tagName : 'none');
`);

modHtml = modHtml.replace("bestBlock.insertAdjacentElement('afterend', sliderNode);", `
  bestBlock.insertAdjacentElement('afterend', sliderNode);
  console.log('INJECTED AFTER BLOCK INDEX:', b, 'OF', blocks.length, 'TAG:', bestBlock.tagName);
  console.log('BLOCK TEXT:', bestBlock.textContent.substring(0, 100));
`);

fs.writeFileSync('C:/Users/abala/.gemini/antigravity/brain/9a5ad720-e9f0-4a99-b96f-2685b9aeb643/scratch/live-debug.html', modHtml);
console.log('Created live-debug.html');

