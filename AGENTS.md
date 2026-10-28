# Notes for coding agents

jackgilmorecreative.com: Jack Gilmore's animation, comics and writing. Plain
HTML/CSS/JS on GitHub Pages (repo `jackrgilmore/Website`, branch `main`,
pushing to it is deploying; live a minute or two later). No npm, no bundler:
the only build is Emacs exporting Org. `README.org` is the user-facing manual
(keys, file table, designing the pictures); read it for anything not here.
How everything works, line by line, is also the "Emacs on the Web" tutorial
in `~/dotfiles/tutorial/eow-lessons/`; keep it in step when you change
something it teaches (theme, nav, publish, preview...).

## Where things are

- **This repo**: `~/Projects/Website`. Not `~/Desktop/Website`: the Desktop
  is OneDrive, which flipped file modes and was a corruption risk; the site
  was moved out on 2026-10-28 and the old copy deleted.
- **Emacs side**: Doom literate config `~/dotfiles/doom/.config/doom/config.org`
  (separate repo, `~/dotfiles`), tangled into `config.el`. The website section
  is under the "Website" heading: `my/website-*` (preview, publish-and-push,
  new post...), `my/crosspost*` / `my/instagram-*` / `my/newsletter-*`
  (cross-posting), keys under `SPC n w`. `my/website-dir` points here.
- **Writing sources**: `content/writing/*.org` and `*.fountain` (scripts);
  media in `content/writing/media/SLUG/`. Videos: `content/animation.org`;
  comics: `content/comics.org` (parsed in the browser by `catalog.js`).
- **Garden**: org-roam notes tagged `publish` in `~/org/roam/` (Google Drive).
- **Secrets** (never commit, never print): `~/.config/website/instagram.json`
  (Instagram token, auto-refreshed), `~/.config/website/buttondown.json`.

## How the pieces fit

- `publish.el` (`jg-site-publish`): exports writing to `writing/*.html`
  (books to `writing/SLUG.html` + `writing/SLUG/chapter-N.html` + `.epub`;
  scripts to HTML + a screenplay `.pdf` written by hand-rolled PDF code),
  garden notes to `garden/`, and writes `data/writing.json`,
  `data/garden.json`, `sitemap.xml`, `feed.xml` (blog only), `og.jpg` (from
  `og.png`) and the Instagram pictures in `social/SLUG/` (blog only, via
  `tools/slides.swift`, compiled once into `~/.cache/jg-site/`). It stamps
  today's date into any page not yet in the last commit (`git ls-tree HEAD`).
  It wipes and regenerates `writing/` and `garden/` every run.
- Generated pages share one template, `jg-site--page`. Their Share button is
  `jg-site--share-button`; `nav.js` adds the icon and behaviour.
- Browser-built pages (`read.js`, `animation.js`, `series.js`, `comic*.js`,
  `everything.js`, `garden.js`, `search.js`) load `data/*.json` or the Org
  files through `catalog.js` (`Site.*` helpers). `nav.js` builds the nav,
  footer, theme toggle, feed/newsletter popover, Share buttons, and loads
  `search.js` and `keys.js`. `theme.js` runs in `<head>`: theme follows the
  device; the toggle overrides for the visit only (sessionStorage).
- One stylesheet, `site.css`, with light/dark tokens on `:root`.
- Cross-posting (Emacs, after `SPC n w P` pushes, for newly published blog
  posts; `SPC n w x` by hand): waits until the page is live, then email
  (Buttondown), Instagram (carousel of `social/SLUG/N.jpg`, then
  `story.jpg` to the story; falls back to one picture) and Facebook (opens
  the share dialog with the caption on the clipboard; personal profiles have
  no API). Log in the `*cross-post*` buffer. Instagram fetches images by URL,
  so they must be pushed first: GitHub's 404 page gives "Only photo or video
  can be accepted as media type".
