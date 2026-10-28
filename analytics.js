// Visitor counts, by GoatCounter (goatcounter.com): no cookies and nothing
// personal is kept, so there's no cookie banner. Emacs shows the numbers
// (hyper-s, or SPC n w s; "Stats" in config.org's Website section).
//
// Besides each page view, it counts a few events, once per page view each:
//   watch/TITLE      a video started (opened to play, or clicked into)
//   finished/PATH    scrolled to the end of a piece, garden note or comic
//   out/SITE         followed a link off the site (instagram.com, ...)
//   contact/email    clicked the email address
//   share/reel       the "Share my reel" button
//
// Previews on localhost aren't counted. To stop counting your own visits on
// the live site, open https://jackgilmorecreative.com/#toggle-goatcounter once
// in each browser you use.

(function () {

    var CODE = 'jackgilmorecreative';   // the site at https://CODE.goatcounter.com

    var waiting = [];
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://gc.zgo.at/count.js';
    script.setAttribute('data-goatcounter', 'https://' + CODE + '.goatcounter.com/count');
    script.onload = function () {
        waiting.forEach(function (send) { send(); });
        waiting = null;
    };
    document.head.appendChild(script);

    // Count an event (once per page view): countEvent('watch', 'Ep 2: Hello').
    // Its own global, as catalog.js replaces the whole Site object
    var sent = {};
    function track(kind, name) {
        var path = kind + '/' + name;
        if (sent[path]) return;
        sent[path] = true;
        var send = function () {
            if (window.goatcounter && window.goatcounter.count) {
                window.goatcounter.count({ path: path, title: name, event: true });
            }
        };
        if (waiting) waiting.push(send); else send();
    }
    window.countEvent = track;

    // Clicking into a video player moves the focus into its frame, which
    // takes it from this window: that's someone pressing play
    window.addEventListener('blur', function () {
        setTimeout(function () {
            var frame = document.activeElement;
            if (frame && frame.tagName === 'IFRAME' && frame.closest('.player')) {
                track('watch', frame.title || frame.src);
            }
        }, 0);
    });

    // A video file in the repo (an .mp4) says when it starts playing itself.
    // `play` doesn't bubble, so listen on the way down (true)
    document.addEventListener('play', function (e) {
        if (e.target.closest && e.target.closest('.player')) track('watch', e.target.title || e.target.src);
    }, true);

    // Links off the site, and the email address
    document.addEventListener('click', function (e) {
        var link = e.target.closest && e.target.closest('a[href]');
        if (!link) return;
        if (link.protocol === 'mailto:') track('contact', 'email');
        else if (link.host && link.host !== location.host) track('out', link.host.replace(/^www\./, ''));
    });

    // Reading to the end: within a screen of the bottom of a piece, a garden
    // note or a comic (the pages that are worth finishing)
    var reading = /^\/(writing|garden)\/|^\/comic\.html/.test(location.pathname);
    function atEnd() {
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - window.innerHeight
            && document.documentElement.scrollHeight > 2 * window.innerHeight) {
            track('finished', location.pathname + location.search);
            window.removeEventListener('scroll', atEnd);
        }
    }
    if (reading) window.addEventListener('scroll', atEnd, { passive: true });

})();
