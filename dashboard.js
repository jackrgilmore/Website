// The dashboard: the reel, the newest episode, a tile for each part of the
// site, the latest of each, and the garden graph (public org-roam notes).

(function () {

    function el(id) { return document.getElementById(id); }

    // Load everything; one part failing shouldn't blank the rest
    Promise.all([
        Site.loadAnimation().catch(function (e) { console.error(e); return null; }),
        Site.loadComics().catch(function (e) { console.error(e); return null; }),
        Site.loadJSON('/data/writing.json', []),
        Site.loadJSON('/data/garden.json', { nodes: [], links: [] })
    ]).then(function (all) {
        var animation = all[0] || { reel: null, series: [], gallery: [] };
        var comics = all[1] || { series: [], gallery: [] };
        var writing = all[2] || [];
        var garden = all[3] || { nodes: [], links: [] };

        var episodes = [];
        animation.series.forEach(function (s) { episodes = episodes.concat(s.entries); });
        var issues = comics.gallery.slice();
        comics.series.forEach(function (s) { issues = issues.concat(s.entries); });

        // ---- Reel and latest episode ----
        el('dash-reel').innerHTML = animation.reel
            ? Site.player(animation.reel.video, false, animation.reel.title)
              + '<div class="button-row"><button class="button share-reel" type="button">Copy reel link</button></div>'
            : '<p class="empty">No reel set.</p>';

        var latest = episodes.filter(function (ep) { return ep.video; }).pop();
        el('dash-latest').innerHTML = latest
            ? Site.card({
                href: '/series.html?s=' + latest.series.slug + '&e=' + latest.slug,
                thumb: Site.thumbOf(latest),
                title: latest.title,
                meta: latest.series.title + ' · Episode ' + latest.number,
                play: true
            })
            : (animation.series[0]
                ? Site.card({ href: '/series.html?s=' + animation.series[0].slug, thumb: animation.series[0].thumb, title: animation.series[0].title, meta: 'First episode coming soon' })
                : '<p class="empty">No episodes yet.</p>');

        // ---- Tiles ----
        function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
        var videoCount = animation.gallery.length + episodes.filter(function (ep) { return ep.video; }).length;
        var tiles = [
            ['/animation.html', 'Animation', plural(videoCount, 'video')],
            ['/animation.html#series', 'Series', animation.series.map(function (s) { return s.title; }).join(', ') || 'none yet'],
            ['/comics.html', 'Comics', plural(issues.filter(function (c) { return c.images.length; }).length, 'comic')],
            ['/writing.html', 'Writing', plural(writing.filter(function (w) { return w.type !== 'blog'; }).length, 'piece')],
            ['/writing.html#blog', 'Blog', plural(writing.filter(function (w) { return w.type === 'blog'; }).length, 'post')],
            ['#garden', 'Garden', plural(garden.nodes.length, 'note')]
        ];
        el('dash-tiles').innerHTML = tiles.map(function (t) {
            return '<a class="tile" href="' + t[0] + '"><strong>' + t[1] + '</strong><span>' + Site.esc(t[2]) + '</span></a>';
        }).join('');

        // ---- Latest animation: newest episodes first, then projects ----
        var videos = episodes.filter(function (ep) { return ep.video; }).reverse().concat(animation.gallery).slice(0, 8);
        el('dash-animation').innerHTML = videos.length
            ? '<div class="shelf">' + videos.map(function (v) {
                return Site.card({
                    href: v.series ? '/series.html?s=' + v.series.slug + '&e=' + v.slug : '/animation.html',
                    thumb: Site.thumbOf(v),
                    title: v.title,
                    meta: v.series ? v.series.title : Site.prettyDate(v.date),
                    play: true
                });
            }).join('') + '</div>'
            : '<p class="empty">No videos yet.</p>';

        // ---- Latest comics ----
        var withPages = issues.filter(function (c) { return c.images.length; }).reverse().slice(0, 8);
        el('dash-comics').innerHTML = withPages.length
            ? '<div class="shelf">' + withPages.map(function (c) {
                return Site.card({
                    href: '/comic.html?c=' + encodeURIComponent(c.id),
                    thumb: Site.thumbOf(c),
                    title: c.title,
                    meta: c.series ? c.series.title : Site.prettyDate(c.date),
                    portrait: true
                });
            }).join('') + '</div>'
            : '<p class="empty">The first comics are on their way.</p>';

        // ---- Latest writing ----
        el('dash-writing').innerHTML = writing.length
            ? writing.slice(0, 5).map(function (w) {
                var meta = [w.type === 'blog' ? 'Blog' : w.type.charAt(0).toUpperCase() + w.type.slice(1), w.publication, Site.prettyDate(w.date)].filter(Boolean).join(' · ');
                return '<a class="entry" href="' + Site.esc(w.url) + '"><span class="entry-title">' + Site.esc(w.title)
                    + '</span><span class="entry-meta">' + Site.esc(meta) + '</span></a>';
            }).join('')
            : '<p class="empty">No writing yet.</p>';

        // ---- Garden ----
        drawGarden(el('dash-garden'), garden);

        // Share button (reel.js isn't loaded here)
        var share = document.querySelector('.share-reel');
        if (share) share.addEventListener('click', function () { Site.copyLink(location.origin + '/reel.html'); });
    });


    // ============ GARDEN ============
    // The graph (Site.gardenGraph, in catalog.js), then every note as a list.

    function drawGarden(box, garden) {
        if (!garden.nodes.length) {
            box.innerHTML = '<p class="empty">No public notes yet. Tag an org-roam note with <code>publish</code> to grow the garden.</p>';
            return;
        }
        box.innerHTML = '<div class="garden-graph"></div><div class="note-list">' + garden.nodes.map(function (n) {
            return '<a href="' + Site.esc(n.id) + '">' + Site.esc(n.title) + '</a>';
        }).join('') + '</div>';
        Site.gardenGraph(box.querySelector('.garden-graph'), garden);
    }

})();
