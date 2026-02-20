document.addEventListener('DOMContentLoaded', function () {

    var body = document.getElementById('article-body');

    // Get the filename from the URL
    // Example: article.html?file=my-essay.md
    var params = new URLSearchParams(window.location.search);
    var file = params.get('file');

    // No file specified
    if (!file) {
        body.innerHTML = '<p class="error-msg">No article specified.</p>';
        return;
    }

    // Security: block path traversal attempts
    if (file.indexOf('..') !== -1 || file.indexOf('/') !== -1 || file.indexOf('\\') !== -1) {
        body.innerHTML = '<p class="error-msg">Invalid file path.</p>';
        return;
    }

    // Only allow .md files
    if (file.slice(-3) !== '.md') {
        body.innerHTML = '<p class="error-msg">Only .md files are supported.</p>';
        return;
    }

    // Fetch the markdown file from the writing/ folder
    fetch('writing/' + file)
        .then(function (res) {
            if (!res.ok) throw new Error('File not found: ' + file);
            return res.text();
        })
        .then(function (markdown) {
            // Convert markdown → HTML using marked.js
            body.innerHTML = marked.parse(markdown);

            // Update the page title from the first h1
            var h1 = body.querySelector('h1');
            if (h1) {
                document.title = h1.textContent + ' — Jack Gilmore';
            }
        })
        .catch(function (err) {
            console.error(err);
            body.innerHTML = ''
                + '<p class="error-msg">'
                + '⚠️ Could not load article.<br>'
                + '<small>Make sure <code>writing/' + file + '</code> exists.</small>'
                + '</p>';
        });

});