/* SLD Details View Component Template */
(function() {
  const container = document.querySelector('main.main-content');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', `
    <section id="sldDetailsView" class="view-page">
      <div id="sldDetailsContent"></div>
    </section>
  `);
})();
