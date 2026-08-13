/* Subject Details View Component Template */
(function() {
  const container = document.querySelector('main.main-content');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', `
    <section id="subjectDetailsView" class="view-page">
      <div id="subjectDetailsContent"></div>
    </section>
  `);
})();
