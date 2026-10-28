#!/bin/zsh
# Make the site's icons from favicon.svg, the one drawing of Hat Guy:
#   favicon.ico           for browsers that can't show an SVG (16, 32, 48 px)
#   apple-touch-icon.png  for iPhones' home screens (180 px, on the paper color)
#   og.png                the card a shared link shows, drawn from og.svg,
#                         which places favicon.svg on it rather than a copy
#   design/card-dark.png  the same card in the site's dark colors, for the
#                         Instagram pictures (tools/slides.swift)
#   design/hat-guy.png    Hat Guy alone, big, on nothing (see-through), for the
#                         story of a post with no picture of its own
# Each is only remade when what it's made from is newer, so running this
# when nothing has changed changes nothing. publish.el runs it every publish;
# it can also be run by hand from anywhere: tools/icons.sh
# Needs rsvg-convert and magick (brew install librsvg imagemagick).

cd "${0:A:h}/.." || exit 1

for tool in rsvg-convert magick; do
  if ! command -v $tool >/dev/null; then
    echo "icons.sh: no $tool here, so the icons weren't remade (brew install librsvg imagemagick)" >&2
    exit 1
  fi
done

tmp=$(mktemp -d) || exit 1
trap 'rm -rf "$tmp"' EXIT

# PNGs without the date ImageMagick would stamp in, so the same drawing
# always gives the same file (and git sees no change)
plain=(-strip -define png:exclude-chunks=date,time)

if [[ favicon.svg -nt favicon.ico ]]; then
  for n in 16 32 48; do
    rsvg-convert -w $n -h $n favicon.svg -o $tmp/$n.png || exit 1
  done
  magick $tmp/16.png $tmp/32.png $tmp/48.png favicon.ico && echo "Made favicon.ico"
fi

if [[ favicon.svg -nt apple-touch-icon.png ]]; then
  # A margin all round, as iOS rounds the corners off
  rsvg-convert -w 140 -h 140 favicon.svg -o $tmp/touch.png || exit 1
  magick -size 180x180 'xc:#faf7f2' $tmp/touch.png -gravity center -composite \
         $plain PNG24:apple-touch-icon.png && echo "Made apple-touch-icon.png"
fi

# No og.svg means og.png is designed by hand (in Photoshop, say): leave it be
if [[ -f og.svg && ( og.svg -nt og.png || favicon.svg -nt og.png ) ]]; then
  rsvg-convert og.svg -o $tmp/og.png &&
    magick $tmp/og.png $plain PNG24:og.png && echo "Made og.png"
fi

# The dark card: og.svg with the light colors swapped for the dark theme's
# (site.css), drawn next to a copy of favicon.svg so Hat Guy comes along
if [[ -f og.svg && ( ! -f design/card-dark.png || og.svg -nt design/card-dark.png || favicon.svg -nt design/card-dark.png ) ]]; then
  cp favicon.svg $tmp/ &&
    sed -e 's/#faf7f2/#111111/' -e 's/#1f1b17/#e8e0d4/' -e 's/#946f2f/#c9a96e/g' -e 's/#8f877e/#8f887f/' \
        og.svg > $tmp/card-dark.svg &&
    rsvg-convert $tmp/card-dark.svg -o $tmp/card-dark.png &&
    magick $tmp/card-dark.png $plain PNG24:design/card-dark.png && echo "Made design/card-dark.png"
fi

if [[ ! -f design/hat-guy.png || favicon.svg -nt design/hat-guy.png ]]; then
  rsvg-convert -w 1024 -h 1024 favicon.svg -o $tmp/hat-guy.png &&
    magick $tmp/hat-guy.png $plain PNG32:design/hat-guy.png && echo "Made design/hat-guy.png"
fi