- `design/story.png` + `story.json` (+ generated `story-guide.png`) are the
  user-editable story design; `og.png`/`og.svg` the card. Changing them
  redraws every post's pictures (`social/SLUG/key` holds the inputs' hash).
- `examples/` holds sample books and scripts that are never published;
  `SPC n w V` builds a throwaway copy with them at localhost:8001.

## Building and checking

- Publish locally (no push): `emacs --batch -l publish.el -f jg-site-publish`.
  It edits source files (date stamps) and regenerates everything: run it in
  the real repo only when the user wants the site rebuilt; for experiments,
  copy the repo (`rsync -a --exclude .git`) and run it there.
- The user's Emacs runs as a daemon. Its socket is
  `$TMPDIR/emacs501/server` (here `/var/folders/qc/hq064w6d2p52b04ny4_gmmsm0000gn/T/emacs501/server`):
  `emacsclient -s <socket> --eval '...'` to reload config or test commands
  in the real session. After editing `config.org`, tangle and reload:
  ```
  cd ~/dotfiles/doom/.config/doom
  emacs --batch --eval '(progn (require (quote org)) (require (quote ob-tangle)) (setf (alist-get :tangle org-babel-default-header-args) "config.el") (org-babel-tangle-file "config.org"))'
  emacsclient -s <socket> --eval '(load (expand-file-name "~/dotfiles/doom/.config/doom/config.el") nil t)'
  ```
  Plain `org-babel-tangle-file` tangles 0 blocks: Doom defaults `:tangle`
  to config.el, plain Org to no. Check `config.el` still reads (`read` it
  form by form) before loading it.
- Preview: the user's `SPC n w v` serves this folder at localhost:8000. For
  your own checks serve a copy on another port. Screenshots: headless Edge,
  `"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" --headless=new --user-data-dir=<scratch> --disable-gpu --hide-scrollbars --virtual-time-budget=5000 --window-size=W,H --screenshot=<png> <url>`
  (`--blink-settings=preferredColorScheme=0|1` for dark/light). Its window
  can't go below ~500px wide, so phone widths clip; that isn't a site bug.
  `--dump-dom` to inspect what scripts built.
- JS has no build: check syntax with `node -e "new Function(require('fs').readFileSync('x.js','utf8'))"`.
- Images: `sips` converts/resizes; no PIL. Small Swift scripts work well for
  pixel checks or contact sheets.
- Instagram calls can be dry-run by stubbing `my/instagram--call` with
  `cl-letf` through emacsclient. Never post for real without the user
  asking: posts can't be deleted through the API.

## Traps hit before

- The shell is zsh: `$var` holding several paths does not word-split, and
  unmatched globs are errors. `grep` is aliased to ugrep, and BSD `grep -Z`
  means decompress, not NUL-separate: use `/usr/bin/grep`, or `find -print0`.
- Editing `config.org` by slicing from one `(defun` to the next `#+end_src`
  once deleted `my/crosspost-facebook`. After big edits, diff the list of
  `defun`/`defvar` names against `git show HEAD:...`.
- macOS color management: a color picked from an image and filled back in
  comes out a shade off. `slides.swift` paints its paper by stretching a
  pixel of `og.png` instead.
- `NSAttributedString` HTML import ignores CSS `line-height` and leaves
  ordered-list numbers bare; `slides.swift` fixes both after import.
- Org exports random IDs (`org1a2b3c`), so regenerated pages show diffs even
  when nothing changed. The EPUB writer strips unreferenced ones.
- Two keys mean different things in Fountain: `Draft: t` hides a script,
  `Revision:` names the draft (shown on its card).

## Working with this user

- Explain things plainly; they use Emacs heavily but aren't a web developer.
- Verify visually (screenshots) and say what was and wasn't checked.
- Don't commit or push unless asked; the user's own `SPC n w P` publishes.
  Commit messages end with the Co-Authored-By line the session specifies.
- Keep README.org, the comments in `publish.el`/`config.org`, and the
  tutorial accurate when behaviour changes. Match the existing style: prose
  comments explaining why, plain names.
