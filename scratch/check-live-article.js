async function fetchPage() {
  try {
    const res = await fetch('https://tmwlnb45g3tj97aa-74609525042.shopifypreview.com/blogs/recipes/ashwagandha-powder', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    const html = await res.text();
    console.log('Status:', res.status, 'Length:', html.length);
    
    // Check for bp-slider-tpl or article-products-section
    const hasTpl = html.includes('bp-slider-tpl');
    const hasSlider = html.includes('article-products-section');
    const hasFromPahadi = html.includes('From My Pahadi Dukan');
    console.log({ hasTpl, hasSlider, hasFromPahadi });

    // Look for where From My Pahadi Dukan appears in the HTML
    let idx = 0;
    while ((idx = html.indexOf('From My Pahadi Dukan', idx)) !== -1) {
      console.log('Found "From My Pahadi Dukan" at index', idx);
      console.log(html.substring(idx - 150, idx + 250));
      idx += 20;
    }
  } catch (err) {
    console.error(err);
  }
}
fetchPage();

