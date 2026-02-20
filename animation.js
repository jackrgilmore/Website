document.addEventListener('DOMContentLoaded', function () {

    // ============ CONFIG ============
    var FILE = 'videos.txt';

    // ============ DOM ============
    var featuredBox = document.getElementById('featured-container');
    var gridBox = document.getElementById('gallery-grid');
    var lightbox = document.getElementById('lightbox');
    var lbIframe = document.getElementById('lightbox-iframe');
    var lbBg = document.querySelector('.lightbox-bg');
    var lbClose = document.querySelector('.lightbox-x');


    // ============ URL PARSING ============

    function parseURL(url) {
        url = url.trim();

        // YouTube
        var ytPatterns = [
            /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
            /youtu\.be\/([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
        ];

        for (var i = 0; i < ytPatterns.length; i++) {
            var m = url.match(ytPatterns[i]);
            if (m) return { type: 'youtube', id: m[1] };
        }

        // Vimeo
        var vmPatterns = [
            /vimeo\.com\/(\d+)/,
            /player\.vimeo\.com\/video\/(\d+)/
        ];

        for (var j = 0; j < vmPatterns.length; j++) {
            var v = url.match(vmPatterns[j]);
            if (v) return { type: 'vimeo', id: v[1] };
        }

        return null;
    }


    // ============ HELPERS ============

    function thumb(video) {
        if (video.type === 'youtube') {
            return 'https://img.youtube.com/vi/' + video.id + '/mqdefault.jpg';
        }
        if (video.type === 'vimeo') {
            return 'https://vumbnail.com/' + video.id + '.jpg';
        }
        return '';
    }

    function embed(video, autoplay) {
        if (video.type === 'youtube') {
            if (autoplay) {
                return 'https://www.youtube.com/embed/' + video.id + '?autoplay=1&rel=0';
            }
            return 'https://www.youtube.com/embed/' + video.id + '?rel=0';
        }
        if (video.type === 'vimeo') {
            if (autoplay) {
                return 'https://player.vimeo.com/video/' + video.id + '?autoplay=1';
            }
            return 'https://player.vimeo.com/video/' + video.id;
        }
        return '';
    }


    // ============ PARSE TEXT FILE ============

    function parseList(text) {
        var videos = [];
        var lines = text.split('\n');

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();

            // Skip empty lines and comments
            if (!line || line.charAt(0) === '#') continue;

            // Split on pipe: "Title | URL"
            var parts = line.split('|');
            if (parts.length < 2) continue;

            var title = parts[0].trim();
            var url = parts[1].trim();
            var parsed = parseURL(url);

            if (parsed) {
                videos.push({
                    title: title,
                    type: parsed.type,
                    id: parsed.id
                });
            } else {
                console.warn('Could not parse URL: ' + url);
            }
        }

        return videos;
    }


    // ============ BUILD HTML ============

    var playSVG = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
        + '<path d="M133 440a35.37 35.37 0 01-17.5-4.67c-12-6.8-19.46-20-19.46-34.33'
        + 'V111c0-14.37 7.46-27.53 19.46-34.33a35.13 35.13 0 0135.77.45l247.85 148.36'
        + 'a36 36 0 010 61l-247.89 148.4A35.5 35.5 0 01133 440z"/></svg>';

    function buildFeatured(video) {
        return ''
            + '<div class="featured-frame">'
            + '<iframe src="' + embed(video, false) + '"'
            + ' title="' + video.title + '"'
            + ' frameborder="0"'
            + ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"'
            + ' allowfullscreen></iframe>'
            + '</div>'
            + '<h3 class="featured-title">' + video.title + '</h3>';
    }

    function buildCard(video, index) {
        return ''
            + '<article class="card" style="animation-delay: ' + (index * 0.08) + 's">'
            + '<figure class="card-thumb">'
            + '<img src="' + thumb(video) + '"'
            + ' alt="' + video.title + '"'
            + ' loading="lazy">'
            + '<button class="card-play"'
            + ' data-id="' + video.id + '"'
            + ' data-type="' + video.type + '"'
            + ' aria-label="Play ' + video.title + '">'
            + playSVG
            + '</button>'
            + '</figure>'
            + '<h3 class="card-title">' + video.title + '</h3>'
            + '</article>';
    }


    // ============ LIGHTBOX ============

    function openLightbox(id, type) {
        lbIframe.src = embed({ type: type, id: id }, true);
        lightbox.classList.add('open');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        lightbox.classList.remove('open');
        lightbox.setAttribute('aria-hidden', 'true');
        lbIframe.src = '';
        document.body.style.overflow = '';
    }

    // Close button
    lbClose.addEventListener('click', closeLightbox);

    // Click background
    lbBg.addEventListener('click', closeLightbox);

    // Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && lightbox.classList.contains('open')) {
            closeLightbox();
        }
    });


    // ============ WIRE UP PLAY BUTTONS ============

    function attachEvents() {
        // Play buttons
        var buttons = document.querySelectorAll('.card-play');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                openLightbox(
                    this.getAttribute('data-id'),
                    this.getAttribute('data-type')
                );
            });
        }

        // Clicking thumbnail area also plays
        var thumbs = document.querySelectorAll('.card-thumb');
        for (var j = 0; j < thumbs.length; j++) {
            thumbs[j].addEventListener('click', function () {
                var btn = this.querySelector('.card-play');
                if (btn) btn.click();
            });
        }
    }


    // ============ FETCH & RENDER ============

    fetch(FILE)
        .then(function (response) {
            if (!response.ok) {
                throw new Error('Could not load ' + FILE + ' (' + response.status + ')');
            }
            return response.text();
        })
        .then(function (text) {
            var videos = parseList(text);

            // Nothing found
            if (videos.length === 0) {
                featuredBox.innerHTML = '<p class="error-msg">No videos found in videos.txt</p>';
                gridBox.innerHTML = '';
                return;
            }

            // First video = featured
            featuredBox.innerHTML = buildFeatured(videos[0]);

            // Rest = grid
            if (videos.length > 1) {
                var html = '';
                for (var i = 1; i < videos.length; i++) {
                    html += buildCard(videos[i], i - 1);
                }
                gridBox.innerHTML = html;
            } else {
                gridBox.innerHTML = '<p class="loading">Add more videos to videos.txt</p>';
            }

            // Attach click events after HTML is in the DOM
            attachEvents();
        })
        .catch(function (error) {
            console.error('Error loading videos:', error);
            featuredBox.innerHTML = ''
                + '<p class="error-msg">'
                + '⚠️ Could not load videos.txt<br>'
                + '<small>Make sure the file exists and you are running a local server (not file://)</small>'
                + '</p>';
            gridBox.innerHTML = '';
        });

});