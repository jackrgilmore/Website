// The writing page: creative writing grouped by kind, then the blog, then the
// garden. The lists are data/writing.json and data/garden.json, which Emacs
// writes when it publishes (publish.el, SPC n w p) from the Org files in
// content/writing/ and the org-roam notes tagged publish.

(function () {

    var box = document.getElementById('writing');

    // Creative writing, in this order. Any other #+type: is listed after these.
    var KINDS = [
        ['story', 'Short stories'],
        ['poem', 'Poems'],
        ['script', 'Scripts'],
        ['essay', 'Essays'],
        ['article', 'Articles']
    ];

    function minutes(words) {
        return Math.max(1, Math.round(words / 230)) + ' min read';
    }

    function entry(piece, showDesc) {
        var meta = [piece.publication, Site.prettyDate(piece.date), minutes(piece.words)].filter(Boolean).join(' · ');
        return '<a class="entry" href="' + Site.esc(piece.url) + '">'
            + '<span class="entry-title">' + Site.esc(piece.title)
            + (showDesc && piece.description ? '<span class="entry-desc">' + Site.esc(piece.description) + '</span>' : '')
            + '</span>'
            + '<span class="entry-meta">' + Site.esc(meta) + '</span></a>';
    }

    function group(title, pieces, showDesc) {
        return '<div class="writing-group"><h3>' + Site.esc(title) + '</h3>'
            + pieces.map(function (p) { return entry(p, showDesc); }).join('') + '</div>';
    }

    // The garden: the graph of every public note (drawn after the page, by
    // Site.gardenGraph), then the five notes changed most recently
    function garden(notes) {
        var head = '<div class="section-head"><h2>Garden</h2>'
            + (notes.length > 5 ? '<a href="/dashboard.html#garden">all ' + notes.length + ' notes →</a>' : '') + '</div>'
            + '<p class="section-intro">Notes in progress: ideas, research and half-formed thoughts, linked together.</p>';
        if (!notes.length) return head + '<p class="empty">No public notes yet.</p>';
        var recent = notes.slice()
            .sort(function (a, b) { return (b.modified || '').localeCompare(a.modified || ''); })
            .slice(0, 5);
        return head + '<div class="garden-graph"></div>'
            + '<div class="writing-group"><h3>Recently tended</h3>'
            + recent.map(function (n) {
                var meta = n.tags.concat(n.modified ? ['updated ' + Site.prettyDate(n.modified)] : []).join(' · ');
                return '<a class="entry" href="' + Site.esc(n.id) + '">'
                    + '<span class="entry-title">' + Site.esc(n.title) + '</span>'
                    + '<span class="entry-meta">' + Site.esc(meta) + '</span></a>';
            }).join('') + '</div>';
    }

    Promise.all([
        Site.loadJSON('/data/writing.json', null),
        Site.loadJSON('/data/garden.json', { nodes: [], links: [] })
    ]).then(function (all) {
        var pieces = all[0];
        var notes = all[1];
        if (!pieces) {
            box.innerHTML = '<p class="empty">Couldn’t load the writing list (data/writing.json). Publish from Emacs to make it.</p>';
            return;
        }

        var creative = pieces.filter(function (p) { return p.type !== 'blog'; });
        var blog = pieces.filter(function (p) { return p.type === 'blog'; });
        var html = '';

        if (creative.length) {
            var known = KINDS.map(function (k) { return k[0]; });
            var others = [];
            creative.forEach(function (p) {
                if (known.indexOf(p.type) === -1 && others.indexOf(p.type) === -1) others.push(p.type);
            });
            var kinds = KINDS.concat(others.map(function (t) {
                return [t, t.charAt(0).toUpperCase() + t.slice(1) + 's'];
            }));

            html += '<section class="section"><div class="section-head"><h2>Creative writing</h2></div>';
            kinds.forEach(function (kind) {
                var these = creative.filter(function (p) { return p.type === kind[0]; });
                if (these.length) html += group(kind[1], these, true);
            });
            html += '</section>';
        }

        html += '<section class="section" id="blog"><div class="section-head"><h2>Blog</h2></div>'
            + (blog.length ? group('Latest posts', blog, true) : '<p class="empty">No posts yet.</p>')
            + '</section>';

        html += '<section class="section" id="garden">' + garden(notes.nodes) + '</section>';

        box.innerHTML = html;
        var graph = box.querySelector('.garden-graph');
        if (graph) Site.gardenGraph(graph, notes);
        // The page is drawn after loading, so a link to #garden or #blog
        // arrives before its target exists: scroll there now
        if (location.hash) {
            var target = document.getElementById(location.hash.slice(1));
            if (target) target.scrollIntoView();
        }
    });

})();
