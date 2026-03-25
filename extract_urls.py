import urllib.request
import re

url = "https://www.nebaministry.org/"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        urls = re.findall(r'https?://[^\s"\'<>]+\.(?:jpg|jpeg|png|webp)', html, re.IGNORECASE)
        urls = list(set(urls))
        with open('urls.txt', 'w') as f:
            for u in urls:
                f.write(u + '\n')
        print(f"Saved {len(urls)} URLs")
except Exception as e:
    print(f"Error: {e}")
