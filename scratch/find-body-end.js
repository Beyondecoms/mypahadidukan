const fs = require('fs');
const html = fs.readFileSync('C:/Users/abala/.gemini/antigravity/brain/9a5ad720-e9f0-4a99-b96f-2685b9aeb643/scratch/live-article.html', 'utf8');

const bodyStart = html.indexOf('class="article-content-body');
const bodyEnd = html.indexOf('</div>', bodyStart + 100);
// Find matching closing div
let depth = 1;
let pos = bodyStart;
// Find first >
pos = html.indexOf('>', pos) + 1;
let cur = pos;
while (depth > 0 && cur < html.length) {
  const nextOpen = html.indexOf('<div', cur);
  const nextClose = html.indexOf('</div>', cur);
  if (nextClose === -1) break;
  if (nextOpen !== -1 && nextOpen < nextClose) {
    depth++;
    cur = nextOpen + 4;
  } else {
    depth--;
    if (depth === 0) {
      console.log('body ends at', nextClose);
      console.log('Snippet before end:');
      console.log(html.substring(nextClose - 500, nextClose + 100));
    }
    cur = nextClose + 6;
  }
}

