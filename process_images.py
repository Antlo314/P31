from rembg import remove
import urllib.request

urls = [
    "https://static.wixstatic.com/media/a60154_5c1226c9ebbe412eab8704cd9c160b19~mv2.png",
    "https://static.wixstatic.com/media/a60154_734c3788881b4cf9b5cf886ec311e775~mv2.jpg",
    "https://static.wixstatic.com/media/a60154_a5239434dc774be493bc5705a4ce93b5~mv2.png"
]

for i, url in enumerate(urls, start=1):
    try:
        print(f"Downloading {url}...")
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            input_image = response.read()
            print("Removing background...")
            output_image = remove(input_image)
            with open(f"c:\\Users\\aarons\\.gemini\\antigravity\\scratch\\P31\\src\\assets\\melanie_rm_{i}.png", "wb") as f:
                f.write(output_image)
            print(f"Saved melanie_rm_{i}.png")
    except Exception as e:
        print(f"Error on image {i}: {e}")
