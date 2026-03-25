const https = require('https');
const fs = require('fs');

https.get('https://www.nebaministry.org/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const urls = data.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/?[^\s"'>\\]*\.(?:png|jpg|jpeg|webp|gif))/gi) || [];
    const uniqueUrls = [...new Set(urls)];
    fs.writeFileSync('urls.txt', uniqueUrls.join('\n'));
    console.log(`Saved ${uniqueUrls.length} URLs to urls.txt`);
  });
}).on('error', (e) => {
  console.error(e);
});
