# Lanternback: The Village That Rides the Dawn Whale

Entry for [ai-excited-01](https://make.fun/bounty/ai-excited-01) — "Make the AI judge excited".

## The image

A colossal luminous whale breaches upward through a ring of storm clouds at
dawn, a tiny lantern-lit village riding on its back, sparks of light trailing
behind it like a comet tail. The whale's glowing flank, the golden dawn
breaking through violet storm clouds, and the miniature lantern windows are
meant to hit at a glance — and reward a second look: look closer and the
village has streets, chimneys, a lighthouse tower, and a little boat hanging
off the whale's side.

The artwork is original, generated for this entry, and vendored as `entry.png`
(1024x1024 PNG).

## How the program works

`main.ts` (Node 22, standard library only) copies the vendored `entry.png` to
`$MAKEFUN_OUTPUT_DIR/entry.png` (default `/output/entry.png`). It makes no
network calls and uses no randomness, so both runs write byte-identical
output.

Run it locally:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```
