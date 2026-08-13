/* Combination Details View Component Template */
(function() {
  const container = document.querySelector('main.main-content');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', `
    <section id="combinationDetailsView" class="view-page">
      <div id="combinationDetailsContent"></div>
    </section>
  `);
})();
