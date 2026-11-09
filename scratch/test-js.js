const fs = require('fs');
const html = fs.readFileSync('C:/Users/abala/.gemini/antigravity/brain/9a5ad720-e9f0-4a99-b96f-2685b9aeb643/scratch/live-article.html', 'utf8');

// Extract article-content-body inner HTML
const startMarker = 'class="article-content-body rte" itemprop="articleBody">';
const startIdx = html.indexOf(startMarker) + startMarker.length;
const endMarker = '</div>\n\n        <!-- ── FAQ SECTION';
let endIdx = html.indexOf('<!-- ── FAQ SECTION', startIdx);
while (html[endIdx] !== '<' || html.substring(endIdx - 6, endIdx).indexOf('</div>') === -1) {
  endIdx--;
}
const bodyHtml = html.substring(startIdx, endIdx);

// Let's create a minimal test html page with just contentEl and the script and open it in Chrome with jsdom or a simple browser test
console.log('Body length:', bodyHtml.length);

// Count tags at top level
const jsdom = require('jsdom'); // Check if available

