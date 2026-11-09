const fs = require('fs');
let html = fs.readFileSync('c:/Users/abala/OneDrive/Desktop/mypahadidukan/mypahadidukan/scratch/test-real-body.html', 'utf8');

html = html.replace('debugBox.innerHTML = ', 'console.log(debugBox.innerHTML = ');
html = html.replace(');', '));');

fs.writeFileSync('c:/Users/abala/OneDrive/Desktop/mypahadidukan/mypahadidukan/scratch/test-real-body.html', html);

