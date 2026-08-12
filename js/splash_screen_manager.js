/**
 * Fast 0.5s Animated Splash Screen Controller
 */

let splashTimer = null;
let splashFadeTimer = null;
let isSplashActive = false;
let lastSplashDismissTime = 0;

function hideSplashScreen(onComplete) {
  const splash = document.getElementById('splashScreen');
  if (!splash) { if (onComplete) onComplete(); return; }

  if (splashTimer) { clearTimeout(splashTimer); splashTimer = null; }
  if (splashFadeTimer) { clearTimeout(splashFadeTimer); splashFadeTimer = null; }

  splash.classList.remove('active');
  splash.classList.add('fade-out');
  splash.style.pointerEvents = 'none';

  splashFadeTimer = setTimeout(() => {
    splash.style.display = 'none';
    isSplashActive = false;
    lastSplashDismissTime = Date.now();
    if (onComplete) onComplete();
  }, 500);
}

function triggerSplashScreen(onComplete) {
  if (Date.now() - lastSplashDismissTime < 800) {
    if (onComplete) onComplete();
    return;
  }

  const splash = document.getElementById('splashScreen');
  if (!splash) { if (onComplete) onComplete(); return; }

  if (isSplashActive) return;
  isSplashActive = true;

  if (splashTimer) clearTimeout(splashTimer);
  if (splashFadeTimer) clearTimeout(splashFadeTimer);

  splash.classList.remove('fade-out');
  splash.classList.add('active');
  splash.style.pointerEvents = 'auto';
  splash.style.display = 'flex';

  const handleSkip = (e) => {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }
    hideSplashScreen(onComplete);
  };

  splash.onclick = handleSkip;
  splash.onpointerdown = handleSkip;

  splashTimer = setTimeout(() => {
    hideSplashScreen(onComplete);
  }, 500);
}

window.hideSplashScreen = hideSplashScreen;
window.triggerSplashScreen = triggerSplashScreen;
