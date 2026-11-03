// The Drawings page: every drawing in content/drawings.org, newest first, on
// a wall where each keeps its own shape (tall, wide or square). The first
// button shows them all; there's one more for each group in the file
// (Sketchbook, Characters...), if it has groups. Each drawing opens on its
// own page, drawing.html?d=<id> (drawing.js).

(function () {

    var switcher = document.getElementById('view-switch');
    var views = document.getElementById('views');

    function tile(d) {
        var href = '/drawing.html?d=' + encodeURIComponent(d.id);
        return '<a class="drawing-tile" href="' + Site.esc(href) + '">'
            + '<img src="' + Site.esc(Site.thumbOf(d)) + '" alt="' + Site.esc(d.title) + '" loading="lazy">'
            + '<span class="card-title">' + Site.esc(d.title) + '</span>'
            + '<span class="card-meta">' + Site.esc([d.group, Site.prettyDate(d.date)].filter(Boolean).join(' · ')) + '</span>'
            + '</a>';
    }

    function wall(drawings) {
        return drawings.length
            ? '<div class="drawing-wall">' + drawings.map(tile).join('') + '</div>'
            : '<p class="empty">The first drawings are on their way.</p>';
    }

    Site.loadDrawings()
        .then(function (data) {
            var list = [['all', 'All', wall(data.drawings)]];
            if (data.groups.length) {
                data.groups.forEach(function (g) {
                    list.push([Site.slug(g), g, wall(data.drawings.filter(function (d) { return d.group === g; }))]);
                });
                switcher.innerHTML = list.map(function (v) {
                    return '<button type="button" data-view="' + v[0] + '">' + Site.esc(v[1]) + '</button>';
                }).join('');
            }
            views.innerHTML = list.map(function (v) {
                return '<section id="view-' + v[0] + '">' + v[2] + '</section>';
            }).join('');
            Site.viewSwitch();
        })
        .catch(function (error) { Site.failed(views, error); });

})();
