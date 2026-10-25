// The comic reader: comic.html?c=<id>. Pages scroll top to bottom, with the
// previous and next issue of a series at the end.

(function () {

    var box = document.getElementById('comic');

    Site.loadComics()
        .then(function (data) {
            var comic = data.byId[Site.param('c')];
            if (!comic) {
                box.innerHTML = '<p class="empty">This comic couldn’t be found. <a href="/comics.html">See all comics</a></p>';
                return;
            }
            document.title = comic.title + ' — Jack Gilmore';

            var series = comic.series;
            var nav = '';
            if (series) {
                var i = series.entries.indexOf(comic);
                var prev = series.entries[i - 1];
                var next = series.entries[i + 1];
                nav = '<div class="episode-nav">'
                    + (prev ? '<a class="button" href="/comic.html?c=' + encodeURIComponent(prev.id) + '">← ' + Site.esc(prev.title) + '</a>' : '<span></span>')
                    + (next ? '<a class="button button-primary" href="/comic.html?c=' + encodeURIComponent(next.id) + '">' + Site.esc(next.title) + ' →</a>' : '')
                    + '</div>';
            }

            box.innerHTML = '<header class="prose-head">'
                + '<p class="eyebrow">' + Site.esc(series ? series.title + ' · ' + comic.number : (comic.collection || 'Comic')) + '</p>'
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
