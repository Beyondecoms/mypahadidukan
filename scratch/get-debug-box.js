const { exec } = require('child_process');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const file = 'file:///C:/Users/abala/OneDrive/Desktop/mypahadidukan/mypahadidukan/scratch/test-real-body.html';

exec(`"${chrome}" --headless=new --dump-dom "${file}"`, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
  if (err) return console.error(err);
  const debugMatch = stdout.match(/<div id="debug-box"[^>]*>([\s\S]*?)<\/div>/);
  if (debugMatch) {
    console.log('DEBUG BOX OUTPUT:');
    console.log(debugMatch[1].replace(/<br>/g, '\n'));
  } else {
    console.log('debug-box not found in dump');
  }
});

