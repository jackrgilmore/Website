// Loaded in <head>, before the page draws, so the theme applies straight away
// instead of flashing the other one first. The site follows the device's
// light/dark setting. Clicking the toggle overrides it for this visit only
// (sessionStorage); a new visit, or changing the device's setting, goes back
// to following the device.
(function () {
    try {
        localStorage.removeItem('theme');   // a choice saved for good, from before
        var chosen = sessionStorage.getItem('theme');
        if (chosen === 'light' || chosen === 'dark') {
            document.documentElement.setAttribute('data-theme', chosen);
        }
    } catch (e) { }
})();
