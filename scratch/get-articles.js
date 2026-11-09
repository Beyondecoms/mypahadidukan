const token = 'ff14759a858950c096b40885270d2422';
const shop = 'tmwlnb45g3tj97aa-74609525042.myshopify.com';

const query = `{
  articles(first: 10) {
    edges {
      node {
        id
        title
        handle
        blog {
          handle
        }
      }
    }
  }
}`;

fetch(`https://${shop}/api/2024-01/graphql.json`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Storefront-Access-Token': token
  },
  body: JSON.stringify({ query })
})
  .then(r => r.json())
  .then(d => console.log(JSON.stringify(d, null, 2)))
  .catch(err => console.error(err));

