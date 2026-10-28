// The nav bar, light/dark toggle and footer, added to every page.
// Load it with <script src="/nav.js" defer></script>.

// Icons (from Bootstrap Icons), drawn inline so no icon font is needed
var ICONS = {
    instagram: 'M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.9 3.9 0 0 0-1.417.923A3.9 3.9 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.9 3.9 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.9 3.9 0 0 0-.923-1.417A3.9 3.9 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599s.453.546.598.92c.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.5 2.5 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.5 2.5 0 0 1-.92-.598 2.5 2.5 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233s.008-2.388.046-3.231c.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92s.546-.453.92-.598c.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92m-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217m0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334',
    youtube: 'M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.108-.082 2.06l-.008.105-.009.104c-.05.572-.124 1.14-.235 1.558a2.01 2.01 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.01 2.01 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31 31 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.01 2.01 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.172-.006.086-.003.171-.007A100 100 0 0 1 7.858 2zM6.4 5.209v4.818l4.157-2.408z',
    linkedin: 'M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z',
    tiktok: 'M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z',
    vimeo: 'M15.992 4.204q-.106 2.334-3.262 6.393-3.263 4.243-5.522 4.243-1.4 0-2.367-2.583L3.55 7.523Q2.83 4.939 2.007 4.94q-.178.001-1.254.754L0 4.724a210 210 0 0 0 2.334-2.081q1.581-1.364 2.373-1.437 1.865-.185 2.298 2.553.466 2.952.646 3.666.54 2.447 1.186 2.445.5 0 1.508-1.587 1.006-1.587 1.077-2.415.144-1.37-1.077-1.37a3 3 0 0 0-1.185.261q1.183-3.86 4.508-3.756 2.466.075 2.324 3.2z',
    email: 'M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1zm13 2.383-4.708 2.825L15 11.105zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741M1 11.105l4.708-2.897L1 5.383z',
    sun: 'M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708',
    moon: 'M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278M4.858 1.311A7.27 7.27 0 0 0 1.025 7.71c0 4.02 3.279 7.276 7.319 7.276a7.32 7.32 0 0 0 5.205-2.162q-.506.063-1.029.063c-4.61 0-8.343-3.714-8.343-8.29 0-1.167.242-2.278.681-3.286',
    share: 'M3.5 6a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-8a.5.5 0 0 0-.5-.5h-2a.5.5 0 0 1 0-1h2A1.5 1.5 0 0 1 14 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 14.5v-8A1.5 1.5 0 0 1 3.5 5h2a.5.5 0 0 1 0 1z M7.646.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 1.707V10.5a.5.5 0 0 1-1 0V1.707L5.354 3.854a.5.5 0 1 1-.708-.708z',
    check: 'M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0',
    rss: 'M5.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m-3-8.5a1 1 0 0 1 1-1c5.523 0 10 4.477 10 10a1 1 0 1 1-2 0 8 8 0 0 0-8-8 1 1 0 0 1-1-1m0 4a1 1 0 0 1 1-1 6 6 0 0 1 6 6 1 1 0 1 1-2 0 4 4 0 0 0-4-4 1 1 0 0 1-1-1',
    search: 'M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0',
    play: 'm11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393',
    link: 'M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z'
};

function icon(name) {
    return '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="' + ICONS[name] + '"/></svg>';
}

