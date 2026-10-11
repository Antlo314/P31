# Copy the rebuilt mark set (out/*) into the repo at the sizes each place uses.
import os, shutil
from PIL import Image
ROOT = 'C:/Users/aarons/.gemini/antigravity/scratch/P31'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
j = lambda *p: os.path.join(ROOT, *p)
o = lambda n: os.path.join(OUT, n)

def png(src, dst, size=None):
    im = Image.open(src).convert('RGBA')
    if size and im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, optimize=True)
    print(dst, im.size)

# Brand folder (1024 masters)
for n in ['mark', 'mark-white', 'mark-plum', 'mark-gold']:
    png(o(f'{n}.png'), j('marketing', 'brand', f'{n}.png'), 1024)
for n in ['icon-1024', 'avatar-1024', 'profile-1024']:
    png(o(f'{n}.png'), j('marketing', 'brand', f'{n}.png'))

# Site icons, both domains
for base in [j('public', 'icons'), j('public', 'c', 'icons')]:
    png(o('icon-512.png'), os.path.join(base, 'icon-512.png'))
    png(o('icon-192.png'), os.path.join(base, 'icon-192.png'))
    png(o('icon-180.png'), os.path.join(base, 'apple-touch-icon.png'))
    png(o('maskable-512.png'), os.path.join(base, 'maskable-512.png'))
for s in [16, 32, 48, 96]:
    png(o(f'icon-{s}.png'), j('public', 'c', 'icons', f'favicon-{s}.png'))
for base in [j('public'), j('public', 'c')]:
    png(o('icon-512.png'), os.path.join(base, 'favicon.png'))
    big = Image.open(o('icon-1024.png')).convert('RGBA')
    big.save(os.path.join(base, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
    print(os.path.join(base, 'favicon.ico'))

# In-app marks (transparent)
shutil.copyfile(o('mark-192.webp'), j('src', 'assets', 'web', 'p31-mark-192.webp')); print('p31-mark-192.webp')
png(o('mark.png'), j('src', 'assets', 'academy', 'collective-mark.png'), 1024)
shutil.copyfile(o('mark-512.webp'), j('src', 'assets', 'academy', 'collective-mark.webp')); print('collective-mark.webp')
print('published')
