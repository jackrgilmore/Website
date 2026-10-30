// Under a garden note (pages publish.el makes from org-roam): the notes near
// it, drawn by Site.gardenGraph with this note in the middle. The section
// stays hidden if the note links to no other public note.

(function () {

    var section = document.querySelector('.note-graph-section');
    if (!section) return;
    var holder = section.querySelector('.garden-graph');

    Site.loadJSON('/data/garden.json', { nodes: [], links: [] }).then(function (garden) {
        section.hidden = false; // shown first, so the graph knows its size
        if (!Site.gardenGraph(holder, garden, { current: holder.getAttribute('data-note') })) {
            section.remove();
        }
    });

})();