// A share button for a page or thing on one: shares URL (default: the page's
// own address) on a phone, copies it on a computer. Just an icon. Pages made
// in the browser call this; generated pages just have
// <button class="share-button" data-share>.
function shareButton(url, title) {
    return '<button class="share-button" type="button" data-share aria-label="Share" title="Share"'
        + (url ? ' data-share-url="' + url.replace(/"/g, '&quot;') + '"' : '')
        + (title ? ' data-share-title="' + title.replace(/"/g, '&quot;') + '"' : '')
        + '>' + icon('share') + '</button>';
}

(function () {

    // ============ NAV ============

    // Watch (animation), Read (comics, writing, the blog), Garden, the reel,
    // and About (the page to send people). The home page has everything.
    var links = [
        ['/animation.html', 'watch'],
        ['/read.html', 'read'],
        ['/garden.html', 'garden'],
        ['/reel.html', 'reel'],
        ['/about.html', 'about']
    ];

    // Which section we're in: pages inside a section count as that section
    var path = window.location.pathname.toLowerCase();
    var section = path;
    if (path === '/series.html') section = '/animation.html';
    if (path === '/comic.html' || path === '/comic-series.html' || path.indexOf('/writing/') === 0) section = '/read.html';
    if (path.indexOf('/garden/') === 0) section = '/garden.html';

    var html = '<nav class="site-nav"><a href="/" class="nav-name">Jack Gilmore</a><div class="nav-links">';
    for (var i = 0; i < links.length; i++) {
        var active = links[i][0] === section ? ' class="active" aria-current="page"' : '';
        html += '<a href="' + links[i][0] + '"' + active + '>' + links[i][1] + '</a>';
    }
    var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    html += '</div><button class="nav-search" type="button" aria-label="Search the site" title="Search (' + (mac ? '⌘K' : 'Ctrl+K') + ')">'
        + icon('search') + '<span class="nav-search-label">Search</span><kbd>' + (mac ? '⌘K' : 'Ctrl K') + '</kbd></button>'
        + '<button class="nav-feed" type="button" aria-label="Follow the blog" aria-expanded="false" aria-controls="feed-pop" title="Follow the blog (RSS)">'
        + icon('rss') + '</button>'
        + '<button class="theme-toggle" type="button"></button></nav>';
    document.body.insertAdjacentHTML('afterbegin', html);


    // ============ FOLLOW THE BLOG (EMAIL, RSS) ============
    // The RSS button opens a small panel with two ways to follow:
    // - By email: the address goes to Buttondown (the newsletter service, its
    //   account NEWSLETTER), which asks the reader to confirm it. Emacs emails
    //   each new post to everyone signed up when it's published.
    // - RSS: the feed's address to copy into a reader app, and one-click
    //   buttons for the popular ones. feed.xml is written by publish.el.
    // Set NEWSLETTER to '' to leave the email part out.

    var NEWSLETTER = 'jackgilmorecreative';
    var feedUrl = 'https://jackgilmorecreative.com/feed.xml';
    var feedEnc = encodeURIComponent(feedUrl);
    document.querySelector('.site-nav').insertAdjacentHTML('beforeend',
        '<div class="feed-pop" id="feed-pop" role="dialog" aria-label="Follow the blog" hidden>'
        + '<p class="feed-pop-title">Follow the blog</p>'
        + (NEWSLETTER
            ? '<p class="feed-pop-text">Get each new post by email:</p>'
              + '<form class="feed-pop-copy feed-pop-email" method="post" target="_blank"'
              + ' action="https://buttondown.com/api/emails/embed-subscribe/' + NEWSLETTER + '">'
              + '<input type="email" name="email" required placeholder="you@example.com" aria-label="Your email address" autocomplete="email">'
              + '<input type="hidden" name="embed" value="1">'
              + '<button class="button button-primary" type="submit">Subscribe</button></form>'
              + '<p class="feed-pop-done" hidden>Almost done: check your inbox to confirm.</p>'
              + '<p class="feed-pop-or"><span>or follow with RSS</span></p>'
            : '<p class="feed-pop-text">Get new posts as soon as they\'re up. Copy the feed into any reader app, or pick one:</p>')
        + '<div class="feed-pop-copy"><input type="text" readonly value="' + feedUrl + '" aria-label="Feed address">'
        + '<button class="button' + (NEWSLETTER ? '' : ' button-primary') + ' feed-pop-copy-button" type="button">Copy</button></div>'
        + '<div class="feed-pop-apps">'
        + '<a href="https://feedly.com/i/subscription/feed/' + feedEnc + '" target="_blank" rel="noopener">Feedly</a>'
        + '<a href="https://www.inoreader.com/?add_feed=' + feedEnc + '" target="_blank" rel="noopener">Inoreader</a>'
        + '<a href="feed:' + feedUrl + '">Reader app</a></div>'
        + '<p class="feed-pop-help">RSS is free and needs no account here: your reader checks for new posts for you.</p>'
        + '</div>');

    var feedButton = document.querySelector('.nav-feed');
    var feedPop = document.getElementById('feed-pop');
    var feedCopy = feedPop.querySelector('.feed-pop-copy-button');
    var feedInput = feedPop.querySelector('input[readonly]');
    var emailForm = feedPop.querySelector('.feed-pop-email');

    function showFeed(open) {
        feedPop.hidden = !open;
        feedButton.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) (emailForm ? emailForm.querySelector('input') : feedCopy).focus();
    }

    // Buttondown's confirmation opens in a new tab; this one says what's next
    if (emailForm) {
        emailForm.addEventListener('submit', function () {
            setTimeout(function () {
                emailForm.reset();
                feedPop.querySelector('.feed-pop-done').hidden = false;
            }, 0);
        });
    }

    feedButton.addEventListener('click', function () { showFeed(feedPop.hidden); });
    // Any [data-follow] button on a page (the Blog panel's) opens it too
    document.addEventListener('click', function (e) {
        if (e.target.closest('[data-follow]')) showFeed(true);
        else if (!feedPop.hidden && !feedPop.contains(e.target) && !feedButton.contains(e.target)) showFeed(false);
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !feedPop.hidden) {
            showFeed(false);
            feedButton.focus();
        }
    });

    feedCopy.addEventListener('click', function () {
        function copied() {
            feedCopy.textContent = 'Copied';
            setTimeout(function () { feedCopy.textContent = 'Copy'; }, 1800);
        }
        feedInput.select();
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(feedUrl).then(copied, function () { });
        } else {
            try { if (document.execCommand('copy')) copied(); } catch (e) { }
        }
    });


    // ============ SHARE BUTTONS ============
    // Any [data-share] button, on any page, whenever it was added. On a phone
    // (a touch screen that can share) it opens the share sheet: Messages,
    // Instagram, WhatsApp... On a computer it copies the link: the icon turns
    // into a check mark and "Link copied" pops up just above it.

    // Generated pages' buttons come without their icon: add it (and drop the
    // word "Share" pages published before it was just an icon still have)
    var shares = document.querySelectorAll('button[data-share]');
    for (var b = 0; b < shares.length; b++) {
        var word = shares[b].querySelector('span');
        if (word) word.remove();
        if (!shares[b].querySelector('svg')) shares[b].insertAdjacentHTML('afterbegin', icon('share'));
        shares[b].setAttribute('aria-label', 'Share');
        shares[b].title = 'Share';
    }

    // "Link copied", in a little bubble just above the button
    function popup(button, message) {
        var tip = document.querySelector('.share-tip');
        if (!tip) {
            document.body.insertAdjacentHTML('beforeend', '<div class="share-tip" role="status"></div>');
            tip = document.body.lastElementChild;
        }
        tip.textContent = message;
        var box = button.getBoundingClientRect();
        var half = tip.offsetWidth / 2;
        var x = Math.min(Math.max(box.left + box.width / 2, half + 8), window.innerWidth - half - 8);
        tip.style.left = (x + window.scrollX) + 'px';
        tip.style.top = (box.top + window.scrollY - 8) + 'px';
        tip.classList.add('show');
        clearTimeout(tip.timer);
        tip.timer = setTimeout(function () { tip.classList.remove('show'); }, 1600);
    }

    document.addEventListener('click', function (e) {
        var button = e.target.closest('[data-share]');
        if (!button) return;
        var canonical = document.querySelector('link[rel="canonical"]');
        var url = new URL(button.getAttribute('data-share-url') || (canonical ? canonical.href : location.href),
                          location.href).href;
        var title = button.getAttribute('data-share-title') || document.title;
        if (window.countEvent) countEvent('share', new URL(url).pathname + new URL(url).search);

        if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
            navigator.share({ title: title, url: url }).catch(function () { });
            return;
        }
        function copied() {
            button.innerHTML = icon('check');
            button.classList.add('copied');
            popup(button, 'Link copied');
            clearTimeout(button.shareTimer);
            button.shareTimer = setTimeout(function () {
                button.innerHTML = icon('share');
                button.classList.remove('copied');
            }, 1800);
        }
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(url).then(copied, function () { window.prompt('Copy this link:', url); });
        } else {
            window.prompt('Copy this link:', url);
        }
    });


    // ============ SEARCH AND SHORTCUTS ============
    // The panel the search button opens lives in search.js; the keyboard
    // shortcuts (press ? for the list) in keys.js

    ['/search.js', '/keys.js'].forEach(function (src) {
        var script = document.createElement('script');
        script.src = src;
        document.head.appendChild(script);
    });


    // ============ LIGHT / DARK TOGGLE ============

    var root = document.documentElement;
    var toggle = document.querySelector('.theme-toggle');
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)');

    function currentTheme() {
        return root.getAttribute('data-theme') || (systemDark.matches ? 'dark' : 'light');
    }

    function drawToggle() {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        toggle.innerHTML = icon(next === 'light' ? 'sun' : 'moon');
        toggle.setAttribute('aria-label', 'Switch to ' + next + ' mode');
        toggle.title = 'Switch to ' + next + ' mode (t)';
    }

    // A click overrides the device's setting for this visit (see theme.js)
    toggle.addEventListener('click', function () {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try { sessionStorage.setItem('theme', next); } catch (e) { }
        drawToggle();
    });

    // The device switched (by hand, or at sunset): follow it again
    systemDark.addEventListener('change', function () {
        root.removeAttribute('data-theme');
        try { sessionStorage.removeItem('theme'); } catch (e) { }
        drawToggle();
    });
    drawToggle();


    // ============ FOOTER ============
    // A slim bar that stays at the bottom of the window: the socials, and the
    // way back to everything (the home page)

    var socials = [
        ['https://www.instagram.com/hatguyanimation/', 'instagram', 'Instagram'],
        ['https://www.youtube.com/@jackgilmorecreative', 'youtube', 'YouTube'],
        ['https://www.linkedin.com/in/jack-gilmore-723b58222/', 'linkedin', 'LinkedIn'],
        ['mailto:jackgilmorecreative@gmail.com', 'email', 'Email']
    ];
    var footer = '<footer class="site-footer"><div class="socials">';
    for (var j = 0; j < socials.length; j++) {
        footer += '<a href="' + socials[j][0] + '" aria-label="' + socials[j][2] + '">' + icon(socials[j][1]) + '</a>';
    }
    // Four squares (a grid of everything), which spread apart on hover
    footer += '</div><a class="everything-link" href="/" title="Everything on the site, in one place (g h)"'
        + (path === '/' || path === '/index.html' ? ' aria-current="page"' : '') + '>'
        + '<svg class="everything-icon" viewBox="0 0 16 16" aria-hidden="true">'
        + '<rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.6"/><rect x="9" y="1.5" width="5.5" height="5.5" rx="1.6"/>'
        + '<rect x="1.5" y="9" width="5.5" height="5.5" rx="1.6"/><rect x="9" y="9" width="5.5" height="5.5" rx="1.6"/>'
        + '</svg><span>everything</span></a></footer>';
    document.body.insertAdjacentHTML('beforeend', footer);

    // The squares pop in once a visit, to catch the eye without nagging
    try {
        if (!sessionStorage.getItem('footer-seen')) {
            sessionStorage.setItem('footer-seen', '1');
            document.querySelector('.everything-link').classList.add('hello');
        }
    } catch (e) { }

})();
