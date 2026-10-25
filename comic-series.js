// One comic series: comic-series.html?s=<slug>. Its cover, description and
// every issue (split into chapters, if it has them), from the series' heading
// in content/comics.org. Like series.html, for animation.

(function () {

    var box = document.getElementById('comic-series');
    var trail = [['/read.html', 'Read'], ['/read.html#comics', 'Comics']];

    function comicHref(comic) { return '/comic.html?c=' + encodeURIComponent(comic.id); }

    Site.loadComics()
        .then(function (data) {
            var series = data.series.filter(function (s) { return s.slug === Site.param('s'); })[0];
            if (!series) {
                box.innerHTML = Site.crumbs(trail.concat([[null, 'Not found']]))
                    + '<p class="empty">This series couldn’t be found. <a href="/read.html#comics">See all comics</a></p>';
                return;
            }
            document.title = series.title + ' — Jack Gilmore';

            var first = series.entries[0];
            var latest = series.entries[series.entries.length - 1];
            var count = series.entries.length;
            var cover = series.thumb || (first && Site.thumbOf(first));
            var buttons = '';
            if (first) buttons += '<a class="button button-primary" data-key="next" href="' + comicHref(first) + '">Start reading</a>';
            if (latest && latest !== first) buttons += '<a class="button" href="' + comicHref(latest) + '">Latest issue</a>';

            var issues = count ? series.seasons.map(function (chapter) {
                return (chapter.title ? '<h3 class="subsection">' + Site.esc(chapter.title) + '</h3>' : '')
                    + '<div class="grid grid-portrait">' + chapter.entries.map(function (issue) {
                        return Site.card({
                            href: comicHref(issue),
                            thumb: Site.thumbOf(issue),
                            title: issue.title,
                            meta: ['Issue ' + issue.number, Site.prettyDate(issue.date)].filter(Boolean).join(' · '),
                            portrait: true
                        });
                    }).join('') + '</div>';
            }).join('') : '<p class="empty">The first issue is on its way.</p>';

            box.innerHTML = Site.crumbs(trail.concat([[null, series.title]]))
                + '<header class="series-hero">'
                + '<div class="thumb portrait">' + (cover
                    ? '<img src="' + Site.esc(cover) + '" alt="">'
                    : '<span class="thumb-placeholder">' + Site.esc(series.title) + '</span>') + '</div>'
                + '<div><p class="eyebrow">Comic series · ' + count + ' issue' + (count === 1 ? '' : 's') + '</p>'
                + '<h1>' + Site.esc(series.title) + '</h1>'
                + '<div class="lead">' + series.description + '</div>'
                + '<div class="platforms">' + buttons + Site.platformButtons(series.links) + '</div></div>'
                + '</header>'
                + '<section class="section"><div class="section-head"><h2>Issues</h2></div>' + issues + '</section>';
        })
        .catch(function (error) { Site.failed(box, error); });

})();
