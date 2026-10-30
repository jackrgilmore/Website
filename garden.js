// The garden page: the graph of every public org-roam note (Site.gardenGraph,
// with its search button), then every note, most recently tended first;
// pointing at one in the list lights it up in the graph.
// data/garden.json is written by publish.el (SPC n w p) from the org-roam
// notes tagged publish.

(function () {

    var box = document.getElementById('garden');

    function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

    Site.loadJSON('/data/garden.json', { nodes: [], links: [] }).then(function (garden) {
        if (!garden.nodes.length) {
            box.innerHTML = '<p class="empty">No public notes yet.</p>';
            return;
        }

        // Links per note, counting a pair that link both ways once (as the graph does)
        var seen = {};
        var count = {};
        garden.links.forEach(function (l) {
            var key = [l.source, l.target].sort().join('|');
            if (seen[key]) return;
            seen[key] = true;
            count[l.source] = (count[l.source] || 0) + 1;
            count[l.target] = (count[l.target] || 0) + 1;
        });

        var notes = garden.nodes.slice().sort(function (a, b) {
            return (b.modified || '').localeCompare(a.modified || '');
        });

        box.innerHTML = '<div class="garden-graph garden-graph-large"></div>'
            + '<section class="section reading-list">'
            + '<div class="section-head"><h2>Every note</h2><span class="card-meta">most recently tended first</span></div>'
            + notes.map(function (n) {
                var meta = n.tags
                    .concat(count[n.id] ? [plural(count[n.id], 'link')] : [])
                    .concat(n.modified ? ['updated ' + Site.prettyDate(n.modified)] : [])
                    .join(' · ');
                return '<a class="entry" href="' + Site.esc(n.id) + '">'
                    + '<span class="entry-title">' + Site.esc(n.title) + '</span>'
                    + '<span class="entry-meta">' + Site.esc(meta) + '</span></a>';
            }).join('')
            + '</section>';
        Site.lightFromList(box.querySelector('.reading-list'),
            Site.gardenGraph(box.querySelector('.garden-graph'), garden));
    });

})();
