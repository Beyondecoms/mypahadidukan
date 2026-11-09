const { exec } = require('child_process');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const input = 'file:///C:/Users/abala/.gemini/antigravity/brain/9a5ad720-e9f0-4a99-b96f-2685b9aeb643/scratch/live-article.html';
const output = 'C:\\Users\\abala\\.gemini\\antigravity\\brain\\9a5ad720-e9f0-4a99-b96f-2685b9aeb643\\scratch\\dumped.html';

const cmd = `"${chrome}" --headless=new --disable-gpu --virtual-time-budget=5000 --dump-dom "${input}"`;

exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  const fs = require('fs');
  fs.writeFileSync(output, stdout, 'utf8');
  console.log('Dumped', stdout.length, 'bytes');

  // Let's analyze where article-products-section--slider appears in stdout
  const idx = stdout.indexOf('article-products-section--slider');
  console.log('Slider found at index:', idx);
  if (idx !== -1) {
    console.log('Surrounding HTML:');
    console.log(stdout.substring(idx - 300, idx + 400));
  }
});

