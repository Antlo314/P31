# The hands mark, rebuilt

`original-mark.png` is the untouched 381px art. `enhance.mjs` rebuilds the mark from it at 2048px
(clean rim, smooth outline, flat colour, finger lines kept) and writes every variant to `out/`:
the transparent mark, white/plum/gold silhouettes, app icons, the round avatar and the
Instagram/Facebook profile tile. `publish.py` copies `out/` into the repo at the sizes each place
uses; `og.mjs` then redraws the two share images and the brand kit PDF.

```
cd tools/brand
node enhance.mjs          # needs the repo's node_modules (sharp)
python publish.py
node og.mjs
```
