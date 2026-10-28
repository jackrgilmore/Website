// The reel, on the home page and on /reel.html (the link to send people).
// Which video it is comes from #+reel: in content/animation.org.

(function () {

    var box = document.getElementById('reel');
    var title = document.getElementById('reel-title');
    var reelPage = window.location.origin + '/reel.html';

    Site.loadAnimation()
        .then(function (data) {
            if (!data.reel) {
                box.innerHTML = '<p class="empty">No reel yet: add #+reel: to content/animation.org</p>';
                return;
            }
            box.innerHTML = Site.player(data.reel.video, false, data.reel.title);
            if (title) title.textContent = data.reel.title;
        })
        .catch(function (error) { Site.failed(box, error); });

    // Share: the phone's share sheet if there is one, else copy the link
    var buttons = document.querySelectorAll('.share-reel');
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', function () {
            if (window.countEvent) countEvent('share', 'reel');
            if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
                navigator.share({ title: 'Jack Gilmore — Demo Reel', url: reelPage }).catch(function () { });
            } else {
                Site.copyLink(reelPage);
            }
        });
    }

})();
