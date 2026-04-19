const https = require('https');
const fs = require('fs');
const path = require('path');

const assets = [
  { name: 'logo.png', url: 'https://cdn.builder.io/api/v1/image/assets/TEMP/ae6354fd4b74681604a11f9301905ac681604a11f9301905ac681604a11f9301905ac6?' },
  { name: 'mist.png', url: 'https://static.wixstatic.com/media/a60154_1062b8e309fc4d098e986079930f7608~mv2.png/v1/fill/w_448,h_554,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/a60154_1062b8e309fc4d098e986079930f7608~mv2.png' },
  { name: 'oil.png', url: 'https://static.wixstatic.com/media/a60154_4eb45ce289fc4808a3d4ac2e41d1867a~mv2.png/v1/fill/w_448,h_554,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/a60154_4eb45ce289fc4808a3d4ac2e41d1867a~mv2.png' },
  { name: 'set.png', url: 'https://static.wixstatic.com/media/a60154_0669ba2089fc41d08679ba2089fc41d08679ba20~mv2.png/v1/fill/w_448,h_554,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/a60154_0669ba2089fc41d08679ba2089fc41d08679ba20~mv2.png' }
];

const targetDir = path.join(__dirname, '..', 'src', 'assets', 'curators', 'ilcollection');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

async function download(asset) {
  return new Promise((resolve, reject) => {
    const url = new URL(asset.url);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Referer': 'https://www.nebaministry.org/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    };

    https.get(options, (res) => {
      if (res.statusCode === 200) {
        const file = fs.createWriteStream(path.join(targetDir, asset.name));
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`Downloaded ${asset.name}`);
          resolve();
        });
      } else {
        console.error(`Failed to download ${asset.name}: ${res.statusCode}`);
        reject();
      }
    }).on('error', (err) => {
      console.error(`Error downloading ${asset.name}: ${err.message}`);
      reject(err);
    });
  });
}

async function run() {
  for (const asset of assets) {
    try {
      await download(asset);
    } catch (e) {
      // ignore failures for now
    }
  }
}

run();
