// The Read page: comics, creative writing and the blog, in views chosen by
// buttons (like the Watch page):
//   All      books and scripts (their covers and title pages), then a panel
//            each for comics, writing and the blog, side by side: the newest
//            one big, the next few listed
//   Comics   each comic series, then every comic
//   Writing  books and scripts, then the rest of the writing, grouped by kind
//   Blog     every post
// Comics come from content/comics.org. The writing list is data/writing.json,
// which Emacs writes when it publishes (publish.el, SPC n w p) from the Org
// files in content/writing/.

(function () {

    var switcher = document.getElementById('view-switch');
    var views = document.getElementById('views');

    // Creative writing, in this order. Any other #+type: is listed after these.
    var KINDS = [
        ['story', 'Short stories'],
        ['poem', 'Poems'],
        ['essay', 'Essays'],
        ['article', 'Articles']
    ];

    function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
    function comicHref(comic) { return '/comic.html?c=' + encodeURIComponent(comic.id); }
    function seriesHref(series) { return '/comic-series.html?s=' + series.slug; }

    function entry(piece) {
        var meta = [piece.publication, Site.prettyDate(piece.date), Site.minutes(piece.words)].filter(Boolean).join(' · ');
        return '<a class="entry" href="' + Site.esc(piece.url) + '">'
            + '<span class="entry-title">' + Site.esc(piece.title)
            + (piece.description ? '<span class="entry-desc">' + Site.esc(piece.description) + '</span>' : '')
            + '</span>'
            + '<span class="entry-meta">' + Site.esc(meta) + '</span></a>';
    }

    function group(title, pieces) {
        return '<div class="writing-group">' + (title ? '<h3>' + Site.esc(title) + '</h3>' : '')
            + pieces.map(entry).join('') + '</div>';
    }

    function comicCard(comic) {
        return Site.card({
            href: comicHref(comic),
            thumb: Site.thumbOf(comic),
            title: comic.title,
            meta: comic.series ? comic.series.title + ' · Issue ' + comic.number : Site.prettyDate(comic.date),
            portrait: true
        });
    }

    Promise.all([
        Site.loadComics().catch(function (e) { console.error(e); return null; }),
        Site.loadJSON('/data/writing.json', null)
    ]).then(function (all) {
        var comicData = all[0] || { series: [], gallery: [] };
        var pieces = all[1];
        var missing = '<p class="empty">Couldn’t load the writing list (data/writing.json). Publish from Emacs to make it.</p>';

        // Every standalone comic, plus every issue of every series
        var comics = comicData.gallery.slice();
        comicData.series.forEach(function (series) {
            series.entries.forEach(function (issue) {
                if (issue.images.length) comics.push(issue);
            });
        });
        var books = (pieces || []).filter(function (p) { return p.type === 'book'; });
        var scripts = (pieces || []).filter(function (p) { return p.type === 'script'; });
        var creative = (pieces || []).filter(function (p) { return ['blog', 'book', 'script'].indexOf(p.type) === -1; });
        var blog = (pieces || []).filter(function (p) { return p.type === 'blog'; });

        // ---- All ----
        var hub = Site.readHub(comics, creative, blog, '');
        var allView = Site.readShelves(books, scripts) + (pieces || all[0] ? hub : missing);

        // ---- Comics ----
        var comicsView = comicData.series.map(function (series) {
            return Site.seriesBlock(series, { unit: 'issue', portrait: true, href: seriesHref, entryHref: comicHref });
        }).join('') + (comics.length
            ? (comicData.series.length ? '<h3 class="subsection">Every comic</h3>' : '')
              + '<div class="grid grid-portrait">' + comics.map(comicCard).join('') + '</div>'
            : '<p class="empty">The first comics are on their way.</p>');
        if (!all[0]) comicsView = '<p class="empty">Couldn’t load the comics (content/comics.org).</p>';

        // ---- Writing ----
        var writingView;
        if (!pieces) {
            writingView = missing;
        } else if (!creative.length && !books.length && !scripts.length) {
            writingView = '<p class="empty">No stories yet. In the meantime, there’s <a href="#blog">the blog</a>.</p>';
        } else {
            var known = KINDS.map(function (k) { return k[0]; });
            var others = [];
            creative.forEach(function (p) {
                if (known.indexOf(p.type) === -1 && others.indexOf(p.type) === -1) others.push(p.type);
            });
            writingView = Site.readShelves(books, scripts)
                + '<div class="reading-list">' + KINDS.concat(others.map(function (t) {
                return [t, t.charAt(0).toUpperCase() + t.slice(1) + 's'];
            })).map(function (kind) {
                var these = creative.filter(function (p) { return p.type === kind[0]; });
                return these.length ? group(kind[1], these) : '';
            }).join('') + '</div>';
        }

        // ---- Blog ----
        var blogView = !pieces ? missing
            : blog.length ? '<div class="reading-list">' + group('', blog) + '</div>'
            : '<p class="empty">No posts yet.</p>';

        // The views, and a button for each: [name, label, html]
        var list = [
            ['all', 'All', allView],
            ['comics', 'Comics', comicsView],
            ['writing', 'Writing', writingView],
            ['blog', 'Blog', blogView]
        ];
        switcher.innerHTML = list.map(function (v) {
            return '<button type="button" data-view="' + v[0] + '">' + v[1] + '</button>';
        }).join('');
        views.innerHTML = list.map(function (v) {
            return '<section id="view-' + v[0] + '">' + v[2] + '</section>';
        }).join('');
        Site.viewSwitch();
    });

})();
