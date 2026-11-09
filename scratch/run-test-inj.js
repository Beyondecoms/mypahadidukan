const { exec } = require('child_process');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const file = 'file:///C:/Users/abala/OneDrive/Desktop/mypahadidukan/mypahadidukan/scratch/test-slider-injection.html';
const outImg = 'C:\\Users\\abala\\.gemini\\antigravity\\brain\\9a5ad720-e9f0-4a99-b96f-2685b9aeb643\\test-slider-inj.png';

exec(`"${chrome}" --headless=new --screenshot="${outImg}" --window-size=1200,1000 "${file}"`, (err, stdout, stderr) => {
  if (err) console.error(err);
  else console.log('Screenshot captured successfully to', outImg);
});

