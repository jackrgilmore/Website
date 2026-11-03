// One drawing: drawing.html?d=<id>. The drawing as big as the window allows,
// its title, date and words, any more pictures under it (details, sketches),
// and the next and previous drawing (newest first, as on the Drawings page).

(function () {

    var box = document.getElementById('drawing');
    var trail = [['/drawings.html', 'Drawings']];

    function href(d) { return '/drawing.html?d=' + encodeURIComponent(d.id); }

    Site.loadDrawings()
        .then(function (data) {
            var drawing = data.byId[Site.param('d')];
            if (!drawing) {
                box.innerHTML = Site.crumbs(trail.concat([[null, 'Not found']]))
                    + '<p class="empty">This drawing couldn’t be found. <a href="/drawings.html">See all drawings</a></p>';
                return;
            }
            document.title = drawing.title + ' — Jack Gilmore';

            var i = data.drawings.indexOf(drawing);
            var newer = data.drawings[i - 1];
            var older = data.drawings[i + 1];
            var nav = (newer || older)
                ? '<div class="episode-nav">'
                    + (newer ? '<a class="button" data-key="prev" href="' + href(newer) + '">← ' + Site.esc(newer.title) + '</a>' : '<span></span>')
                    + (older ? '<a class="button button-primary" data-key="next" href="' + href(older) + '">' + Site.esc(older.title) + ' →</a>' : '<a class="button" href="/drawings.html">All drawings</a>')
                    + '</div>'
                : '';

            var groupTrail = drawing.group ? [['/drawings.html#' + Site.slug(drawing.group), drawing.group]] : [];
            box.innerHTML = Site.crumbs(trail.concat(groupTrail, [[null, drawing.title]]))
                + '<figure class="drawing-main"><img src="' + Site.esc(drawing.images[0]) + '" alt="' + Site.esc(drawing.title) + '"></figure>'
                + '<header class="prose-head drawing-head">'
                + (drawing.group ? '<p class="eyebrow">' + Site.esc(drawing.group) + '</p>' : '')
                + '<h1>' + Site.esc(drawing.title) + '</h1>'
                + (drawing.date ? '<p class="byline">' + Site.prettyDate(drawing.date) + '</p>' : '')
                + '<div class="prose-actions">' + shareButton(href(drawing), document.title) + '</div>'
                + '</header>'
                + (drawing.description ? '<div class="prose drawing-words">' + drawing.description + '</div>' : '')
                + (drawing.images.length > 1
                    ? '<div class="drawing-more">' + drawing.images.slice(1).map(function (src, n) {
                        return '<img src="' + Site.esc(src) + '" alt="' + Site.esc(drawing.title) + ', ' + (n + 2) + '" loading="lazy">';
                    }).join('') + '</div>'
                    : '')
                + nav;
        })
        .catch(function (error) { Site.failed(box, error); });

})();
