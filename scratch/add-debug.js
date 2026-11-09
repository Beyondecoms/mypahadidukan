const fs = require('fs');
let html = fs.readFileSync('c:/Users/abala/OneDrive/Desktop/mypahadidukan/mypahadidukan/scratch/test-slider-injection.html', 'utf8');

html = html.replace('</script>', `
  var debug = document.createElement('div');
  debug.id = 'debug-output';
  debug.innerHTML = 'BEST BLOCK: ' + (bestBlock ? (bestBlock.tagName + ' - ' + bestBlock.textContent.substring(0, 40)) : 'NONE') +
    '<br>TOTAL BLOCKS: ' + blocks.length +
    '<br>TOTAL HEIGHT: ' + totalContentHeight +
    '<br>TARGET HEIGHT: ' + targetHeight;
  document.body.prepend(debug);
</script>`);

fs.writeFileSync('c:/Users/abala/OneDrive/Desktop/mypahadidukan/mypahadidukan/scratch/test-slider-injection.html', html);
console.log('Updated test file');

