document.addEventListener('DOMContentLoaded', function () {

    var container = document.getElementById('writing-list');

    console.log('writing.js loaded');
    console.log('Attempting to fetch articles.txt...');

    fetch('articles.txt')
        .then(function (res) {
            console.log('Response status:', res.status);
            console.log('Response ok:', res.ok);

            if (!res.ok) throw new Error('Status ' + res.status);
            return res.text();
        })
        .then(function (text) {
            console.log('Raw file contents:');
            console.log(text);
            console.log('Number of lines:', text.split('\n').length);

            var lines = text.split('\n');
            var groups = {};
            var groupOrder = [];

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();

                if (!line || line.charAt(0) === '#') {
                    console.log('Skipping line ' + i + ':', line);
                    continue;
                }

                var parts = line.split('|');
                console.log('Line ' + i + ' has ' + parts.length + ' parts:', parts);

                if (parts.length < 4) {
                    console.warn('Line ' + i + ' needs 4 parts, has ' + parts.length);
                    continue;
                }

                var title = parts[0].trim();
                var type = parts[1].trim().toLowerCase();
                var pub = parts[2].trim();
                var file = parts[3].trim();

                console.log('Parsed:', title, type, pub, file);

                var groupName = type
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, function (c) {
                        return c.toUpperCase();
                    });

                // FIXED — proper plural rules
                var lastTwo = groupName.slice(-2);
                var secondToLast = lastTwo.charAt(0).toLowerCase();
                var vowels = 'aeiou';

                if (groupName.slice(-1) === 'y' && vowels.indexOf(secondToLast) === -1) {
                    // Consonant + y: "Story" → "Stories"
                    groupName = groupName.slice(0, -1) + 'ies';
                } else if (groupName.slice(-1) !== 's') {
                    // Everything else just gets an "s"
                    // "Essay" → "Essays"
                    // "Poem" → "Poems"
                    // "Article" → "Articles"
                    groupName = groupName + 's';
                }

                if (!groups[groupName]) {
                    groups[groupName] = [];
                    groupOrder.push(groupName);
                }

                groups[groupName].push({
                    title: title,
                    pub: pub,
                    file: file
                });
            }

            console.log('Groups found:', groupOrder);
            console.log('Total groups:', groupOrder.length);

            if (groupOrder.length === 0) {
                container.innerHTML = '<p class="loading">No articles found in articles.txt</p>';
                return;
            }

            var html = '';

            for (var g = 0; g < groupOrder.length; g++) {
                var name = groupOrder[g];
                var items = groups[name];

                html += '<section class="writing-group">';
                html += '<h2>' + name + '</h2>';

                for (var j = 0; j < items.length; j++) {
                    var item = items[j];
                    var link = 'article.html?file=' + encodeURIComponent(item.file);

                    html += '<a href="' + link + '" class="writing-entry">';
                    html += '<span class="entry-title">' + item.title + '</span>';
                    html += '<span class="entry-pub">' + item.pub + '</span>';
                    html += '</a>';
                }

                html += '</section>';
            }

            container.innerHTML = html;
            console.log('Done! Articles rendered.');
        })
        .catch(function (err) {
            console.error('FETCH ERROR:', err);
            container.innerHTML = ''
                + '<p class="error-msg">'
                + '⚠️ Could not load articles.txt<br>'
                + '<small>' + err.message + '</small>'
                + '</p>';
        });

});