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

    // What one piece of each kind is called, above its title in the All view
    var KIND_NAMES = {
        story: 'Short story', poem: 'Poem', script: 'Script', essay: 'Essay',
        article: 'Article', blog: 'Blog post'
    };

    function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
    function comicHref(comic) { return '/comic.html?c=' + encodeURIComponent(comic.id); }
    function seriesHref(series) { return '/comic-series.html?s=' + series.slug; }

    function minutes(words) {
        return Math.max(1, Math.round(words / 230)) + ' min read';
    }

    function entry(piece) {
        var meta = [piece.publication, Site.prettyDate(piece.date), minutes(piece.words)].filter(Boolean).join(' · ');
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

    // A book: its cover (or its title on a plain one), book-shaped
    function bookCard(book) {
        var meta = [plural(book.chapters.length, 'chapter'), Site.prettyDate(book.date)].filter(Boolean).join(' · ');
        return '<a class="card" href="' + Site.esc(book.url) + '"><span class="thumb book">'
            + (book.cover
                ? '<img src="' + Site.esc(book.cover) + '" alt="" loading="lazy">'
                : '<span class="thumb-placeholder">' + Site.esc(book.title) + '</span>')
            + '</span><span class="card-title">' + Site.esc(book.title) + '</span>'
            + '<span class="card-meta">' + Site.esc(meta) + '</span></a>';
    }

    // A script: its title page, in Courier on white paper, the way it prints:
    // the title a third of the way down, then which draft and its date
    function scriptCard(script) {
        var meta = [Site.prettyDate(script.date), minutes(script.words)].filter(Boolean).join(' · ');
        var m = /(\d{4})-(\d{2})-(\d{2})/.exec(script.draft || script.date || '');
        var when = m ? +m[2] + '/' + +m[3] + '/' + m[1].slice(2) : '';   // 2026-10-18 → 10/18/26
        return '<a class="card" href="' + Site.esc(script.url) + '"><span class="thumb script">'
            + '<span class="script-title">' + Site.esc(script.title) + '</span>'
            + '<span class="script-draft"><span class="script-revision">' + Site.esc(script.revision || 'First Draft') + '</span>'
            + (when ? '<br>' + Site.esc(when) : '') + '</span>'
            + '</span><span class="card-title">' + Site.esc(script.title) + '</span>'
            + '<span class="card-meta">' + Site.esc(meta) + '</span></a>';
    }

    // Books and scripts, side by side: a shelf of covers and one of title pages
    function shelves(books, scripts) {
        function shelf(title, cards) {
            return cards.length ? '<section class="shelf-half"><h3>' + title + '</h3>'
                + '<div class="covers">' + cards.join('') + '</div></section>' : '';
        }
        if (!books.length && !scripts.length) return '';
        return '<div class="cover-shelves' + (books.length && scripts.length ? ' two' : '') + '">'
            + shelf('Books', books.map(bookCard)) + shelf('Scripts', scripts.map(scriptCard)) + '</div>';
    }

    // ---- The All view's panels ----

    // The newest piece of writing or post, big: what it is, its title, its
    // description, when
    function featured(piece) {
        var meta = [Site.prettyDate(piece.date), minutes(piece.words)].filter(Boolean).join(' · ');
        return '<a class="hub-feature" href="' + Site.esc(piece.url) + '">'
            + '<span class="hub-new">Newest · ' + Site.esc(KIND_NAMES[piece.type] || piece.type) + '</span>'
            + '<span class="hub-title">' + Site.esc(piece.title) + '</span>'
            + (piece.description ? '<span class="hub-desc">' + Site.esc(piece.description) + '</span>' : '')
            + '<span class="hub-meta">' + Site.esc(meta) + '</span></a>';
    }

    // The newest comic: its cover beside its name
    function featuredComic(comic) {
        var thumb = Site.thumbOf(comic);
        var meta = comic.series ? comic.series.title + ' · Issue ' + comic.number : Site.prettyDate(comic.date);
        return '<a class="hub-feature hub-cover" href="' + Site.esc(comicHref(comic)) + '">'
            + (thumb ? '<img src="' + Site.esc(thumb) + '" alt="" loading="lazy">' : '<span></span>')
            + '<span><span class="hub-new">Newest</span>'
            + '<span class="hub-title">' + Site.esc(comic.title) + '</span>'
            + '<span class="hub-meta">' + Site.esc(meta) + '</span></span></a>';
    }

    // The next few, as a list: [href, title, meta] each
    function shortList(items) {
        if (!items.length) return '';
        return '<ul class="hub-list">' + items.map(function (item) {
            return '<li><a href="' + Site.esc(item[0]) + '"><span>' + Site.esc(item[1]) + '</span>'
                + '<span class="hub-meta">' + Site.esc(item[2] || '') + '</span></a></li>';
        }).join('') + '</ul>';
    }

    // One panel: KIND (comics, writing, blog) is the view its "all" link opens
    function panel(kind, title, count, blurb, body, more) {
        return '<section class="hub-panel hub-' + kind + '" aria-label="' + Site.esc(title) + '">'
            + '<div class="hub-head"><h2>' + Site.esc(title) + '</h2><span class="hub-count">' + Site.esc(count) + '</span></div>'
            + '<p class="hub-blurb">' + Site.esc(blurb) + '</p>'
            + body
            + (more ? '<a class="hub-more" href="#' + kind + '">' + Site.esc(more) + ' →</a>' : '')
            + '</section>';
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
        var newestComics = comics.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
        var listed = function (p) { return [p.url, p.title, Site.prettyDate(p.date)]; };
        var hub = '<div class="hub">'
            + panel('comics', 'Comics', plural(comics.length, 'comic'), 'Stories in pictures.',
                    newestComics.length
                        ? featuredComic(newestComics[0]) + shortList(newestComics.slice(1, 4).map(function (c) {
                            return [comicHref(c), c.title, c.series ? 'Issue ' + c.number : Site.prettyDate(c.date)];
                        }))
                        : '<p class="hub-empty">The first comics are on their way.</p>',
                    comics.length > 1 ? 'All comics' : '')
            + panel('writing', 'Writing', plural(creative.length, 'piece'), 'Short stories, poems and essays.',
                    creative.length
                        ? featured(creative[0]) + shortList(creative.slice(1, 4).map(listed))
                        : '<p class="hub-empty">No stories yet.</p>',
                    creative.length > 1 ? 'All writing' : '')
            + panel('blog', 'Blog', plural(blog.length, 'post'), 'News, notes and recommendations.',
                    blog.length
                        ? featured(blog[0]) + shortList(blog.slice(1, 4).map(listed))
                        : '<p class="hub-empty">No posts yet.</p>',
                    blog.length > 1 ? 'All posts' : '')
            + '</div>';
        var allView = shelves(books, scripts) + (pieces || all[0] ? hub : missing);

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
            writingView = shelves(books, scripts)
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
