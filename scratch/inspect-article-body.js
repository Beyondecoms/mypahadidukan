const fs = require('fs');
const html = fs.readFileSync('C:/Users/abala/.gemini/antigravity/brain/9a5ad720-e9f0-4a99-b96f-2685b9aeb643/scratch/live-article.html', 'utf8');

const bodyStart = html.indexOf('class="article-content-body');
if (bodyStart !== -1) {
  console.log('bodyStart found at', bodyStart);
  console.log('Content slice:');
  console.log(html.substring(bodyStart, bodyStart + 1500));
} else {
  console.log('Not found');
}

