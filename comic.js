// The comic reader: comic.html?c=<id>. Pages scroll top to bottom, with the
// previous and next issue of a series at the end (and the way back to the
// series after the last one).

(function () {

    var box = document.getElementById('comic');
    var trail = [['/read.html', 'Read'], ['/read.html#comics', 'Comics']];

    Site.loadComics()
        .then(function (data) {
            var comic = data.byId[Site.param('c')];
            if (!comic) {
                box.innerHTML = Site.crumbs(trail.concat([[null, 'Not found']]))
                    + '<p class="empty">This comic couldn’t be found. <a href="/read.html#comics">See all comics</a></p>';
                return;
            }
            document.title = comic.title + ' — Jack Gilmore';

            var series = comic.series;
            var seriesHref = series && '/comic-series.html?s=' + series.slug;
            var nav = '';
            if (series) {
                var i = series.entries.indexOf(comic);
                var prev = series.entries[i - 1];
                var next = series.entries[i + 1];
                nav = '<div class="episode-nav">'
                    + (prev ? '<a class="button" data-key="prev" href="/comic.html?c=' + encodeURIComponent(prev.id) + '">← ' + Site.esc(prev.title) + '</a>' : '<span></span>')
                    + (next
                        ? '<a class="button button-primary" data-key="next" href="/comic.html?c=' + encodeURIComponent(next.id) + '">' + Site.esc(next.title) + ' →</a>'
                        : '<a class="button" href="' + seriesHref + '">All issues</a>')
                    + '</div>';
            }

            box.innerHTML = Site.crumbs(trail.concat(series ? [[seriesHref, series.title]] : [], [[null, comic.title]]))
                + '<header class="prose-head">'
                + '<p class="eyebrow">' + Site.esc(series ? 'Issue ' + comic.number : (comic.collection || 'Comic')) + '</p>'
                + '<h1>' + Site.esc(comic.title) + '</h1>'
                + (comic.date ? '<p class="byline">' + Site.prettyDate(comic.date) + '</p>' : '')
                + '</header>'
                + '<div class="prose">' + comic.description + '</div>'
                + '<div class="comic-pages">' + comic.images.map(function (src, n) {
                    return '<img src="' + Site.esc(src) + '" alt="' + Site.esc(comic.title) + ', page ' + (n + 1) + '"' + (n > 1 ? ' loading="lazy"' : '') + '>';
                }).join('') + '</div>'
                + nav;
        })
        .catch(function (error) { Site.failed(box, error); });

})();
