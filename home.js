// The home page: everything on the site in one place. The big search box,
// a link to each part of the site (with how much is in it), the reel beside
// the newest thing in each part, then animation, comics and writing (the Read
// page's panels, from catalog.js) and the garden graph.
// The page about me, to send people, is /about.html (reel.js).

(function () {

    function el(id) { return document.getElementById(id); }
    function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
    function episodeHref(ep) { return '/series.html?s=' + ep.series.slug + '&e=' + ep.slug; }
    function comicHref(c) { return '/comic.html?c=' + encodeURIComponent(c.id); }


    // ============ THE BIG SEARCH BOX ============
    // It hands over to the site search (search.js, which nav.js loads): a
    // click opens the panel, and typing opens it with what's been typed so
    // far, so the rest goes straight into the panel's own box.

    var searchBox = document.querySelector('.home-search input');

    function openSearch(text, tries) {
        if (!window.Search) {
            // search.js is still loading: try again in a moment
            if ((tries || 0) < 40) setTimeout(function () { openSearch(text, (tries || 0) + 1); }, 50);
            return;
        }
        searchBox.value = '';
        Search.open(text);
    }

    searchBox.addEventListener('input', function () {
        if (searchBox.value.trim()) openSearch(searchBox.value);
    });
    searchBox.addEventListener('click', function () { openSearch(searchBox.value); });
    searchBox.form.addEventListener('submit', function (e) {
        e.preventDefault();
        openSearch(searchBox.value);
    });
    // Start loading the index as soon as it looks like it'll be used
    searchBox.addEventListener('focus', function () { if (window.Search) Search.load(); }, { once: true });


    // ============ THE REST ============

    // Load everything; one part failing shouldn't blank the rest
    Promise.all([
        Site.loadAnimation().catch(function (e) { console.error(e); return null; }),
        Site.loadComics().catch(function (e) { console.error(e); return null; }),
        Site.loadJSON('/data/writing.json', []),
        Site.loadJSON('/data/garden.json', { nodes: [], links: [] })
    ]).then(function (all) {
        var animation = all[0] || { reel: null, series: [], groups: [], gallery: [] };
        var comicData = all[1] || { series: [], gallery: [] };
        var writing = all[2] || [];
        var garden = all[3] || { nodes: [], links: [] };

        // Every episode with a video, in order; every comic with pages
        var episodes = [];
        animation.series.forEach(function (s) {
            episodes = episodes.concat(s.entries.filter(function (ep) { return ep.video; }));
        });
        var comics = comicData.gallery.slice();
        comicData.series.forEach(function (s) {
            s.entries.forEach(function (issue) { if (issue.images.length) comics.push(issue); });
        });
        var books = writing.filter(function (p) { return p.type === 'book'; });
        var scripts = writing.filter(function (p) { return p.type === 'script'; });
        var creative = writing.filter(function (p) { return ['blog', 'book', 'script'].indexOf(p.type) === -1; });
        var blog = writing.filter(function (p) { return p.type === 'blog'; });
        // Most recently tended first
        var notes = garden.nodes.slice().sort(function (a, b) { return (b.modified || '').localeCompare(a.modified || ''); });

        // ---- A link to each part, in its search color ----
        // [href, label, how many, tone (--tone-* in site.css)]
        var parts = [
            ['/animation.html', 'Animation', plural(animation.gallery.length + episodes.length, 'video'), 'anim'],
            ['/read.html#comics', 'Comics', plural(comics.length, 'comic'), 'comic'],
            ['/read.html#writing', 'Writing', plural(creative.length + books.length + scripts.length, 'piece'), 'story'],
            ['/read.html#blog', 'Blog', plural(blog.length, 'post'), 'blog'],
            ['/garden.html', 'Garden', plural(garden.nodes.length, 'note'), 'garden']
        ];
        el('home-jump').innerHTML = parts.map(function (p) {
            return '<a href="' + p[0] + '" data-tone="' + p[3] + '"><span class="tone-dot"></span>'
                + p[1] + ' <span class="home-jump-count">' + Site.esc(p[2]) + '</span></a>';
        }).join('');

        // ---- The reel ----
        el('home-reel').innerHTML = animation.reel
            ? Site.player(animation.reel.video, false, animation.reel.title)
            : '<p class="empty">No reel yet: add #+reel: to content/animation.org</p>';
        if (animation.reel) el('home-reel-share').innerHTML = shareButton('/reel.html', 'Jack Gilmore — Demo Reel');

        // ---- The newest of each: [tone, what, title, meta, href, date] ----
        var latest = [];
        var ep = episodes[episodes.length - 1];
        if (ep) latest.push(['anim', 'New episode', ep.title, ep.series.title + ' · Episode ' + ep.number, episodeHref(ep), ep.date]);
        var comic = comics.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); })[0];
        if (comic) latest.push(['comic', 'Comic', comic.title,
            comic.series ? comic.series.title + ' · Issue ' + comic.number : Site.prettyDate(comic.date), comicHref(comic), comic.date]);
        var piece = creative.concat(books, scripts).sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); })[0];
        if (piece) latest.push(['story', piece.type.charAt(0).toUpperCase() + piece.type.slice(1), piece.title,
            [Site.prettyDate(piece.date), piece.words && Site.minutes(piece.words)].filter(Boolean).join(' · '), piece.url, piece.date]);
        var post = blog[0];
        if (post) latest.push(['blog', 'Blog post', post.title,
            [Site.prettyDate(post.date), Site.minutes(post.words)].filter(Boolean).join(' · '), post.url, post.date]);
        var note = notes[0];
        if (note) latest.push(['garden', 'Garden note', note.title,
            note.modified ? 'Tended ' + Site.prettyDate(note.modified.slice(0, 10)) : '', note.id]);
        // The newest of these gets a "new!" tag, so a fresh post is the first
        // thing seen. Only dated things compete (SPC n w e dates videos; older
        // episodes have no :DATE:), and garden notes don't: their date is
        // when they were last tended, not when they went up. On a tie the
        // first in the list wins.
        var newest = latest.reduce(function (best, l) {
            return l[0] !== 'garden' && l[5] && (!best || l[5] > best[5]) ? l : best;
        }, null);
        el('home-new').innerHTML = latest.length
            ? '<ul class="home-new">' + latest.map(function (l) {
                var isNew = l === newest;
                return '<li' + (isNew ? ' class="is-new"' : '') + '><a href="' + Site.esc(l[4]) + '" data-tone="' + l[0] + '">'
                    + '<span class="home-new-kind">' + Site.esc(l[1])
                    + (isNew ? ' <span class="new-tag"><svg viewBox="0 0 16 16" aria-hidden="true">'
                        + '<path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z"/></svg>new!</span>' : '')
                    + '</span>'
                    + '<span class="home-new-title">' + Site.esc(l[2]) + '</span>'
                    + (l[3] ? '<span class="home-new-meta">' + Site.esc(l[3]) + '</span>' : '')
                    + '</a></li>';
            }).join('') + '</ul>'
            : '<p class="empty">Nothing here yet.</p>';

        // ---- Animation: the newest episodes of each series, then each group's first few ----
        var rows = animation.series.map(function (s) {
            var newest = s.entries.filter(function (e) { return e.video; }).reverse().slice(0, 4);
            return [s.title, 'newest episodes', '/series.html?s=' + s.slug, newest.map(function (e) {
                return Site.card({ href: episodeHref(e), thumb: Site.thumbOf(e), title: e.title, meta: 'Episode ' + e.number, play: true });
            })];
        }).concat(animation.groups.map(function (g) {
            return [g.title, plural(g.items.length, 'video'), '/animation.html#' + g.slug, g.items.slice(0, 4).map(function (v) {
                return Site.card({
                    href: '/animation.html?play=' + encodeURIComponent(v.id) + '#' + g.slug,
                    thumb: Site.thumbOf(v),
                    title: v.title,
                    meta: Site.prettyDate(v.date) || g.title,
                    play: true
                });
            })];
        })).filter(function (r) { return r[3].length; });
        el('home-animation').innerHTML = rows.length
            ? rows.map(function (r) {
                return '<div class="home-row"><h3><a href="' + Site.esc(r[2]) + '">' + Site.esc(r[0]) + '</a>'
                    + ' <span>' + Site.esc(r[1]) + '</span></h3>'
                    + '<div class="grid home-grid">' + r[3].join('') + '</div></div>';
            }).join('')
            : '<p class="empty">No videos yet.</p>';

        // ---- Comics and writing: books and scripts, then the Read page's panels ----
        el('home-read').innerHTML = Site.readShelves(books, scripts) + Site.readHub(comics, creative, blog, '/read.html');

        // ---- Garden: the graph (catalog.js), then every note ----
        var box = el('home-garden');
        if (!garden.nodes.length) {
            box.innerHTML = '<p class="empty">No public notes yet. Tag an org-roam note with <code>publish</code> to grow the garden.</p>';
        } else {
            box.innerHTML = '<div class="garden-graph home-graph"></div><div class="note-list">' + notes.map(function (n) {
                return '<a href="' + Site.esc(n.id) + '">' + Site.esc(n.title) + '</a>';
            }).join('') + '</div>';
            Site.lightFromList(box.querySelector('.note-list'),
                Site.gardenGraph(box.querySelector('.garden-graph'), garden));
        }
    });

})();
