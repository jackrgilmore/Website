// The comics page: every comic as a Gallery or by Series.
// Everything comes from content/comics.org.

(function () {

    var galleryBox = document.getElementById('view-gallery');
    var seriesBox = document.getElementById('view-series');

    Site.viewSwitch();

    Site.loadComics()
        .then(function (data) {

            // Gallery: every standalone comic, plus every issue of every series
            var comics = data.gallery.slice();
            data.series.forEach(function (series) {
                series.entries.forEach(function (issue) {
                    if (issue.images.length) comics.push(issue);
                });
            });

            galleryBox.innerHTML = comics.length
                ? '<div class="grid">' + comics.map(function (comic) {
                    return Site.card({
                        href: '/comic.html?c=' + encodeURIComponent(comic.id),
                        thumb: Site.thumbOf(comic),
                        title: comic.title,
                        meta: comic.series ? comic.series.title + ' · ' + comic.number : Site.prettyDate(comic.date),
                        portrait: true
                    });
                }).join('') + '</div>'
                : '<p class="empty">The first comics are on their way.</p>';

            // Series: one shelf per comic series
            seriesBox.innerHTML = data.series.length
                ? data.series.map(function (series) {
                    return Site.seriesBlock(series, {
                        unit: 'issue',
                        portrait: true,
                        href: function (s) { return s.entries[0] ? '/comic.html?c=' + encodeURIComponent(s.entries[0].id) : '/comics.html#series'; },
                        entryHref: function (issue) { return '/comic.html?c=' + encodeURIComponent(issue.id); }
                    });
                }).join('')
                : '<p class="empty">No comic series yet.</p>';
        })
        .catch(function (error) { Site.failed(galleryBox, error); });

})();
