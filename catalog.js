// Shared helpers for every page.
//
// The animation and comics pages are written in Org (content/animation.org and
// content/comics.org). This file reads those Org files in the browser, works out
// how to embed each video, and draws the cards, players and lightbox.
//
// Only a small part of Org is understood, which is all the catalogs need:
//   #+keyword: value         at the top of the file
//   * Headings               (COMMENT headings and :noexport: are skipped)
//   :PROPERTIES: drawers     (each :KEY: value)
//   paragraphs               (with [[links][descriptions]], *bold*, /italic/)
//   [[file:../comics/1.png]] on a line of its own: an image (a comic page)

var Site = (function () {

    var CONTENT = '/content/';
    var VIDEO_KEYS = ['video', 'youtube', 'vimeo', 'instagram', 'tiktok'];
    var PLATFORMS = [
        ['youtube', 'YouTube'],
        ['instagram', 'Instagram'],
        ['tiktok', 'TikTok'],
        ['vimeo', 'Vimeo']
    ];
    var IMAGE_RE = /\.(png|jpe?g|gif|webp|svg)$/i;


    // ============ SMALL HELPERS ============

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function slug(text) {
        return String(text).toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'item';
    }

    // A path written in an Org file, relative to content/ (like ../thumbs/a.jpg),
    // as a URL the browser can load
    function resolve(path) {
        if (!path) return null;
        path = path.replace(/^file:/, '');
        try {
            var url = new URL(path, window.location.origin + CONTENT);
            return url.origin === window.location.origin ? url.pathname : url.href;
        } catch (e) {
            return null;
        }
    }

    function prettyDate(iso) {
        var m = /(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
        if (!m) return '';
        var date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    }

    function param(name) {
        return new URLSearchParams(window.location.search).get(name);
    }


    // ============ ORG ============

    function parseOrg(text) {
        var root = { level: 0, title: '', tags: [], props: {}, body: [], children: [], meta: {} };
        var stack = [root];
        var inDrawer = false;
        var skipBelow = 0; // level of a COMMENT heading being skipped

        text.split(/\r?\n/).forEach(function (line) {
            var heading = /^(\*+)\s+(.*)$/.exec(line);

            if (heading) {
                var level = heading[1].length;
                if (skipBelow && level > skipBelow) return;
                skipBelow = 0;

                var title = heading[2].trim();
                var tags = [];
                var tagMatch = /\s+(:[\w@#%:]+:)\s*$/.exec(title);
                if (tagMatch) {
                    tags = tagMatch[1].split(':').filter(Boolean);
                    title = title.slice(0, tagMatch.index).trim();
                }
                if (/^COMMENT\b/.test(title) || tags.indexOf('noexport') !== -1) {
                    skipBelow = level;
                    return;
                }
                title = title.replace(/^(TODO|DONE)\s+/, '');

                var node = { level: level, title: title, tags: tags, props: {}, body: [], children: [] };
                while (stack[stack.length - 1].level >= level) stack.pop();
                stack[stack.length - 1].children.push(node);
                stack.push(node);
                inDrawer = false;
                return;
            }

            if (skipBelow) return;
            var current = stack[stack.length - 1];

            if (/^\s*:PROPERTIES:\s*$/i.test(line)) {
                inDrawer = true;
                return;
            }
            if (inDrawer) {
                if (/^\s*:END:\s*$/i.test(line)) {
                    inDrawer = false;
                    return;
                }
                var prop = /^\s*:([^:\s]+):\s*(.*)$/.exec(line);
                if (prop) current.props[prop[1].toLowerCase()] = prop[2].trim();
                return;
            }

            var keyword = /^\s*#\+(\w+):\s*(.*)$/.exec(line);
            if (keyword) {
                if (current === root) root.meta[keyword[1].toLowerCase()] = keyword[2].trim();
                return;
            }
            if (/^\s*#(\s|$)/.test(line)) return; // # comment lines

            current.body.push(line);
        });

        return root;
    }

    // Org inline markup -> HTML: links, *bold*, /italic/, =code=, ~code~
    function inline(text) {
        var links = [];
        var html = esc(text).replace(/\[\[([^\]]+)\](?:\[([^\]]+)\])?\]/g, function (all, target, label) {
            var url = target.replace(/^file:/, '');
            var href = /^(https?:|mailto:)/i.test(url) ? url : resolve(url);
            if (!href || /^javascript:/i.test(href)) return label || target;
            links.push('<a href="' + href + '">' + (label || target) + '</a>');
            return '\u0000' + (links.length - 1) + '\u0000';
        });
        var edge = '(^|[\\s(\'"])';
        var end = '(?=[\\s.,;:!?)\'"]|$)';
        html = html
            .replace(new RegExp(edge + '\\*([^*\\s](?:[^*]*[^*\\s])?)\\*' + end, 'g'), '$1<strong>$2</strong>')
            .replace(new RegExp(edge + '\\/([^/\\s](?:[^/]*[^/\\s])?)\\/' + end, 'g'), '$1<em>$2</em>')
            .replace(new RegExp(edge + '[=~]([^=~\\s](?:[^=~]*[^=~\\s])?)[=~]' + end, 'g'), '$1<code>$2</code>');
        return html.replace(/\u0000(\d+)\u0000/g, function (all, i) { return links[+i]; });
    }

    // A heading's text: paragraphs (as HTML and plain text) and images
    function readBody(lines) {
        var images = [];
        var paragraphs = [];
        var current = [];

        lines.forEach(function (line) {
            var trimmed = line.trim();
            var image = /^(?:[-+]\s+)?\[\[(?:file:)?([^\]]+)\](?:\[[^\]]*\])?\]$/.exec(trimmed);
            if (image && IMAGE_RE.test(image[1])) {
                images.push(resolve(image[1]));
                return;
            }
            if (!trimmed) {
                if (current.length) paragraphs.push(current.join(' '));
                current = [];
                return;
            }
            current.push(trimmed);
        });
        if (current.length) paragraphs.push(current.join(' '));

        var plain = paragraphs.join(' ').replace(/\[\[[^\]]+\]\[([^\]]+)\]\]/g, '$1').replace(/\[\[([^\]]+)\]\]/g, '$1');
        return {
            images: images,
            html: paragraphs.map(function (p) { return '<p>' + inline(p) + '</p>'; }).join(''),
            summary: plain.length > 140 ? plain.slice(0, 137).replace(/\s+\S*$/, '') + '…' : plain
        };
    }

    function loadOrg(name) {
        return fetch(CONTENT + name, { cache: 'no-cache' })
            .then(function (res) {
                if (!res.ok) throw new Error('Could not load ' + CONTENT + name + ' (' + res.status + ')');
                return res.text();
            })
            .then(parseOrg);
    }


    // ============ VIDEO ============

    // How to embed URL, or null. ASPECT ("vertical" or "wide") overrides the guess.
    function media(url, aspect) {
        if (!url) return null;
        url = url.trim();
        var m, video;

        if ((m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(url))) {
            video = {
                kind: 'youtube',
                vertical: /\/shorts\//.test(url),
                embed: 'https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0',
                thumb: 'https://img.youtube.com/vi/' + m[1] + '/hqdefault.jpg'
            };
        } else if ((m = /vimeo\.com\/(?:video\/)?(\d+)(?:\/([\da-f]+))?/.exec(url))) {
            video = {
                kind: 'vimeo',
                vertical: false,
                embed: 'https://player.vimeo.com/video/' + m[1] + (m[2] ? '?h=' + m[2] : ''),
                thumb: 'https://vumbnail.com/' + m[1] + '.jpg'
            };
        } else if ((m = /instagram\.com\/(?:[\w.]+\/)?(p|reels?|tv)\/([\w-]+)/.exec(url))) {
            video = {
                kind: 'instagram',
                vertical: true,
                embed: 'https://www.instagram.com/' + (m[1] === 'p' ? 'p' : 'reel') + '/' + m[2] + '/embed',
                thumb: null
            };
        } else if ((m = /tiktok\.com\/.*\/video\/(\d+)/.exec(url))) {
            video = {
                kind: 'tiktok',
                vertical: true,
                embed: 'https://www.tiktok.com/embed/v2/' + m[1],
                thumb: null
            };
        } else if (/\.(mp4|webm|mov)(\?.*)?$/i.test(url)) {
            video = { kind: 'file', vertical: false, src: resolve(url), thumb: null };
        } else {
            video = { kind: 'link', vertical: false, thumb: null };
        }

        if (aspect) video.vertical = aspect.toLowerCase() === 'vertical';
        video.url = url;
        return video;
    }

    function videoFor(props) {
        for (var i = 0; i < VIDEO_KEYS.length; i++) {
            if (props[VIDEO_KEYS[i]]) return media(props[VIDEO_KEYS[i]], props.aspect);
        }
        return null;
    }

    function player(video, autoplay, title) {
        if (!video) {
            return '<div class="player"><div class="player-missing">Coming soon</div></div>';
        }
        var open = '<div class="player' + (video.vertical ? ' vertical' : '') + '">';
        if (video.kind === 'file') {
            return open + '<video src="' + esc(video.src) + '" title="' + esc(title || 'Video') + '" controls playsinline'
                + (autoplay ? ' autoplay' : '') + '></video></div>';
        }
        if (video.kind === 'link') {
            return open + '<div class="player-missing"><a href="' + esc(video.url) + '" target="_blank" rel="noopener">Watch it here ↗</a></div></div>';
        }
        // Opening a video to play it counts as watching it (analytics.js); the
        // others count when someone clicks into the player
        if (autoplay && window.countEvent) countEvent('watch', title || video.embed);
        var src = video.embed + (autoplay ? (video.embed.indexOf('?') === -1 ? '?' : '&') + 'autoplay=1' : '');
        return open + '<iframe src="' + esc(src) + '" title="' + esc(title || 'Video') + '"'
            + ' allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"'
            + ' allowfullscreen></iframe></div>';
    }

    function platformButtons(links) {
        return links.map(function (link) {
            return '<a class="button" href="' + esc(link.url) + '" target="_blank" rel="noopener">'
                + (typeof icon === 'function' ? icon(link.key) : '') + link.label + '</a>';
        }).join('');
    }


    // ============ CATALOGS ============

    function makeItem(node) {
        var body = readBody(node.body);
        var props = node.props;
        var links = [];
        PLATFORMS.forEach(function (p) {
            if (props[p[0]]) links.push({ key: p[0], label: p[1], url: props[p[0]] });
        });
        var images = props.image ? [resolve(props.image)].concat(body.images) : body.images;
        return {
            title: node.title,
            slug: slug(node.title),
            date: props.date || '',
            description: body.html,
            summary: body.summary,
            video: videoFor(props),
            images: images,
            links: links,
            thumb: resolve(props.thumb || props.cover || props.poster) || null
        };
    }

    function thumbOf(item) {
        return item.thumb || (item.video && item.video.thumb) || (item.images && item.images[0]) || null;
    }

    // A series heading. A child with children of its own is a season; any other
    // child is an episode (or a comic issue).
    function makeSeries(node) {
        var series = makeItem(node);
        var used = {};
        series.seasons = [];
        series.entries = [];

        var loose = node.children.filter(function (c) { return !c.children.length; });
        if (loose.length) series.seasons.push({ title: '', nodes: loose });
        node.children.forEach(function (c) {
            if (c.children.length) series.seasons.push({ title: c.title, nodes: c.children });
        });

        series.seasons.forEach(function (season, s) {
            season.entries = season.nodes.map(function (child, i) {
                var entry = makeItem(child);
                while (used[entry.slug]) entry.slug += '-2';
                used[entry.slug] = true;
                entry.series = series;
                entry.season = season.title;
                entry.seasonIndex = s;
                entry.number = i + 1;
                entry.id = series.slug + '/' + entry.slug;
                entry.thumb = entry.thumb || null;
                series.entries.push(entry);
                return entry;
            });
            delete season.nodes;
        });
        return series;
    }

    // Everything in content/animation.org:
    //   { reel, series: [...], groups: [...], gallery: [...] }
    //
    // A top-level heading marked :KIND: series is a series. Any other top-level
    // heading is a group ("Projects", "Independent animation"...), which gets
    // its own button on the animation page. Inside a group, a heading with
    // videos under it (and none of its own) is a subsection:
    //   group = { title, slug, items: [every video], sections: [{ title, items }] }
    // Top-level headings that are just a video go in a group called "Other".
    // gallery is every video that isn't an episode, in one list.
    function loadAnimation() {
        return loadOrg('animation.org').then(function (doc) {
            var data = { reel: null, series: [], groups: [], gallery: [] };
            var other = null;
            var slugs = { all: true, series: true };    // taken by the page's own buttons

            function newGroup(title) {
                var group = { title: title, slug: slug(title), items: [], sections: [] };
                while (slugs[group.slug]) group.slug += '-2';
                slugs[group.slug] = true;
                return group;
            }
            function add(group, section, node) {
                var item = makeItem(node);
                item.collection = group.title;
                item.id = group.slug + '/' + item.slug;    // animation.html?play=<id> plays it
                group.items.push(item);
                section.items.push(item);
                data.gallery.push(item);
            }

            if (doc.meta.reel) {
                data.reel = { title: doc.meta.reel_title || 'Animation Reel', video: media(doc.meta.reel) };
            }
            doc.children.forEach(function (top) {
                if ((top.props.kind || '').toLowerCase() === 'series') {
                    data.series.push(makeSeries(top));
                    return;
                }
                if (videoFor(top.props) && !top.children.length) {
                    if (!other) other = newGroup('Other');
                    if (!other.sections.length) other.sections.push({ title: '', items: [] });
                    add(other, other.sections[0], top);
                    return;
                }
                var group = newGroup(top.title);
                var loose = { title: '', items: [] };
                group.sections.push(loose);
                if (videoFor(top.props)) add(group, loose, top);
                top.children.forEach(function (child) {
                    if (videoFor(child.props)) {
                        add(group, loose, child);
                    } else if (child.children.length) {
                        var section = { title: child.title, items: [] };
                        group.sections.push(section);
                        child.children.forEach(function (grandchild) {
                            if (videoFor(grandchild.props)) add(group, section, grandchild);
                        });
                    }
                });
                group.sections = group.sections.filter(function (s) { return s.items.length; });
                if (group.items.length) data.groups.push(group);
            });
            if (other) data.groups.push(other);
            return data;
        });
    }

    // Everything in content/comics.org:
    //   { series: [...], gallery: [...], byId: { id: comic } }
    function loadComics() {
        return loadOrg('comics.org').then(function (doc) {
            var data = { series: [], gallery: [], byId: {} };
            doc.children.forEach(function (top) {
                if ((top.props.kind || '').toLowerCase() === 'series') {
                    var series = makeSeries(top);
                    data.series.push(series);
                    series.entries.forEach(function (issue) { data.byId[issue.id] = issue; });
                    return;
                }
                var candidates = [top].concat(top.children);
                candidates.forEach(function (node) {
                    var item = makeItem(node);
                    if (!item.images.length) return;
                    item.id = item.slug;
                    while (data.byId[item.id]) item.id += '-2';
                    if (node !== top) item.collection = top.title;
                    data.gallery.push(item);
                    data.byId[item.id] = item;
                });
            });
            return data;
        });
    }

    function loadJSON(path, fallback) {
        return fetch(path, { cache: 'no-cache' })
            .then(function (res) { return res.ok ? res.json() : fallback; })
            .catch(function () { return fallback; });
    }


    // ============ DRAWING ============

    // A clickable thumbnail card. OPTS: href or attrs, thumb, title, meta, portrait, play
    function card(opts) {
        var thumb = opts.thumb
            ? '<img src="' + esc(opts.thumb) + '" alt="" loading="lazy">'
            : '<span class="thumb-placeholder">' + esc(opts.title) + '</span>';
        var inner = '<span class="thumb' + (opts.portrait ? ' portrait' : '') + '">' + thumb
            + (opts.play ? '<span class="play-badge">' + (typeof icon === 'function' ? icon('play') : '▶') + '</span>' : '')
            + '</span>'
            + '<span class="card-title">' + esc(opts.title) + '</span>'
            + (opts.meta ? '<span class="card-meta">' + esc(opts.meta) + '</span>' : '');
        if (opts.href) return '<a class="card" href="' + esc(opts.href) + '">' + inner + '</a>';
        return '<button class="card" type="button" ' + (opts.attrs || '') + '>' + inner + '</button>';
    }

    // How long a piece takes to read, from its word count
    function minutes(words) {
        return Math.max(1, Math.round(words / 230)) + ' min read';
    }

    // A book (from data/writing.json): its cover (or its title on a plain
    // one), book-shaped. On the Read page and the home page.
    function bookCard(book) {
        var meta = [book.chapters.length + ' chapter' + (book.chapters.length === 1 ? '' : 's'), prettyDate(book.date)].filter(Boolean).join(' · ');
        return '<a class="card" href="' + esc(book.url) + '"><span class="thumb book">'
            + (book.cover
                ? '<img src="' + esc(book.cover) + '" alt="" loading="lazy">'
                : '<span class="thumb-placeholder">' + esc(book.title) + '</span>')
            + '</span><span class="card-title">' + esc(book.title) + '</span>'
            + '<span class="card-meta">' + esc(meta) + '</span></a>';
    }

    // A script: its title page, in Courier on white paper, the way it prints:
    // the title a third of the way down, then which draft and its date
    function scriptCard(script) {
        var meta = [prettyDate(script.date), minutes(script.words)].filter(Boolean).join(' · ');
        var m = /(\d{4})-(\d{2})-(\d{2})/.exec(script.draft || script.date || '');
        var when = m ? +m[2] + '/' + +m[3] + '/' + m[1].slice(2) : '';   // 2026-10-18 → 10/18/26
        return '<a class="card" href="' + esc(script.url) + '"><span class="thumb script">'
            + '<span class="script-title">' + esc(script.title) + '</span>'
            + '<span class="script-draft"><span class="script-revision">' + esc(script.revision || 'First Draft') + '</span>'
            + (when ? '<br>' + esc(when) : '') + '</span>'
            + '</span><span class="card-title">' + esc(script.title) + '</span>'
            + '<span class="card-meta">' + esc(meta) + '</span></a>';
    }

    // What one piece of each kind is called, above its title in the Read hub
    var READ_KINDS = {
        story: 'Short story', poem: 'Poem', script: 'Script', essay: 'Essay',
        article: 'Article', blog: 'Blog post'
    };

    // Books and scripts, side by side: a shelf of covers and one of title pages
    function readShelves(books, scripts) {
        function shelf(title, cards) {
            return cards.length ? '<section class="shelf-half"><h3>' + title + '</h3>'
                + '<div class="covers">' + cards.join('') + '</div></section>' : '';
        }
        if (!books.length && !scripts.length) return '';
        return '<div class="cover-shelves' + (books.length && scripts.length ? ' two' : '') + '">'
            + shelf('Books', books.map(bookCard)) + shelf('Scripts', scripts.map(scriptCard)) + '</div>';
    }

    // ---- The Read page's All view (and the home page's Read row) ----

    // The newest piece of writing or post, big: what it is, its title, its
    // description, when
    function featured(piece) {
        var meta = [prettyDate(piece.date), minutes(piece.words)].filter(Boolean).join(' · ');
        return '<a class="hub-feature" href="' + esc(piece.url) + '">'
            + '<span class="hub-new">Newest · ' + esc(READ_KINDS[piece.type] || piece.type) + '</span>'
            + '<span class="hub-title">' + esc(piece.title) + '</span>'
            + (piece.description ? '<span class="hub-desc">' + esc(piece.description) + '</span>' : '')
            + '<span class="hub-meta">' + esc(meta) + '</span></a>';
    }

    // The newest comic: its cover beside its name
    function featuredComic(comic) {
        var thumb = thumbOf(comic);
        var meta = comic.series ? comic.series.title + ' · Issue ' + comic.number : prettyDate(comic.date);
        return '<a class="hub-feature hub-cover" href="' + esc('/comic.html?c=' + encodeURIComponent(comic.id)) + '">'
            + (thumb ? '<img src="' + esc(thumb) + '" alt="" loading="lazy">' : '<span></span>')
            + '<span><span class="hub-new">Newest</span>'
            + '<span class="hub-title">' + esc(comic.title) + '</span>'
            + '<span class="hub-meta">' + esc(meta) + '</span></span></a>';
    }

    // The next few, as a list: [href, title, meta] each
    function shortList(items) {
        if (!items.length) return '';
        return '<ul class="hub-list">' + items.map(function (item) {
            return '<li><a href="' + esc(item[0]) + '"><span>' + esc(item[1]) + '</span>'
                + '<span class="hub-meta">' + esc(item[2] || '') + '</span></a></li>';
        }).join('') + '</ul>';
    }

    // One panel: KIND (comics, writing, blog) is the Read page's view its
    // "all" link opens; BASE is '' on the Read page, '/read.html' elsewhere.
    // EXTRA goes at its foot, beside that link.
    function panel(base, kind, title, count, blurb, body, more, extra) {
        return '<section class="hub-panel hub-' + kind + '" aria-label="' + esc(title) + '">'
            + '<div class="hub-head"><h2>' + esc(title) + '</h2><span class="hub-count">' + esc(count) + '</span></div>'
            + '<p class="hub-blurb">' + esc(blurb) + '</p>'
            + body
            + (more || extra ? '<div class="hub-foot">'
               + (more ? '<a class="hub-more" href="' + base + '#' + kind + '">' + esc(more) + ' →</a>' : '')
               + (extra || '') + '</div>' : '')
            + '</section>';
    }

    // Comics, Writing and the Blog side by side, the newest of each big and
    // the next few listed. COMICS is every comic (issues included), CREATIVE
    // the writing that isn't the blog, books or scripts.
    function readHub(comics, creative, blog, base) {
        function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
        function comicHref(c) { return '/comic.html?c=' + encodeURIComponent(c.id); }
        var newestComics = comics.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
        var listed = function (p) { return [p.url, p.title, prettyDate(p.date)]; };
        // The blog's Follow button opens the nav's email/RSS panel (nav.js)
        var follow = '<button class="hub-follow" type="button" data-follow>Follow by email or RSS</button>';
        return '<div class="hub">'
            + panel(base, 'comics', 'Comics', plural(comics.length, 'comic'), 'Stories in pictures.',
                    newestComics.length
                        ? featuredComic(newestComics[0]) + shortList(newestComics.slice(1, 4).map(function (c) {
                            return [comicHref(c), c.title, c.series ? 'Issue ' + c.number : prettyDate(c.date)];
                        }))
                        : '<p class="hub-empty">The first comics are on their way.</p>',
                    comics.length > 1 || base ? 'All comics' : '')
            + panel(base, 'writing', 'Writing', plural(creative.length, 'piece'), 'Short stories, poems and essays.',
                    creative.length
                        ? featured(creative[0]) + shortList(creative.slice(1, 4).map(listed))
                        : '<p class="hub-empty">No stories yet.</p>',
                    creative.length > 1 || base ? 'All writing' : '')
            + panel(base, 'blog', 'Blog', plural(blog.length, 'post'), 'News, notes and recommendations.',
                    blog.length
                        ? featured(blog[0]) + shortList(blog.slice(1, 4).map(listed))
                        : '<p class="hub-empty">No posts yet.</p>',
                    blog.length > 1 || base ? 'All posts' : '', follow)
            + '</div>';
    }

    var lightboxEl = null;
    var lastFocus = null;

    function closeLightbox() {
        if (!lightboxEl) return;
        lightboxEl.classList.remove('open');
        lightboxEl.querySelector('.lightbox-content').innerHTML = ''; // stops the video
        document.body.style.overflow = '';
        if (lastFocus) lastFocus.focus();
    }

    function openLightbox(html) {
        if (!lightboxEl) {
            document.body.insertAdjacentHTML('beforeend',
                '<div class="lightbox" role="dialog" aria-modal="true">'
                + '<button class="lightbox-close" type="button" aria-label="Close">&times;</button>'
                + '<div class="lightbox-body lightbox-content"></div></div>');
            lightboxEl = document.body.lastElementChild;
            lightboxEl.addEventListener('click', function (e) {
                if (e.target === lightboxEl || e.target.classList.contains('lightbox-close')) closeLightbox();
            });
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') closeLightbox();
            });
        }
        lastFocus = document.activeElement;
        lightboxEl.querySelector('.lightbox-content').innerHTML = html;
        lightboxEl.classList.add('open');
        document.body.style.overflow = 'hidden';
        lightboxEl.querySelector('.lightbox-close').focus();
    }

    function toast(message) {
        var el = document.querySelector('.toast');
        if (!el) {
            document.body.insertAdjacentHTML('beforeend', '<div class="toast" role="status"></div>');
            el = document.body.lastElementChild;
        }
        el.textContent = message;
        el.classList.add('show');
        clearTimeout(el.timer);
        el.timer = setTimeout(function () { el.classList.remove('show'); }, 2200);
    }

    function copyLink(url) {
        var done = function () { toast('Link copied'); };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copy this link:', url); });
        } else {
            window.prompt('Copy this link:', url);
        }
    }

    // The view buttons (.view-switch button[data-view=NAME]): show #view-NAME and
    // hide the others. The first button is the default; any other choice is kept
    // in the address (#series, #projects) so it survives back/forward and can be
    // linked to. A link to one of those hashes switches the view too.
    function viewSwitch() {
        var buttons = document.querySelectorAll('.view-switch button');
        if (!buttons.length) return;
        var first = buttons[0].getAttribute('data-view');
        function exists(view) {
            for (var i = 0; i < buttons.length; i++) {
                if (buttons[i].getAttribute('data-view') === view) return true;
            }
            return false;
        }
        function show(view) {
            if (!exists(view)) view = first;
            for (var i = 0; i < buttons.length; i++) {
                var name = buttons[i].getAttribute('data-view');
                buttons[i].setAttribute('aria-pressed', name === view ? 'true' : 'false');
                document.getElementById('view-' + name).hidden = name !== view;
            }
        }
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener('click', function () {
                var view = this.getAttribute('data-view');
                show(view);
                history.replaceState(null, '', view === first ? location.pathname : '#' + view);
            });
        }
        window.addEventListener('hashchange', function () { show(location.hash.slice(1)); });
        show(location.hash.slice(1));
    }

    // One show on the Series view: poster, description and a shelf of episodes.
    // OPTS: href(series), entryHref(entry), unit ("episode"/"issue"), portrait
    function seriesBlock(series, opts) {
        var count = series.entries.length;
        var first = series.entries[0];
        var shelf = count
            ? '<div class="shelf">' + series.entries.map(function (entry) {
                return card({
                    href: opts.entryHref(entry),
                    thumb: thumbOf(entry),
                    title: entry.title,
                    meta: [entry.season, prettyDate(entry.date)].filter(Boolean).join(' · '),
                    portrait: opts.portrait,
                    play: opts.unit === 'episode'
                });
            }).join('') + '</div>'
            : '<p class="empty">First ' + opts.unit + ' coming soon.</p>';
        return '<div class="series-block">'
            + card({ href: opts.href(series), thumb: series.thumb || (first && thumbOf(first)), title: series.title, portrait: true })
            + '<div><h2><a href="' + esc(opts.href(series)) + '">' + esc(series.title) + '</a></h2>'
            + (series.summary ? '<p>' + esc(series.summary) + '</p>' : '')
            + '<p class="card-meta">' + count + ' ' + opts.unit + (count === 1 ? '' : 's') + '</p>'
            + shelf + '</div></div>';
    }

    // The garden graph: each public org-roam note is a dot, each link between two
    // notes a line. Drag to move dots, scroll or pinch to zoom, click to read.
    // The search button in its corner finds a note in the graph.
    // HOLDER is an empty .garden-graph element; it is removed if d3 is missing.
    var graphCount = 0;

    function gardenGraph(holder, garden) {
        if (typeof d3 === 'undefined' || !garden.nodes.length) {
            holder.remove(); // graph library didn't load (or nothing to draw)
            return;
        }
        var width = holder.clientWidth;
        var height = holder.clientHeight;

        // One line per pair of notes, even if they link both ways
        var seen = {};
        var links = [];
        garden.links.forEach(function (l) {
            var key = [l.source, l.target].sort().join('|');
            if (!seen[key]) {
                seen[key] = true;
                links.push({ source: l.source, target: l.target });
            }
        });
        var nodes = garden.nodes.map(function (n) { return { id: n.id, title: n.title, degree: 0 }; });
        var byId = {};
        nodes.forEach(function (n) { byId[n.id] = n; });
        links.forEach(function (l) { byId[l.source].degree++; byId[l.target].degree++; });

        var svg = d3.select(holder).append('svg')
            .attr('viewBox', [-width / 2, -height / 2, width, height])
            .attr('role', 'img')
            .attr('aria-label', 'Graph of ' + nodes.length + ' notes and the links between them');
        var world = svg.append('g');

        var zoom = d3.zoom().scaleExtent([0.3, 4]).on('zoom', function (e) {
            world.attr('transform', e.transform);
        });
        svg.call(zoom);

        var line = world.append('g').selectAll('line').data(links).join('line');
        var node = world.append('g').selectAll('g').data(nodes).join('g').attr('class', 'node');
        node.append('circle').attr('r', function (d) { return 5 + Math.sqrt(d.degree) * 3; });
        node.append('text')
            .attr('x', function (d) { return 9 + Math.sqrt(d.degree) * 3; })
            .attr('y', 4)
            .text(function (d) { return d.title; });
        node.append('title').text(function (d) { return d.title; });

        var simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(70))
            .force('charge', d3.forceManyBody().strength(-260))
            .force('collide', d3.forceCollide(function (d) { return 18 + Math.sqrt(d.degree) * 3; }))
            .force('x', d3.forceX())
            .force('y', d3.forceY())
            .on('tick', function () {
                line.attr('x1', function (d) { return d.source.x; })
                    .attr('y1', function (d) { return d.source.y; })
                    .attr('x2', function (d) { return d.target.x; })
                    .attr('y2', function (d) { return d.target.y; });
                node.attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });
            });

        var moved = false;
        node.call(d3.drag()
            .on('start', function (e, d) {
                moved = false;
                if (!e.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', function (e, d) {
                moved = true;
                d.fx = e.x;
                d.fy = e.y;
            })
            .on('end', function (e, d) {
                if (!e.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }));

        node.on('click', function (e, d) {
            if (!moved) window.location.href = d.id;
        });

        graphSearch(holder, svg, zoom, node, line, nodes, links);
    }

    // The search button in the graph's corner. Typing fades every note that
    // doesn't match; Enter (or clicking a result) flies to the note and lights
    // up its links; Shift+Enter (or Shift+click) opens it.
    function graphSearch(holder, svg, zoom, node, line, nodes, links) {
        var id = 'graph-search-' + (++graphCount);
        holder.insertAdjacentHTML('beforeend',
            '<div class="graph-search">'
            + '<div class="graph-search-box" hidden>'
            + '<input type="text" placeholder="Find a note…" autocomplete="off" spellcheck="false" role="combobox"'
            + ' aria-expanded="true" aria-controls="' + id + '" aria-autocomplete="list" aria-label="Find a note in the graph">'
            + '<ul class="graph-search-results" id="' + id + '" role="listbox"></ul>'
            + '<p class="graph-search-hint"><kbd>↵</kbd> find <kbd>⇧↵</kbd> open <kbd>esc</kbd> close</p>'
            + '</div>'
            + '<button class="graph-search-toggle" type="button" aria-label="Find a note in the graph" title="Find a note" aria-expanded="false">'
            + (typeof icon === 'function' ? icon('search') : '⌕') + '</button>'
            + '</div>');
        var box = holder.querySelector('.graph-search-box');
        var input = box.querySelector('input');
        var list = box.querySelector('ul');
        var toggle = holder.querySelector('.graph-search-toggle');
        var still = window.matchMedia('(prefers-reduced-motion: reduce)');
        var matches = [];
        var chosen = 0;

        // Most-linked notes first when nothing is typed
        var byLinks = nodes.slice().sort(function (a, b) { return b.degree - a.degree || a.title.localeCompare(b.title); });

        function setOpen(open) {
            box.hidden = !open;
            toggle.setAttribute('aria-expanded', open);
            if (open) {
                filter();
                input.focus();
            } else {
                input.value = '';
                svg.classed('searching', false).classed('focused', false);
                node.classed('match', false).classed('found', false).classed('near', false);
                line.classed('found', false);
                toggle.focus();
            }
        }

        function filter() {
            var words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
            matches = !words.length ? byLinks : byLinks.filter(function (n) {
                var title = n.title.toLowerCase();
                return words.every(function (w) { return title.indexOf(w) !== -1; });
            }).sort(function (a, b) {
                // titles that start with what's typed first
                return (b.title.toLowerCase().indexOf(words[0]) === 0) - (a.title.toLowerCase().indexOf(words[0]) === 0);
            });
            chosen = 0;
            svg.classed('focused', false).classed('searching', words.length > 0);
            node.classed('found', false).classed('near', false)
                .classed('match', function (d) { return words.length > 0 && matches.indexOf(d) !== -1; });
            line.classed('found', false);
            list.innerHTML = matches.length ? matches.map(function (n, i) {
                return '<li role="option" id="' + id + '-' + i + '" data-i="' + i + '">'
                    + '<span class="graph-search-title">' + esc(n.title) + '</span>'
                    + '<span class="graph-search-meta">' + n.degree + (n.degree === 1 ? ' link' : ' links') + '</span></li>';
            }).join('') : '<li class="graph-search-none">No note called that</li>';
            pick(0);
        }

        function pick(i) {
            var old = list.querySelector('[aria-selected="true"]');
            if (old) old.setAttribute('aria-selected', 'false');
            chosen = i;
            var el = document.getElementById(id + '-' + i);
            if (el) {
                el.setAttribute('aria-selected', 'true');
                el.scrollIntoView({ block: 'nearest' });
                input.setAttribute('aria-activedescendant', el.id);
            }
        }

        // Center the view on note D and light it and its links up
        function locate(d) {
            var k = Math.max(1.6, d3.zoomTransform(svg.node()).k);
            svg.transition().duration(still.matches ? 0 : 650)
                .call(zoom.transform, d3.zoomIdentity.translate(-d.x * k, -d.y * k).scale(k));
            var near = {};
            links.forEach(function (l) {
                if (l.source === d) near[l.target.id] = true;
                if (l.target === d) near[l.source.id] = true;
            });
            svg.classed('searching', false).classed('focused', true);
            node.classed('match', false)
                .classed('found', function (n) { return n === d; })
                .classed('near', function (n) { return !!near[n.id]; });
            line.classed('found', function (l) { return l.source === d || l.target === d; });
        }

        function use(i, openIt) {
            var d = matches[i];
            if (!d) return;
            if (openIt) window.location.href = d.id;
            else locate(d);
        }

        toggle.addEventListener('click', function () { setOpen(box.hidden); });
        input.addEventListener('input', filter);
        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (matches.length) pick((chosen + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
            } else if (e.key === 'Enter' && !e.isComposing) {
                e.preventDefault();
                use(chosen, e.shiftKey);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
            }
        });
        list.addEventListener('click', function (e) {
            var row = e.target.closest('[data-i]');
            if (!row) return;
            pick(+row.getAttribute('data-i'));
            use(chosen, e.shiftKey);
        });
        list.addEventListener('dblclick', function (e) {
            var row = e.target.closest('[data-i]');
            if (row) use(+row.getAttribute('data-i'), true);
        });
    }

    // A breadcrumb trail at the top of a page: [[href, label], ..., [null, this page]]
    function crumbs(trail) {
        return '<nav class="crumbs" aria-label="Breadcrumb">' + trail.map(function (c) {
            return c[0]
                ? '<a href="' + esc(c[0]) + '">' + esc(c[1]) + '</a>'
                : '<span aria-current="page">' + esc(c[1]) + '</span>';
        }).join('') + '</nav>';
    }

    function failed(el, error) {
        console.error(error);
        el.innerHTML = '<p class="empty">Couldn’t load this section. '
            + '<small>(' + esc(error.message) + ' — if you opened the file directly, run a local server instead.)</small></p>';
    }

    return {
        esc: esc,
        slug: slug,
        resolve: resolve,
        prettyDate: prettyDate,
        param: param,
        parseOrg: parseOrg,
        inline: inline,
        media: media,
        player: player,
        platformButtons: platformButtons,
        thumbOf: thumbOf,
        loadAnimation: loadAnimation,
        loadComics: loadComics,
        loadJSON: loadJSON,
        card: card,
        minutes: minutes,
        bookCard: bookCard,
        scriptCard: scriptCard,
        readShelves: readShelves,
        readHub: readHub,
        openLightbox: openLightbox,
        closeLightbox: closeLightbox,
        toast: toast,
        copyLink: copyLink,
        viewSwitch: viewSwitch,
        seriesBlock: seriesBlock,
        gardenGraph: gardenGraph,
        crumbs: crumbs,
        failed: failed
    };

})();
