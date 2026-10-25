// The animation page: the reel, then every video as a Gallery or by Series.
// Everything comes from content/animation.org.

(function () {

    var featured = document.getElementById('featured');
    var galleryBox = document.getElementById('view-gallery');
    var seriesBox = document.getElementById('view-series');

    Site.viewSwitch();

    Site.loadAnimation()
        .then(function (data) {

            // Featured reel
            if (data.reel) {
                featured.innerHTML = Site.player(data.reel.video, false, data.reel.title);
            } else {
                featured.remove();
            }

            // Gallery: every project, plus every episode that has a video
            var videos = data.gallery.slice();
            data.series.forEach(function (series) {
                series.entries.forEach(function (episode) {
                    if (episode.video) videos.push(episode);
                });
            });

            if (!videos.length) {
                galleryBox.innerHTML = '<p class="empty">No videos yet.</p>';
            } else {
                galleryBox.innerHTML = '<div class="grid">' + videos.map(function (video, i) {
                    return Site.card({
                        attrs: 'data-index="' + i + '"',
                        thumb: Site.thumbOf(video),
                        title: video.title,
                        meta: video.series
                            ? video.series.title + ' · Episode ' + video.number
                            : Site.prettyDate(video.date),
                        play: true
                    });
                }).join('') + '</div>';

                galleryBox.addEventListener('click', function (e) {
                    var card = e.target.closest('[data-index]');
                    if (!card) return;
                    var video = videos[+card.getAttribute('data-index')];
                    Site.openLightbox(
                        '<h2>' + Site.esc(video.title) + '</h2>'
                        + Site.player(video.video, true, video.title)
                        + (video.description || '')
                        + (video.series
                            ? '<p><a href="/series.html?s=' + video.series.slug + '&e=' + video.slug + '">More ' + Site.esc(video.series.title) + ' →</a></p>'
                            : ''));
                });
            }

            // Series: one shelf per show
            seriesBox.innerHTML = data.series.length
                ? data.series.map(function (series) {
                    return Site.seriesBlock(series, {
                        unit: 'episode',
                        href: function (s) { return '/series.html?s=' + s.slug; },
                        entryHref: function (ep) { return '/series.html?s=' + ep.series.slug + '&e=' + ep.slug; }
                    });
                }).join('')
                : '<p class="empty">No series yet.</p>';
        })
        .catch(function (error) {
            featured.remove();
            Site.failed(galleryBox, error);
        });

})();
