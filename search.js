// Search: the button in the nav bar (or Cmd/Ctrl+K, or /) opens a panel in the
// middle of the page that finds anything on the site: the main pages, animation
// series, episodes and videos, comics, writing and garden notes. Each result's
// icon and color say what it is, and the bar at the bottom says what Enter does.
// nav.js loads this file on every page.
//
// The index is built the first time the panel opens, from the same files the
// pages read (content/animation.org, content/comics.org, data/writing.json and
// data/garden.json). The text of every piece of writing and garden note is
// fetched too, so their words are searchable, not just their titles.

(function () {

    // ============ KINDS OF RESULT ============
    // tone: the color (--tone-* in site.css). verb: what Enter does.

    var KINDS = {
        page:        { label: 'Page',            tone: 'page',   filter: 'pages',     icon: 'window', verb: 'Go to' },
        section:     { label: 'Section',         tone: 'page',   filter: 'pages',     icon: 'hash',   verb: 'Jump to' },
        series:      { label: 'Animated series', tone: 'anim',   filter: 'animation', icon: 'stack',  verb: 'Open the series' },
        episode:     { label: 'Episode',         tone: 'anim',   filter: 'animation', icon: 'play',   verb: 'Watch' },
        video:       { label: 'Animation',       tone: 'anim',   filter: 'animation', icon: 'film',   verb: 'Play' },
        comicSeries: { label: 'Comic series',    tone: 'comic',  filter: 'comics',    icon: 'issues', verb: 'Open the series' },
        comic:       { label: 'Comic',           tone: 'comic',  filter: 'comics',    icon: 'panels', verb: 'Read' },
        writing:     { label: 'Writing',         tone: 'story',  filter: 'writing',   icon: 'book',   verb: 'Read' },
        blog:        { label: 'Blog post',       tone: 'blog',   filter: 'writing',   icon: 'pen',    verb: 'Read' },
        note:        { label: 'Garden note',     tone: 'garden', filter: 'garden',    icon: 'sprout', verb: 'Open the note' }
    };

    // The buttons under the search box: [filter, label, tone]
    var FILTERS = [
        ['all', 'All', ''],
        ['pages', 'Pages', 'page'],
        ['animation', 'Animation', 'anim'],
        ['comics', 'Comics', 'comic'],
        ['writing', 'Writing', 'story'],
        ['garden', 'Garden', 'garden']
    ];

    // Each #+type: of writing: [label, icon]
    var WRITING = {
        story: ['Short story', 'book'],
        poem: ['Poem', 'feather'],
        script: ['Script', 'doc'],
        essay: ['Essay', 'doc'],
        article: ['Article', 'doc'],
        book: ['Book', 'book']
    };

    // The main pages: [href, title, description, other words that should find it, icon]
    var PAGES = [
        ['/', 'Home', 'About me, the reel, and how to get in touch', 'jack gilmore about contact email instagram', 'house'],
        ['/animation.html', 'Watch', 'Animation: series, projects and more', 'animation videos gallery', 'window'],
        ['/read.html', 'Read', 'Comics, stories and the blog', 'comics writing stories essays poems', 'window'],
        ['/garden.html', 'Garden', 'Notes in progress, and the graph of how they link', 'notes digital garden graph', 'window'],
        ['/reel.html', 'Demo Reel', 'The reel on its own page, to send to people', 'showreel portfolio share', 'window'],
        ['/everything.html', 'Everything', 'Everything on the site, in one place', 'overview latest dashboard', 'window']
    ];

    // Line icons, drawn on a 16×16 grid
    var SHAPES = {
        search: '<circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3.5 3.5"/>',
        house: '<path d="M2.5 7.2 8 2.8l5.5 4.4v6.3a.5.5 0 0 1-.5.5H9.6v-3.5H6.4V14H3a.5.5 0 0 1-.5-.5z"/>',
        window: '<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M2 5.8h12M4.3 4.15h.01M6.1 4.15h.01"/>',
        hash: '<path d="M6.2 2.5 5 13.5M11 2.5 9.8 13.5M2.8 5.8h10.6M2.4 10.2H13"/>',
        stack: '<rect x="2" y="5" width="9.5" height="8.5" rx="1.2"/><path d="M4.5 2.5h8A1.5 1.5 0 0 1 14 4v7"/><path d="M5.6 7.3v3.9l3.3-1.95z"/>',
        play: '<circle cx="8" cy="8" r="6"/><path d="M6.7 5.6v4.8L10.5 8z"/>',
        film: '<rect x="2.5" y="2" width="11" height="12" rx="1.2"/><path d="M5.3 2v12M10.7 2v12M2.5 5.3h2.8M2.5 8h2.8M2.5 10.7h2.8M10.7 5.3h2.8M10.7 8h2.8M10.7 10.7h2.8"/>',
        issues: '<rect x="2" y="4.5" width="9" height="9.5" rx="1"/><path d="M5 2h7.5a1.5 1.5 0 0 1 1.5 1.5V11"/><path d="M2 9h9M6.5 4.5V9"/>',
        panels: '<rect x="2" y="2" width="12" height="12" rx="1.2"/><path d="M2 7.3h12M7.2 2v5.3M9.6 7.3V14"/>',
        book: '<path d="M8 4.3C6.6 3.2 4.6 2.8 2 3v9.6c2.6-.2 4.6.2 6 1.2 1.4-1 3.4-1.4 6-1.2V3c-2.6-.2-4.6.2-6 1.3z"/><path d="M8 4.3v9.5"/>',
        feather: '<path d="M13.5 2.5c-5.2.4-8.6 3.8-9.2 9.2L2.5 13.5"/><path d="M5 9.5h4.2c2.3-1.4 3.8-3.8 4.3-7"/>',
        doc: '<path d="M4 1.8h5.4l3 3.1v9.3H4z"/><path d="M9.2 1.8v3.3h3.2M6 8.3h4.3M6 10.8h4.3"/>',
        pen: '<path d="m2.8 13.2.7-3 7.4-7.4a1.4 1.4 0 0 1 2 2l-7.4 7.4z"/><path d="m9.7 4 2.3 2.3M8.5 13.2h4.7"/>',
        sprout: '<path d="M8 14V7.6"/><path d="M8 8.6C8 5.6 6.1 4 3 4c0 3 1.9 4.6 5 4.6z"/><path d="M8 7.2c0-2.7 1.8-4.4 5-4.4 0 3-1.8 4.7-5 4.4z"/>'
    };

    function svg(name) {
        return '<svg viewBox="0 0 16 16" aria-hidden="true">' + SHAPES[name] + '</svg>';
    }

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }


    // ============ THE INDEX ============

    var index = null;       // every result, once loaded
    var loading = null;     // the promise that loads it
    var loadError = null;

    // catalog.js has the Org reader. The generated writing and garden pages
    // don't load it, so fetch it the first time it's needed.
    function needSite() {
        if (window.Site) return Promise.resolve();
        return new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = '/catalog.js';
            script.onload = resolve;
            script.onerror = function () { reject(new Error('Could not load /catalog.js')); };
            document.head.appendChild(script);
        });
    }

    function load() {
        if (loading) return loading;
        loading = needSite()
            .then(function () {
                return Promise.all([
                    Site.loadAnimation().catch(function (e) { console.error(e); return null; }),
                    Site.loadComics().catch(function (e) { console.error(e); return null; }),
                    Site.loadJSON('/data/writing.json', []),
                    Site.loadJSON('/data/garden.json', { nodes: [], links: [] })
                ]);
            })
            .then(function (all) {
                index = build(all[0], all[1], all[2] || [], all[3] || { nodes: [], links: [] });
                render();
                return loadText(index);
            })
            .then(function () {
                if (query().length) render();   // new matches in the text
            })
            .catch(function (error) {
                console.error(error);
                loadError = error;
                render();
            });
        return loading;
    }

    // Everything on the site, in the order it's listed when nothing is typed
    function build(animation, comics, writing, garden) {
        var items = [];
        function add(item) {
            var kind = KINDS[item.kind];
            item.label = item.label || kind.label;
            item.icon = item.icon || kind.icon;
            item.text = item.text || '';
            item.f = {
                title: fold(item.title),
                words: fold([item.words, item.meta, item.label].join(' ')).s,
                text: fold(item.text)
            };
            items.push(item);
        }

        // ---- Pages, and the sections inside them ----
        PAGES.forEach(function (p) {
            add({ kind: 'page', href: p[0], title: p[1], meta: p[2], words: p[3], icon: p[4], boost: 3 });
        });
        if (animation && animation.series.length) {
            add({ kind: 'section', href: '/animation.html#series', title: 'Series', meta: 'On the Watch page', words: 'shows animation', boost: 2 });
        }
        if (animation) animation.groups.forEach(function (g) {
            add({ kind: 'section', href: '/animation.html#' + g.slug, title: g.title, meta: 'On the Watch page · ' + plural(g.items.length, 'video'), words: 'animation', boost: 2 });
        });
        add({ kind: 'section', href: '/read.html#comics', title: 'Comics', meta: 'On the Read page', words: 'comic series', boost: 2 });
        add({ kind: 'section', href: '/read.html#writing', title: 'Writing', meta: 'On the Read page · stories, poems, essays', words: 'stories poems essays', boost: 2 });
        add({ kind: 'section', href: '/read.html#blog', title: 'Blog', meta: 'On the Read page', words: 'posts', boost: 2 });

        // ---- Animation ----
        if (animation) {
            animation.series.forEach(function (s) {
                var href = '/series.html?s=' + s.slug;
                add({ kind: 'series', href: href, title: s.title, meta: plural(s.entries.length, 'episode'), text: s.summary, words: 'show', boost: 2 });
                s.entries.forEach(function (ep) {
                    add({
                        kind: 'episode',
                        href: href + '&e=' + ep.slug,
                        title: ep.title,
                        meta: [s.title, (ep.season ? ep.season + ', ' : '') + 'Episode ' + ep.number, Site.prettyDate(ep.date)].filter(Boolean).join(' · '),
                        text: ep.summary,
                        words: s.title + ' ' + ep.season,
                        date: ep.date
                    });
                });
            });
            animation.gallery.forEach(function (v) {
                add({
                    kind: 'video',
                    // animation.js plays ?play= in the lightbox; the hash shows its group
                    href: '/animation.html?play=' + encodeURIComponent(v.id) + '#' + v.id.split('/')[0],
                    title: v.title,
                    meta: [v.collection, Site.prettyDate(v.date)].filter(Boolean).join(' · '),
                    text: v.summary,
                    date: v.date
                });
            });
        }

        // ---- Comics ----
        if (comics) {
            var comicHref = function (c) { return '/comic.html?c=' + encodeURIComponent(c.id); };
            comics.series.forEach(function (s) {
                add({
                    kind: 'comicSeries',
                    href: '/comic-series.html?s=' + s.slug,
                    title: s.title,
                    meta: plural(s.entries.length, 'issue'),
                    text: s.summary,
                    boost: 2
                });
                s.entries.forEach(function (c) {
                    add({
                        kind: 'comic',
                        href: comicHref(c),
                        title: c.title,
                        meta: [s.title, 'Issue ' + c.number, Site.prettyDate(c.date)].filter(Boolean).join(' · '),
                        text: c.summary,
                        words: s.title,
                        date: c.date
                    });
                });
            });
            comics.gallery.forEach(function (c) {
                add({
                    kind: 'comic',
                    href: comicHref(c),
                    title: c.title,
                    meta: [c.collection, Site.prettyDate(c.date)].filter(Boolean).join(' · '),
                    text: c.summary,
                    date: c.date
                });
            });
        }

        // ---- Writing (newest first, as in data/writing.json) ----
        writing.forEach(function (w) {
            var type = WRITING[w.type] || [w.type.charAt(0).toUpperCase() + w.type.slice(1), 'doc'];
            var blog = w.type === 'blog';
            add({
                kind: blog ? 'blog' : 'writing',
                href: w.url,
                title: w.title,
                label: blog ? null : type[0],
                icon: blog ? null : type[1],
                meta: [w.publication, Site.prettyDate(w.date), Math.max(1, Math.round(w.words / 230)) + ' min read'].filter(Boolean).join(' · '),
                text: w.description,
                date: w.date,
                fetchText: true
            });
        });

        // ---- Garden (most recently tended first) ----
        var linkCount = {};
        garden.links.forEach(function (l) {
            linkCount[l.source] = (linkCount[l.source] || 0) + 1;
            linkCount[l.target] = (linkCount[l.target] || 0) + 1;
        });
        garden.nodes.slice()
            .sort(function (a, b) { return (b.modified || '').localeCompare(a.modified || ''); })
            .forEach(function (n) {
                add({
                    kind: 'note',
                    href: n.id,
                    title: n.title,
                    meta: n.tags.concat(n.modified ? ['updated ' + Site.prettyDate(n.modified)] : [],
                                        linkCount[n.id] ? [plural(linkCount[n.id], 'link')] : []).join(' · '),
                    words: n.tags.join(' '),
                    fetchText: true
                });
            });

        return items;
    }

    // The words of each piece of writing and garden note, from its page
    function loadText(items) {
        return Promise.all(items.filter(function (item) { return item.fetchText; }).map(function (item) {
            return fetch(item.href)
                .then(function (res) { return res.ok ? res.text() : ''; })
                .then(function (html) {
                    var prose = new DOMParser().parseFromString(html, 'text/html').querySelector('.prose');
                    if (!prose) return;
                    var head = prose.querySelector('.prose-head');
                    if (head) head.remove();
                    item.f.body = fold(prose.textContent.replace(/\s+/g, ' ').trim());
                })
                .catch(function () { });
        }));
    }


    // ============ MATCHING ============

    // TEXT in lowercase without accents, plus where each of its letters came
    // from, so a match can be highlighted in the original
    function fold(text) {
        text = String(text || '');
        var s = '';
        var map = [];
        for (var i = 0; i < text.length; i++) {
            var c = text[i].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
            for (var j = 0; j < c.length; j++) {
                s += c[j];
                map.push(i);
            }
        }
        return { s: s, map: map, raw: text };
    }

    // How well TOKEN matches a title: the start of a word beats the middle of
    // one, which beats the letters in order but spread out ("htgy" → "Hat Guy")
    function inTitle(token, title) {
        var first = title.indexOf(token);
        var at = first;
        while (at > 0 && /[a-z0-9]/.test(title[at - 1])) at = title.indexOf(token, at + 1);
        if (at !== -1) return { score: 30, ranges: [[at, at + token.length]] };
        if (first !== -1) return { score: 20, ranges: [[first, first + token.length]] };
        if (token.length < 4) return null;

        var spots = [];
        var from = 0;
        for (var i = 0; i < token.length; i++) {
            var p = title.indexOf(token[i], from);
            if (p === -1) return null;
            spots.push(p);
            from = p + 1;
        }
        var span = spots[spots.length - 1] - spots[0] + 1;
        if (span > token.length * 2) return null;
        return {
            score: 2 + 10 * token.length / span,
            ranges: spots.map(function (p) { return [p, p + 1]; })
        };
    }

    // Every result that has every word typed, best first, as { item, ranges, snippet }
    function search(tokens) {
        var whole = tokens.join(' ');
        var found = [];
        index.forEach(function (item, order) {
            var f = item.f;
            var score = 0;
            var ranges = [];
            var elsewhere = null;   // the text to quote, for a word not in the title
            for (var i = 0; i < tokens.length; i++) {
                var token = tokens[i];
                var title = inTitle(token, f.title.s);
                if (title) {
                    score += title.score;
                    ranges = ranges.concat(title.ranges);
                } else if (f.words.indexOf(token) !== -1) {
                    score += 4;
                } else if (f.text.s.indexOf(token) !== -1) {
                    score += 3;
                    elsewhere = elsewhere || f.text;
                } else if (f.body && f.body.s.indexOf(token) !== -1) {
                    score += 1.5;
                    elsewhere = elsewhere || f.body;
                } else {
                    return;
                }
            }
            if (f.title.s === whole) score += 40;
            else if (f.title.s.indexOf(whole) === 0) score += 20;
            score += item.boost || 0;
            found.push({
                item: item,
                score: score,
                order: order,
                ranges: ranges,
                snippet: elsewhere ? snippet(elsewhere, tokens) : ''
            });
        });
        return found.sort(function (a, b) { return b.score - a.score || a.order - b.order; });
    }

    // A line of FOLDED text around the first word typed, highlighted
    function snippet(folded, tokens) {
        var at = -1;
        tokens.some(function (token) { return (at = folded.s.indexOf(token)) !== -1; });
        if (at === -1) return '';
        var raw = folded.raw;
        var middle = folded.map[at];
        var start = Math.max(0, middle - 40);
        if (start > 0) {
            var space = raw.indexOf(' ', start);
            if (space !== -1 && space < middle) start = space + 1;
        }
        var end = Math.min(raw.length, middle + 120);
        return (start > 0 ? '…' : '') + highlight(raw.slice(start, end), tokens) + (end < raw.length ? '…' : '');
    }

    // TEXT as HTML with <mark> around RANGES (in folded positions), or around
    // every place a token appears
    function highlight(text, tokens, ranges) {
        var f = fold(text);
        if (!ranges) {
            ranges = [];
            tokens.forEach(function (token) {
                for (var at = f.s.indexOf(token); at !== -1; at = f.s.indexOf(token, at + token.length)) {
                    ranges.push([at, at + token.length]);
                }
            });
        }
        var marked = [];
        ranges.forEach(function (r) {
            for (var k = r[0]; k < r[1]; k++) marked[f.map[k]] = true;
        });
        var html = '';
        var open = false;
        for (var i = 0; i < text.length; i++) {
            if (!!marked[i] !== open) {
                html += open ? '</mark>' : '<mark>';
                open = !open;
            }
            html += esc(text[i]);
        }
        return html + (open ? '</mark>' : '');
    }


    // ============ THE PANEL ============

    var LIMIT = 50;
    var backdrop, input, filtersBox, list, footer, opener;
    var filter = 'all';
    var shown = [];         // the results on screen
    var selected = 0;

    function query() {
        return input ? fold(input.value).s.split(/\s+/).filter(Boolean) : [];
    }

    function make() {
        var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
        document.body.insertAdjacentHTML('beforeend',
            '<div class="search-backdrop" hidden>'
            + '<div class="search-panel" role="dialog" aria-modal="true" aria-label="Search the site">'
            + '<div class="search-field">' + svg('search')
            + '<input type="text" placeholder="Search animation, comics, writing, notes…" autocomplete="off" spellcheck="false"'
            + ' role="combobox" aria-expanded="true" aria-controls="search-results" aria-autocomplete="list" aria-label="Search">'
            + '<kbd class="search-esc">esc</kbd></div>'
            + '<div class="search-filters" role="group" aria-label="Show only"></div>'
            + '<ul class="search-results" id="search-results" role="listbox" aria-label="Results"></ul>'
            + '<div class="search-footer"><span class="search-action"></span>'
            + '<span class="search-keys"><kbd>↑</kbd><kbd>↓</kbd> move <kbd>tab</kbd> filter '
            + '<kbd>' + (isMac ? '⌘' : 'ctrl') + '</kbd><kbd>↵</kbd> new tab</span></div>'
            + '</div></div>');
        backdrop = document.body.lastElementChild;
        input = backdrop.querySelector('input');
        filtersBox = backdrop.querySelector('.search-filters');
        list = backdrop.querySelector('.search-results');
        footer = backdrop.querySelector('.search-action');

        input.addEventListener('input', function () {
            selected = 0;
            render();
        });
        input.addEventListener('keydown', function (e) {
            var key = e.key;
            if (e.ctrlKey && (key === 'n' || key === 'j')) key = 'ArrowDown';
            if (e.ctrlKey && (key === 'p' || key === 'k')) key = 'ArrowUp';
            if (key === 'ArrowDown' || key === 'ArrowUp') {
                e.preventDefault();
                if (shown.length) select((selected + (key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length);
            } else if (key === 'Enter' && !e.isComposing) {
                e.preventDefault();
                go(selected, e.metaKey || e.ctrlKey);
            }
        });
        // Tab changes the filter (and keeps the keyboard inside the panel); Esc closes
        backdrop.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
            } else if (e.key === 'Tab') {
                e.preventDefault();
                var names = [].map.call(filtersBox.querySelectorAll('[data-filter]:not([disabled])'), function (b) {
                    return b.getAttribute('data-filter');
                });
                if (names.length) {
                    var i = names.indexOf(filter);
                    setFilter(names[(i + (e.shiftKey ? -1 : 1) + names.length) % names.length]);
                }
            }
        });
        backdrop.addEventListener('click', function (e) {
            if (e.target === backdrop) close();
        });
        filtersBox.addEventListener('click', function (e) {
            var button = e.target.closest('[data-filter]');
            if (button) setFilter(button.getAttribute('data-filter'));
        });
        // Hovering picks a result (mousemove, so scrolling with the keys doesn't)
        list.addEventListener('mousemove', function (e) {
            var row = e.target.closest('[data-i]');
            if (row && +row.getAttribute('data-i') !== selected) select(+row.getAttribute('data-i'));
        });
        list.addEventListener('click', function (e) {
            var row = e.target.closest('[data-i]');
            if (!row || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // new tab: the browser's
            e.preventDefault();
            go(+row.getAttribute('data-i'), false);
        });
    }

    function setFilter(name) {
        filter = name;
        selected = 0;
        render();
        input.focus();
    }

    function render() {
        if (!backdrop) return;
        var tokens = query();

        if (!index) {
            filtersBox.innerHTML = '';
            list.innerHTML = '<li class="search-empty">' + (loadError
                ? 'Search couldn’t load. <small>(' + esc(loadError.message) + ')</small>'
                : 'Loading…') + '</li>';
            shown = [];
            showAction();
            return;
        }

        var found = tokens.length ? search(tokens) : null;
        var pool = found || index.map(function (item) { return { item: item }; });
        function inFilter(name) {
            return function (r) { return name === 'all' || KINDS[r.item.kind].filter === name; };
        }

        // Nothing typed: the pages and series to start from, or all of one filter
        shown = found
            ? found.filter(inFilter(filter))
            : filter === 'all'
                ? pool.filter(function (r) { return /^(page|section|series|comicSeries)$/.test(r.item.kind); })
                : pool.filter(inFilter(filter));
        var more = shown.length - LIMIT;
        shown = shown.slice(0, LIMIT);
        if (selected >= shown.length) selected = 0;

        filtersBox.innerHTML = FILTERS.map(function (f) {
            var count = f[0] === 'all' ? pool.length : pool.filter(inFilter(f[0])).length;
            return '<button type="button" data-filter="' + f[0] + '"' + (f[2] ? ' data-tone="' + f[2] + '"' : '')
                + ' aria-pressed="' + (f[0] === filter) + '"' + (count || f[0] === filter ? '' : ' disabled') + '>'
                + f[1] + ' <span class="count">' + count + '</span></button>';
        }).join('');

        if (!shown.length) {
            list.innerHTML = '<li class="search-empty">' + (found
                ? 'Nothing matches “' + esc(input.value.trim()) + '”'
                  + (filter !== 'all' && found.length ? ' here. <button type="button" class="search-all">Search everything</button>' : '.')
                : 'Nothing here yet.') + '</li>';
            var all = list.querySelector('.search-all');
            if (all) all.addEventListener('click', function () { setFilter('all'); });
        } else {
            list.innerHTML = shown.map(row).join('')
                + (more > 0 ? '<li class="search-empty search-more">' + more + ' more: keep typing to narrow it down</li>' : '');
        }
        select(selected);
    }

    function row(r, i) {
        var item = r.item;
        return '<li role="presentation"><a class="search-result" role="option" id="search-option-' + i + '"'
            + ' href="' + esc(item.href) + '" data-i="' + i + '" data-tone="' + KINDS[item.kind].tone + '" tabindex="-1">'
            + '<span class="search-icon">' + svg(item.icon) + '</span>'
            + '<span class="search-text">'
            + '<span class="search-title">' + (r.ranges ? highlight(item.title, null, r.ranges) : esc(item.title)) + '</span>'
            + (item.meta ? '<span class="search-meta">' + esc(item.meta) + '</span>' : '')
            + (r.snippet ? '<span class="search-snippet">' + r.snippet + '</span>' : '')
            + '</span>'
            + '<span class="search-kind">' + esc(item.label) + '<kbd aria-hidden="true">↵</kbd></span>'
            + '</a></li>';
    }

    function select(i) {
        var old = list.querySelector('[aria-selected="true"]');
        if (old) old.setAttribute('aria-selected', 'false');
        selected = i;
        var el = document.getElementById('search-option-' + i);
        if (el) {
            el.setAttribute('aria-selected', 'true');
            el.scrollIntoView({ block: 'nearest' });
            input.setAttribute('aria-activedescendant', el.id);
        } else {
            input.removeAttribute('aria-activedescendant');
        }
        showAction();
    }

    // What Enter will do, at the bottom of the panel
    function showAction() {
        var r = shown[selected];
        if (!r) {
            footer.innerHTML = '';
            return;
        }
        var kind = KINDS[r.item.kind];
        footer.setAttribute('data-tone', kind.tone);
        footer.innerHTML = '<kbd>↵</kbd> ' + kind.verb + ' <strong>' + esc(r.item.title) + '</strong>';
    }

    function go(i, newTab) {
        var r = shown[i];
        if (!r) return;
        if (newTab) {
            window.open(r.item.href, '_blank', 'noopener');
            return;
        }
        close(true);
        window.location.href = r.item.href;
    }

    function open() {
        if (!backdrop) make();
        if (!backdrop.hidden) return;
        opener = document.activeElement;
        backdrop.hidden = false;
        backdrop.offsetWidth;   // so the fade-in runs
        backdrop.classList.add('open');
        document.body.style.overflow = 'hidden';
        input.focus();
        input.select();         // the last search stays, ready to replace
        render();
        load();
    }

    function close(leaving) {
        if (!backdrop || backdrop.hidden) return;
        backdrop.classList.remove('open');
        backdrop.hidden = true;
        document.body.style.overflow = '';
        if (!leaving && opener && opener.focus) opener.focus();
    }


    // ============ OPENING IT ============

    var button = document.querySelector('.nav-search');
    if (button) {
        button.addEventListener('click', open);
        // Start loading as soon as it looks like it'll be used
        button.addEventListener('pointerenter', load, { once: true });
    }

    document.addEventListener('keydown', function (e) {
        var typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]');
        if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (backdrop && !backdrop.hidden) close();
            else open();
        } else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            open();
        }
    });

})();
