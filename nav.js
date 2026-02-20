document.addEventListener('DOMContentLoaded', function () {

    // Build the nav
    var navbar = document.getElementById('replace_with_navbar');
    navbar.insertAdjacentHTML('afterend', '\
        <nav class="site-nav">\
            <a href="index.html" class="nav-name">Jack Gilmore</a>\
            <div class="nav-links">\
                <a href="animation.html">animation</a>\
                <a href="writing.html">writing</a>\
            </div>\
        </nav>\
    ');

    // Figure out which page we're on
    var path = window.location.pathname.split('/').pop().toLowerCase();
    path = path.split('?')[0].split('#')[0];

    if (!path || path === '/' || path === '') {
        path = 'index.html';
    }

    // Highlight the matching link
    var links = document.querySelectorAll('.site-nav a');
    for (var i = 0; i < links.length; i++) {
        var href = links[i].getAttribute('href').toLowerCase();
        if (href === path) {
            links[i].classList.add('active');
        }
    }

});