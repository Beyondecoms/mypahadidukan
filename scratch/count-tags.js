const fs = require('fs');
const testHtml = fs.readFileSync('c:/Users/abala/OneDrive/Desktop/mypahadidukan/mypahadidukan/scratch/test-real-body.html', 'utf8');

// Let's count top level tags in article-content-body
const start = testHtml.indexOf('<div class="article-content-body');
const end = testHtml.indexOf('</div>\n\n  <template');
const body = testHtml.substring(start, end);

// Simple regex to match top-level tags
const tagMatches = body.match(/<[a-z0-9]+[^>]*>/gi);
console.log('Total tags inside body:', tagMatches ? tagMatches.length : 0);

