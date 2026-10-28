// The animation page (Watch): the videos, in views chosen by buttons. (The reel
// is on the home page and /reel.html, not here.)
//   All      every series and every group as a row (a streaming-style shelf)
//   Series   each series with its poster, description and episodes
//   <group>  one button per other top-level heading in content/animation.org
//            ("Projects"...): its videos as a grid, split into its subsections
// The buttons follow the file: add a heading there and a button appears.
// animation.html?play=<group>/<video> opens that video straight away (search
// links here).

(function () {

    var switcher = document.getElementById('view-switch');
    var views = document.getElementById('views');
    var videos = [];    // every card that opens the lightbox, by data-index

    function seriesHref(series) { return '/series.html?s=' + series.slug; }
    function episodeHref(ep) { return '/series.html?s=' + ep.series.slug + '&e=' + ep.slug; }
    function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

    // A card that plays the video in the lightbox
    function videoCard(video) {
        videos.push(video);
        return Site.card({
            attrs: 'data-index="' + (videos.length - 1) + '"',
            thumb: Site.thumbOf(video),
            title: video.title,
            meta: Site.prettyDate(video.date),
            play: true
        });
    }

    // A card that opens an episode on its series page
    function episodeCard(ep) {
        return Site.card({
            href: episodeHref(ep),
            thumb: Site.thumbOf(ep),
            title: ep.title,
            meta: [ep.season, 'Episode ' + ep.number].filter(Boolean).join(' · '),
            play: true
        });
    }

    // One row of the All view: a heading, a link, and a sideways-scrolling shelf
    function row(title, link, cards) {
        return '<section class="section">'
            + '<div class="section-head"><h2>' + Site.esc(title) + '</h2>' + link + '</div>'
            + '<div class="shelf">' + cards.join('') + '</div></section>';
    }

    function allView(data) {
        var rows = data.series.filter(function (s) { return s.entries.length; }).map(function (s) {
            return row(s.title,
                       '<a href="' + seriesHref(s) + '">' + plural(s.entries.length, 'episode') + ' →</a>',
                       s.entries.map(episodeCard));
        }).concat(data.groups.map(function (g) {
            return row(g.title,
                       '<a href="#' + g.slug + '">' + (g.items.length > 1 ? 'all ' + g.items.length + ' →' : 'see →') + '</a>',
                       g.items.map(videoCard));
        }));
        return rows.length ? rows.join('') : '<p class="empty">No videos yet.</p>';
    }

    function seriesView(data) {
        return data.series.length
            ? data.series.map(function (series) {
                return Site.seriesBlock(series, { unit: 'episode', href: seriesHref, entryHref: episodeHref });
            }).join('')
            : '<p class="empty">No series yet.</p>';
    }

    function play(video) {
        Site.openLightbox(
            '<h2>' + Site.esc(video.title) + '</h2>'
            + Site.player(video.video, true, video.title)
            + (video.description || '')
            + '<div class="prose-actions">'
            + shareButton('/animation.html?play=' + encodeURIComponent(video.id), video.title + ' — Jack Gilmore')
            + '</div>');
    }

    function groupView(group) {
        return group.sections.map(function (section) {
            return (section.title ? '<h3 class="subsection">' + Site.esc(section.title) + '</h3>' : '')
                + '<div class="grid">' + section.items.map(videoCard).join('') + '</div>';
        }).join('');
    }

    Site.loadAnimation()
        .then(function (data) {

            // The views, and a button for each: [name, label, html]
            var list = [['all', 'All', allView(data)]];
            if (data.series.length) list.push(['series', 'Series', seriesView(data)]);
            data.groups.forEach(function (g) { list.push([g.slug, g.title, groupView(g)]); });

            switcher.innerHTML = list.length > 1 ? list.map(function (v) {
                return '<button type="button" data-view="' + v[0] + '">' + Site.esc(v[1]) + '</button>';
            }).join('') : '';
            views.innerHTML = list.map(function (v) {
                return '<section id="view-' + v[0] + '">' + v[2] + '</section>';
            }).join('');
            Site.viewSwitch();

            // Any video card, in any view, opens the lightbox
            views.addEventListener('click', function (e) {
                var card = e.target.closest('[data-index]');
                if (!card) return;
                play(videos[+card.getAttribute('data-index')]);
            });

            // A link to one video: play it, then tidy the address (keeping the
            // view) so reloading doesn't open it again
            var wanted = Site.param('play');
            var linked = data.gallery.filter(function (v) { return v.id === wanted; })[0];
            if (linked) {
                play(linked);
                history.replaceState(null, '', location.pathname + location.hash);
            }
        })
        .catch(function (error) {
            Site.failed(views, error);
        });

})();
