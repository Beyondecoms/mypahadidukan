const { exec } = require('child_process');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const file = 'file:///C:/Users/abala/.gemini/antigravity/brain/9a5ad720-e9f0-4a99-b96f-2685b9aeb643/scratch/live-debug.html';

const cmd = `"${chrome}" --headless=new --enable-logging=stderr --v=1 --virtual-time-budget=5000 "${file}"`;

exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
  console.log('STDOUT:', stdout);
  console.log('STDERR:', stderr.split('\n').filter(line => line.includes('INJECT') || line.includes('DEBUG') || line.includes('BLOCK')).join('\n'));
});

