// Keyboard shortcuts, on every page (nav.js loads this). Press ? for the list.
//
//   ⌘K or /     search (that one lives in search.js)
//   g, then h w r g l a   go to Home (everything), Watch, Read, Garden, Reel, About
//   t           light / dark mode
//   c           copy this page's link
//   u           up a level (the last link in the breadcrumbs)
//   [ and ]     previous / next: episode, issue, or the page's view buttons
//   1–9         pick one of the page's view buttons (All, Series, Comics…)
//   f           find a note in the garden graph
//
// A page marks its own previous/next buttons with data-key="prev"/"next".
// None of this fires while typing in a box, or with Cmd/Ctrl/Alt held.

(function () {

    var GO = [
        ['h', '/', 'Home'],
        ['w', '/animation.html', 'Watch'],
        ['r', '/read.html', 'Read'],
        ['g', '/garden.html', 'Garden'],
        ['l', '/reel.html', 'Reel'],
        ['a', '/about.html', 'About']
    ];
    var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    var waitingForGo = null;    // timer while waiting for the key after g
    var hint, help, opener;

    function k(key) { return '<kbd>' + key + '</kbd>'; }


    // ============ WHAT EACH KEY FINDS ON THIS PAGE ============

    function viewButtons() { return [].slice.call(document.querySelectorAll('.view-switch button')); }

    // The page's own previous/next button, or else the view button beside the current one
    function step(dir) {
        var marked = document.querySelector('[data-key="' + dir + '"]');
        if (marked) return marked;
        var views = viewButtons();
        var at = views.map(function (b) { return b.getAttribute('aria-pressed'); }).indexOf('true');
        return at === -1 ? null : views[at + (dir === 'next' ? 1 : -1)] || null;
    }

    function upLink() {
        var links = document.querySelectorAll('.crumbs a');
        if (links.length) return links[links.length - 1].getAttribute('href');
        var path = location.pathname;
        return path === '/' || path === '/index.html' ? null : '/';
    }

    function graphToggle() { return document.querySelector('.graph-search-toggle'); }


    // ============ THE LITTLE MESSAGE ABOVE THE FOOTER ============

    function say(html, ms) {
        if (!hint) {
            document.body.insertAdjacentHTML('beforeend', '<div class="key-hint" role="status"></div>');
            hint = document.body.lastElementChild;
        }
        hint.innerHTML = html;
        hint.classList.add('show');
        clearTimeout(hint.timer);
        hint.timer = setTimeout(hush, ms || 1600);
    }

    function hush() {
        if (hint) hint.classList.remove('show');
    }


    // ============ THE LIST (?) ============

    // [keys, what it does, is it any use on this page?]
    function rows() {
        var always = function () { return true; };
        return [
            ['Anywhere', [
                [k(mac ? '⌘' : 'ctrl') + k('K') + ' or ' + k('/'), 'Search', always],
                [k('t'), 'Light / dark mode', always],
                [k('c'), 'Copy the link to this page', always],
                [k('u'), 'Up a level', function () { return !!upLink(); }],
                [k('?'), 'This list', always]
            ]],
            ['Go to', GO.map(function (g) {
                return [k('g') + ' ' + k(g[0]), g[2], always];
            })],
            ['On this page', [
                [k('[') + ' ' + k(']'), 'Previous / next', function () { return !!(step('prev') || step('next')); }],
                [k('1') + '–' + k('9'), 'Pick a view (All, Series…)', function () { return viewButtons().length > 0; }],
                [k('f'), 'Find a note in the graph', function () { return !!graphToggle(); }],
                [k('esc'), 'Close whatever’s open', always]
            ]]
        ];
    }

    function openHelp() {
        if (!help) {
            document.body.insertAdjacentHTML('beforeend',
                '<div class="search-backdrop keys-backdrop" hidden>'
                + '<div class="search-panel keys-panel" role="dialog" aria-modal="true" aria-labelledby="keys-title" tabindex="-1">'
                + '<div class="keys-head"><h2 id="keys-title">Keyboard shortcuts</h2>' + k('esc') + '</div>'
                + '<div class="keys-body"></div></div></div>');
            help = document.body.lastElementChild;
            help.addEventListener('click', function (e) {
                if (e.target === help) closeHelp();
            });
        }
        help.querySelector('.keys-body').innerHTML = rows().map(function (group) {
            return '<section><h3>' + group[0] + '</h3><dl>' + group[1].map(function (r) {
                return '<div class="keys-row' + (r[2]() ? '' : ' unavailable') + '"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
            }).join('') + '</dl></section>';
        }).join('');
        opener = document.activeElement;
        help.hidden = false;
        help.offsetWidth;   // so the fade-in runs
        help.classList.add('open');
        help.querySelector('.keys-panel').focus();
    }

    function closeHelp() {
        help.classList.remove('open');
        help.hidden = true;
        if (opener && opener.focus) opener.focus();
    }


    // ============ THE KEYS ============

    function typing(target) {
        return target.closest && target.closest('input, textarea, select, [contenteditable="true"]');
    }

    function searchOpen() {
        var panel = document.querySelector('.search-backdrop:not(.keys-backdrop)');
        return panel && !panel.hidden;
    }

    function press(el) {
        if (!el) return false;
        el.click();
        return true;
    }

    document.addEventListener('keydown', function (e) {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
        if (typing(e.target) || searchOpen()) return;
        var key = e.key;

        // The list is open: only closing it
        if (help && !help.hidden) {
            if (key === 'Escape' || key === '?') {
                e.preventDefault();
                closeHelp();
            }
            return;
        }

        // The key after g
        if (waitingForGo) {
            clearTimeout(waitingForGo);
            waitingForGo = null;
            hush();
            var go = GO.filter(function (g) { return g[0] === key.toLowerCase(); })[0];
            if (go) {
                e.preventDefault();
                location.href = go[1];
            }
            return;
        }

        var done = true;
        if (key === '?') {
            openHelp();
        } else if (key === 'g') {
            say(k('g') + ' then ' + GO.map(function (g) { return k(g[0]) + ' ' + g[2].toLowerCase(); }).join('  '), 1500);
            waitingForGo = setTimeout(function () { waitingForGo = null; }, 1500);
        } else if (key === 't') {
            var toggle = document.querySelector('.theme-toggle');
            if (toggle) {
                toggle.click();
                say(document.documentElement.getAttribute('data-theme') === 'dark' ? 'Dark mode' : 'Light mode');
            }
        } else if (key === 'c') {
            var url = location.href;
            var copied = function () { say('Link copied'); };
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(url).then(copied, function () { window.prompt('Copy this link:', url); });
            } else {
                window.prompt('Copy this link:', url);
            }
        } else if (key === 'u') {
            var up = upLink();
            if (up) location.href = up;
            else done = false;
        } else if (key === '[' || key === ']') {
            done = press(step(key === ']' ? 'next' : 'prev'));
        } else if (/^[1-9]$/.test(key)) {
            done = press(viewButtons()[+key - 1]);
        } else if (key === 'f' && graphToggle()) {
            var toggleGraph = graphToggle();
            toggleGraph.closest('.garden-graph').scrollIntoView({ block: 'center', behavior: 'smooth' });
            var box = toggleGraph.parentNode.querySelector('.graph-search-box');
            if (box.hidden) toggleGraph.click();
            else box.querySelector('input').focus();
        } else {
            done = false;
        }
        if (done) e.preventDefault();
    });

})();
