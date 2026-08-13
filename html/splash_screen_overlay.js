/* Splash Screen Overlay Component Template */
(function() {
  const container = document.body;
  if (!container) return;
  container.insertAdjacentHTML('afterbegin', `
    <div id="splashScreen" class="splash-screen">
      <div class="splash-bg-blur">
        <video src="media/splash-video.mp4" autoplay loop muted playsinline class="splash-bg-video"></video>
      </div>
      <div class="splash-content">
        <img src="media/title-icon.png" class="splash-logo-img" alt="SLD Logo" onerror="this.style.display='none'">
        <div class="splash-title">SLD</div>
        <div class="splash-subtitle">Sex, Love, Dreams</div>
      </div>
    </div>
  `);
})();
