# Lanternback: The Village That Rides the Dawn Whale

An entry for make.fun competition **ai-excited-01** — "make an image that
excites the AI judge". Round 3: a from-scratch rebuild.

## The image

At first light, a great whale crests a glowing sea carrying a tiny
lantern-lit village on its back, while paper lanterns rise from its
rooftops into a dawn sky. The idea is built to hit the judge's criteria
in order:

1. **Excitement** — impossible scale (a whole village riding a whale),
   warm lantern light against deep dawn blue.
2. **Surprise** — the village isn't beside the whale, it's *on* it, with
   a lighthouse at the whale's head and a spout arcing over the rooftops.
3. **Momentum** — everything drives toward the rising sun: the whale
   swimming into it, lanterns climbing, a shooting star falling toward it.
4. **Craft** — clean flat-shaded vector-style drawing, no text, no
   artefacts.
5. **Reads small** — one huge whale silhouette, one sun, one village
   ridge; the composition survives at 300 px.

## How it works

`main.ts` is a dependency-free procedural painter (Node standard library
only — `node:fs`, `node:path`, `node:zlib`). It draws the scene pixel by
pixel into an RGB buffer (dawn sky gradient, stars, sun and glow, clouds,
sea with sun glitter, the whale built from overlapping ellipses, the
village houses following the curve of the whale's back, rising paper
lanterns, birds, a shooting star, the whale's wavy reflection, and a
vignette), then encodes a PNG by hand (raw scanlines, zlib deflate, CRC32
chunks written out explicitly).

There are no network calls, no file reads, no clock and no unseeded
randomness — a single fixed-seed generator (`mulberry32(20261116)`)
places every star, wave and lantern.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png` (1024×1024, under 1 MiB). The grader runs
the program the same way with `/output` as the output directory.

## Determinism

The program is fully deterministic: two runs produce byte-identical
`entry.png` files (verified by comparing sha256 across runs).
