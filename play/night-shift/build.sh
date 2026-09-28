#!/bin/sh
# Bundles src/ into game.js. Run from anywhere: sh play/night-shift/build.sh
cd "$(dirname "$0")" && npx --yes esbuild@0.25.10 src/main.js --bundle --minify --keep-names --format=iife --target=es2020 --outfile=game.js "$@"
