# БАЗА — сайт

A static site. No build step, no bundler, no framework: open `index.html`
over any HTTP server and it runs.

```
python3 -m http.server 8000     # then http://localhost:8000/
```

`file://` will not work — the frame reel is fetched, and `fetch` refuses
file URLs.

## Layout

```
index.html            markup only
assets/css/
  fonts.css           @font-face, subsetted woff2 by unicode-range
  core.css            tokens, reset, layout, header, preloader, ticker
  universes.css       one block per universe, plus the transitions
assets/js/
  core.js             one rAF, one scroll read, the scene system
  audio.js            web-audio sfx, off until the visitor asks for it
  data.js             all copy that the JS injects
  hero.js             the scroll-driven laptop reel
  fx.js               boot field, click burst, bottom ticker
  universes.js        the canvas backdrops
  sections.js         Mario, Matrix, TikTok, Tetris interactions
  sections2.js        Flappy, Shrek, Strange, Upside Down, Star Wars
  transitions.js      the set pieces between universes
  brief.js            the two-step form
  app.js              stage director + chrome
assets/seq/d/         182 landscape frames (1600×901)
assets/seq/m/         104 portrait frames (810×1438)
assets/fonts/         18 woff2 subsets
assets/img/           logos, hero poster, favicon
```

## The frame reel

`assets/seq/` is generated from the two source videos with ffmpeg. The
watermark the renderer burned into the corner is removed with `delogo`, the
odd edge pixels are cropped, and the result is written as webp:

```sh
# landscape — every 2nd frame of a 60fps take
ffmpeg -i 0903.mp4 \
  -vf "delogo=x=1668:y=988:w=220:h=72,crop=1904:1072:6:4,\
scale=1600:901:flags=lanczos,select='not(mod(n\,2))'" \
  -vsync 0 -c:v libwebp -quality 80 -compression_level 6 -preset picture \
  assets/seq/d/%04d.webp

# portrait — every 3rd frame
ffmpeg -i portrait.mp4 \
  -vf "delogo=x=828:y=1826:w=230:h=70,crop=1072:1904:4:6,\
scale=810:1438:flags=lanczos,select='not(mod(n\,3))'" \
  -vsync 0 -c:v libwebp -quality 80 -compression_level 6 -preset picture \
  assets/seq/m/%04d.webp
```

Change the frame counts in `SETS` at the top of `hero.js` to match whatever
the encoder produced.

## House rules

- One `requestAnimationFrame` loop for the whole page. Scenes subscribe to it
  and only run while their band is near the viewport (`core.js`).
- Layout is read once per frame, before anything writes. Never call
  `getBoundingClientRect` inside a scene update — use the cached `__r`.
- A canvas that is faded out does not paint. Check the envelope first.
- Nothing that casts a shadow sits inside a box with `overflow:hidden`.
- Anything that owns a drag sets its own `touch-action`; everything else
  inherits `manipulation`, which is what keeps the page from jumping on tap.
