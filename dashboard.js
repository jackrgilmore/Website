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


    // ============ GARDEN GRAPH ============
    // Each public org-roam note is a dot; each link between two notes is a line.
    // Drag to move dots, scroll or pinch to zoom, click a dot to read the note.

    function drawGarden(box, garden) {
        if (!garden.nodes.length) {
            box.innerHTML = '<p class="empty">No public notes yet. Tag an org-roam note with <code>publish</code> to grow the garden.</p>';
            return;
        }
        var list = '<div class="note-list">' + garden.nodes.map(function (n) {
            return '<a href="' + Site.esc(n.id) + '">' + Site.esc(n.title) + '</a>';
        }).join('') + '</div>';

        if (typeof d3 === 'undefined') {
            box.innerHTML = list; // graph library didn't load; the list still works
            return;
        }
        box.innerHTML = '<div class="garden-graph"></div>' + list;
        var holder = box.querySelector('.garden-graph');
        var width = holder.clientWidth;
        var height = holder.clientHeight;

        // One line per pair of notes, even if they link both ways
        var seen = {};
        var links = [];
        garden.links.forEach(function (l) {
            var key = [l.source, l.target].sort().join('|');
            if (!seen[key]) {
                seen[key] = true;
                links.push({ source: l.source, target: l.target });
            }
        });
        var nodes = garden.nodes.map(function (n) { return { id: n.id, title: n.title, degree: 0 }; });
        var byId = {};
        nodes.forEach(function (n) { byId[n.id] = n; });
        links.forEach(function (l) { byId[l.source].degree++; byId[l.target].degree++; });

        var svg = d3.select(holder).append('svg')
            .attr('viewBox', [-width / 2, -height / 2, width, height])
            .attr('role', 'img')
            .attr('aria-label', 'Graph of ' + nodes.length + ' notes and the links between them');
        var world = svg.append('g');

        svg.call(d3.zoom().scaleExtent([0.3, 4]).on('zoom', function (e) {
            world.attr('transform', e.transform);
        }));

        var line = world.append('g').selectAll('line').data(links).join('line');
        var node = world.append('g').selectAll('g').data(nodes).join('g').attr('class', 'node');
        node.append('circle').attr('r', function (d) { return 5 + Math.sqrt(d.degree) * 3; });
        node.append('text')
            .attr('x', function (d) { return 9 + Math.sqrt(d.degree) * 3; })
            .attr('y', 4)
            .text(function (d) { return d.title; });
        node.append('title').text(function (d) { return d.title; });

        var simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(70))
            .force('charge', d3.forceManyBody().strength(-180))
            .force('x', d3.forceX())
            .force('y', d3.forceY())
            .on('tick', function () {
                line.attr('x1', function (d) { return d.source.x; })
                    .attr('y1', function (d) { return d.source.y; })
                    .attr('x2', function (d) { return d.target.x; })
                    .attr('y2', function (d) { return d.target.y; });
                node.attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });
            });

        var moved = false;
        node.call(d3.drag()
            .on('start', function (e, d) {
                moved = false;
                if (!e.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', function (e, d) {
                moved = true;
                d.fx = e.x;
                d.fy = e.y;
            })
            .on('end', function (e, d) {
                if (!e.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }));

        node.on('click', function (e, d) {
            if (!moved) window.location.href = d.id;
        });
    }

})();
