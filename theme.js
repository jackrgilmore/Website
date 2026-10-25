// Loaded in <head>, before the page draws, so a saved light/dark choice
// applies straight away instead of flashing the other theme first.
// With no saved choice the site follows the computer's setting.
(function () {
    try {
        var saved = localStorage.getItem('theme');
        if (saved === 'light' || saved === 'dark') {
            document.documentElement.setAttribute('data-theme', saved);
        }
    } catch (e) { }
})();
