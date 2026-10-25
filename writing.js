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

    // The garden: each public note, with its tags and how many notes it links with
    function garden(notes, links) {
        var degree = {};
        links.forEach(function (l) {
            degree[l.source] = (degree[l.source] || 0) + 1;
            degree[l.target] = (degree[l.target] || 0) + 1;
        });
        var head = '<div class="section-head"><h2>Garden</h2>'
            + (notes.length ? '<a href="/dashboard.html#garden">see how they connect →</a>' : '') + '</div>'
            + '<p class="section-intro">Notes in progress: ideas, research and half-formed thoughts, linked together.</p>';
        if (!notes.length) return head + '<p class="empty">No public notes yet.</p>';
        return head + notes.slice().sort(function (a, b) { return a.title.localeCompare(b.title); })
            .map(function (n) {
                var count = degree[n.id] || 0;
                var meta = n.tags.concat(count ? [count + ' link' + (count === 1 ? '' : 's')] : []).join(' · ');
                return '<a class="entry" href="' + Site.esc(n.id) + '">'
                    + '<span class="entry-title">' + Site.esc(n.title) + '</span>'
                    + '<span class="entry-meta">' + Site.esc(meta) + '</span></a>';
            }).join('');
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

        html += '<section class="section" id="garden">' + garden(notes.nodes, notes.links) + '</section>';

        box.innerHTML = html;
        // The page is drawn after loading, so a link to #garden or #blog
        // arrives before its target exists: scroll there now
        if (location.hash) {
            var target = document.getElementById(location.hash.slice(1));
            if (target) target.scrollIntoView();
        }
    });

})();
