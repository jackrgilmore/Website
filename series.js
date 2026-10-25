// One series, streaming style: series.html?s=hat-guy (&e=episode to play one).
// Episodes come from the series' heading in content/animation.org.

(function () {

    var box = document.getElementById('series');
    var series, current, seasonShown;

    Site.loadAnimation()
        .then(function (data) {
            var wanted = Site.param('s');
            series = data.series.filter(function (s) { return s.slug === wanted; })[0] || data.series[0];
            if (!series) {
                box.innerHTML = '<p class="empty">No series yet.</p>';
                return;
            }
            document.title = series.title + ' — Jack Gilmore';
            current = series.entries.filter(function (ep) { return ep.slug === Site.param('e'); })[0] || null;
            seasonShown = current ? current.seasonIndex : 0;
            draw();
        })
        .catch(function (error) { Site.failed(box, error); });


    // ============ DRAWING ============

    function episodeLabel(ep) {
        return (ep.season ? ep.season + ', ' : '') + 'Episode ' + ep.number;
    }

    function hero() {
        var first = series.entries[0];
        var latest = series.entries[series.entries.length - 1];
        var count = series.entries.length;
        var buttons = '';
        if (first) buttons += '<button class="button button-primary" type="button" data-play="' + first.slug + '">' + icon('play') + ' Watch from the start</button>';
        if (latest && latest !== first) buttons += '<button class="button" type="button" data-play="' + latest.slug + '">Latest episode</button>';

        return '<header class="series-hero">'
            + '<div class="thumb portrait">' + (series.thumb || (first && Site.thumbOf(first))
                ? '<img src="' + Site.esc(series.thumb || Site.thumbOf(first)) + '" alt="">'
                : '<span class="thumb-placeholder">' + Site.esc(series.title) + '</span>') + '</div>'
            + '<div><p class="eyebrow">Series · ' + count + ' episode' + (count === 1 ? '' : 's') + '</p>'
            + '<h1>' + Site.esc(series.title) + '</h1>'
            + '<div class="lead">' + series.description + '</div>'
            + '<div class="platforms">' + buttons + Site.platformButtons(series.links) + '</div></div>'
            + '</header>';
    }

    function nowPlaying() {
        if (!current) return '';
        var i = series.entries.indexOf(current);
        var prev = series.entries[i - 1];
        var next = series.entries[i + 1];
        return '<section class="now-playing" id="now-playing">'
            + Site.player(current.video, current.autoplay, current.title)
            + '<h2>' + Site.esc(current.title) + '</h2>'
            + '<p class="episode-meta">' + Site.esc(episodeLabel(current))
            + (current.date ? ' · ' + Site.prettyDate(current.date) : '') + '</p>'
            + '<div class="description">' + current.description + '</div>'
            + (current.links.length ? '<div class="platforms">' + Site.platformButtons(current.links) + '</div>' : '')
            + '<div class="episode-nav">'
            + (prev ? '<button class="button" type="button" data-play="' + prev.slug + '">← ' + Site.esc(prev.title) + '</button>' : '<span></span>')
            + (next ? '<button class="button" type="button" data-play="' + next.slug + '">' + Site.esc(next.title) + ' →</button>' : '')
            + '</div></section>';
    }

    function episodes() {
        if (!series.entries.length) return '<p class="empty">Episodes coming soon.</p>';
        var tabs = '';
        if (series.seasons.length > 1) {
            tabs = '<div class="season-tabs" role="group" aria-label="Season">' + series.seasons.map(function (season, i) {
                return '<button class="button" type="button" data-season="' + i + '" aria-pressed="' + (i === seasonShown) + '">'
                    + Site.esc(season.title || 'Episodes') + '</button>';
            }).join('') + '</div>';
        }
        var list = series.seasons[seasonShown].entries.map(function (ep) {
            var thumb = Site.thumbOf(ep);
            return '<li><button class="episode" type="button" data-play="' + ep.slug + '"'
                + (ep === current ? ' aria-current="true"' : '') + '>'
                + '<span class="number">' + ep.number + '</span>'
                + '<span class="thumb">' + (thumb ? '<img src="' + Site.esc(thumb) + '" alt="" loading="lazy">' : '<span class="thumb-placeholder">' + Site.esc(ep.title) + '</span>') + '</span>'
                + '<span><span class="ep-title">' + Site.esc(ep.title) + '</span>'
                + '<span class="ep-summary">' + Site.esc(ep.summary) + (ep.date ? ' <span class="card-meta">' + Site.prettyDate(ep.date) + '</span>' : '') + '</span></span>'
                + '</button></li>';
        }).join('');
        return '<section class="section"><div class="section-head"><h2>Episodes</h2></div>'
            + tabs + '<ul class="episode-list">' + list + '</ul></section>';
    }

    function draw() {
        box.innerHTML = hero() + nowPlaying() + episodes();
    }


    // ============ CLICKS ============

    box.addEventListener('click', function (e) {
        var play = e.target.closest('[data-play]');
        var season = e.target.closest('[data-season]');
        if (play) {
            current = series.entries.filter(function (ep) { return ep.slug === play.getAttribute('data-play'); })[0];
            current.autoplay = true;
            seasonShown = current.seasonIndex;
            history.replaceState(null, '', '?s=' + series.slug + '&e=' + current.slug);
            draw();
            document.getElementById('now-playing').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (season) {
            seasonShown = +season.getAttribute('data-season');
            draw();
        }
    });

})();
