/* Event Details View Component Template */
(function() {
  const container = document.querySelector('main.main-content');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', `
    <section id="eventDetailsView" class="view-page">
      <div id="eventDetailsPageContent"></div>
    </section>
  `);
})();
