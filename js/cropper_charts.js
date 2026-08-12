/**
 * Section 5: Interactive Cropper & Plotly Charts Engine
 */

let cropperInstance = null;
let lightboxCropperInstance = null;

function openMediaCropperModal({ imageSrcUrl, isVideo, videoSrcUrl, modalTitle, onSave }) {
  const modal = document.getElementById('cropperModal');
  const cropImageEl = document.getElementById('cropperImage');
  const titleEl = document.getElementById('cropperModalTitle');
  const seekerContainer = document.getElementById('videoSeekerContainer');
  const seekerSlider = document.getElementById('videoSeekerSlider');
  const seekerVideo = document.getElementById('cropperHiddenVideo');
  const timeLabel = document.getElementById('videoCurrentTimeLabel');

  if (titleEl) titleEl.textContent = modalTitle || 'Crop Image / Thumbnail';
  modal.classList.add('active');

  if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }

  const initCropper = (src) => {
    cropImageEl.src = src;
    cropImageEl.onload = () => {
      if (cropperInstance) cropperInstance.destroy();
      if (window.Cropper) {
        cropperInstance = new window.Cropper(cropImageEl, { aspectRatio: 1, viewMode: 1, autoCropArea: 0.8 });
      }
    };
  };

  if (isVideo && videoSrcUrl) {
    seekerContainer.style.display = 'block';
    seekerVideo.src = videoSrcUrl;
    seekerVideo.onloadedmetadata = () => {
      seekerSlider.max = seekerVideo.duration;
      seekerSlider.value = 0.5;
      seekerVideo.currentTime = 0.5;
    };

    const captureFrame = () => {
      timeLabel.textContent = `${seekerVideo.currentTime.toFixed(1)}s`;
      const canvas = document.createElement('canvas');
      canvas.width = seekerVideo.videoWidth || 640;
      canvas.height = seekerVideo.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(seekerVideo, 0, 0, canvas.width, canvas.height);
      const frameUrl = canvas.toDataURL('image/png');
      initCropper(frameUrl);
    };

    seekerVideo.onseeked = captureFrame;
    seekerSlider.oninput = () => { seekerVideo.currentTime = parseFloat(seekerSlider.value); };
    initCropper(imageSrcUrl);
  } else {
    seekerContainer.style.display = 'none';
    initCropper(imageSrcUrl);
  }

  document.getElementById('saveCropBtn').onclick = () => {
    if (cropperInstance) {
      const canvas = cropperInstance.getCroppedCanvas({ width: 200, height: 200 });
      const croppedUrl = canvas.toDataURL('image/jpeg', 0.85);
      if (onSave) onSave(croppedUrl);
    }
    closeAvatarCropper();
  };

  document.getElementById('closeCropperModalBtn').onclick = closeAvatarCropper;
  document.getElementById('cancelCropBtn').onclick = closeAvatarCropper;
}

function closeAvatarCropper() {
  document.getElementById('cropperModal').classList.remove('active');
  if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
}

function openLightboxCropModal(media) {
  const modal = document.getElementById('lightboxCropModal');
  const cropImg = document.getElementById('cropModalImage');
  const ratioSelect = document.getElementById('cropModalRatioSelect');
  const seekerContainer = document.getElementById('cropModalVideoSeeker');
  const seekerSlider = document.getElementById('cropVideoSeekerSlider');
  const seekerVideo = document.getElementById('cropModalHiddenVideo');
  const timeLabel = document.getElementById('cropVideoTimeLabel');

  modal.classList.add('active');
  if (lightboxCropperInstance) { lightboxCropperInstance.destroy(); lightboxCropperInstance = null; }

  const isVideo = media.type?.startsWith('video');

  const initCropperInstance = (src) => {
    cropImg.src = src;
    cropImg.onload = () => {
      if (lightboxCropperInstance) lightboxCropperInstance.destroy();
      if (window.Cropper) {
        lightboxCropperInstance = new window.Cropper(cropImg, {
          aspectRatio: NaN,
          viewMode: 1,
          autoCropArea: 0.9,
          responsive: true,
          movable: true,
          resizable: true
        });
      }
    };
  };

  if (isVideo) {
    seekerContainer.style.display = 'block';
    seekerVideo.src = media.dataUrl;
    seekerVideo.onloadedmetadata = () => {
      seekerSlider.max = seekerVideo.duration;
      seekerSlider.value = 0.5;
      seekerVideo.currentTime = 0.5;
    };

    const captureFrame = () => {
      timeLabel.textContent = `${seekerVideo.currentTime.toFixed(1)}s`;
      const canvas = document.createElement('canvas');
      canvas.width = seekerVideo.videoWidth || 640;
      canvas.height = seekerVideo.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(seekerVideo, 0, 0, canvas.width, canvas.height);
      initCropperInstance(canvas.toDataURL('image/png'));
    };

    seekerVideo.onseeked = captureFrame;
    seekerSlider.oninput = () => { seekerVideo.currentTime = parseFloat(seekerSlider.value); };
    initCropperInstance(media.thumbnailUrl || media.dataUrl);
  } else {
    seekerContainer.style.display = 'none';
    initCropperInstance(media.dataUrl);
  }

  ratioSelect.onchange = () => {
    const val = ratioSelect.value;
    if (!lightboxCropperInstance) return;

    if (val === 'free') {
      lightboxCropperInstance.setAspectRatio(NaN);
    } else if (val === 'screen') {
      lightboxCropperInstance.setAspectRatio(window.innerWidth / window.innerHeight);
    } else if (val === '1:1') {
      lightboxCropperInstance.setAspectRatio(1);
    } else if (val === '4:3') {
      lightboxCropperInstance.setAspectRatio(4 / 3);
    } else if (val === '16:9') {
      lightboxCropperInstance.setAspectRatio(16 / 9);
    } else if (val === 'custom') {
      const input = prompt('Enter ratio (e.g. 9/20 or 1.5):', '9/20');
      if (input) {
        let num = parseFloat(input);
        if (input.includes('/')) {
          const p = input.split('/');
          num = parseFloat(p[0]) / parseFloat(p[1]);
        }
        if (!isNaN(num)) lightboxCropperInstance.setAspectRatio(num);
      }
    }
  };

  document.getElementById('confirmCropModalBtn').onclick = async () => {
    if (lightboxCropperInstance) {
      const canvas = lightboxCropperInstance.getCroppedCanvas();
      const croppedUrl = canvas.toDataURL('image/jpeg', 0.95);
      media.viewTransform = media.viewTransform || {};
      media.viewTransform.croppedViewUrl = croppedUrl;
      await db.put('media', media);
    }
    closeLightboxCropModal();
    renderLightboxContent();
    renderCurrentView();
  };

  document.getElementById('cropModalClearBtn').onclick = async () => {
    if (media.viewTransform) {
      media.viewTransform.croppedViewUrl = null;
      await db.put('media', media);
    }
    closeLightboxCropModal();
    renderLightboxContent();
    renderCurrentView();
  };

  document.getElementById('closeCropModalBtn').onclick = closeLightboxCropModal;
  document.getElementById('cancelCropModalBtn').onclick = closeLightboxCropModal;
}

function closeLightboxCropModal() {
  document.getElementById('lightboxCropModal').classList.remove('active');
  if (lightboxCropperInstance) { lightboxCropperInstance.destroy(); lightboxCropperInstance = null; }
}

function renderSubjectEventPointsTimelineChart(containerId, subjectId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!window.Plotly) {
    container.innerHTML = `<div class="empty-state">Chart library loading...</div>`;
    return;
  }

  const subEvents = (currentEventsList || []).filter(e => e.subjectCounts && e.subjectCounts[subjectId]);
  if (subEvents.length === 0) {
    container.innerHTML = `<div class="empty-state">No recorded events for this subject.</div>`;
    return;
  }

  subEvents.sort((a, b) => (a.dateTag || '').localeCompare(b.dateTag || ''));

  let cumulative = 0;
  const dates = [];
  const pts = [];

  subEvents.forEach(e => {
    const weight = currentWeights?.actions?.[e.eventCode] ?? (e.eventCode * 2.5);
    cumulative += weight;
    dates.push(e.dateTag || e.date || 'Unknown');
    pts.push(cumulative);
  });

  const trace = {
    x: dates,
    y: pts,
    name: 'Event Points',
    type: 'scatter',
    mode: 'lines+markers',
    fill: 'tozeroy',
    line: { color: '#38bdf8', width: 3 }
  };

  const layout = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' }, margin: { l: 40, r: 20, t: 20, b: 40 } };
  window.Plotly.newPlot(containerId, [trace], layout, { responsive: true, displayModeBar: false });
}

function renderSubjectSldHeartPointsTimelineChart(containerId, subjectId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!window.Plotly) {
    container.innerHTML = `<div class="empty-state">Chart library loading...</div>`;
    return;
  }

  const tagged = (currentMediaList || []).filter(m => m.subjectTags?.includes(subjectId));
  const dateMap = new Map();

  tagged.forEach(m => {
    (m.blueBookEvents || []).forEach(be => {
      if (!be.dateTag) return;
      const p = be.heartTags?.pink || 0;
      const g = be.heartTags?.grey || 0;
      const b = be.heartTags?.blue || 0;
      const prev = dateMap.get(be.dateTag) || { pink: 0, grey: 0, blue: 0 };
      dateMap.set(be.dateTag, { pink: prev.pink + p, grey: prev.grey + g, blue: prev.blue + b });
    });
  });

  const sortedDates = Array.from(dateMap.keys()).sort();
  if (sortedDates.length === 0) {
    container.innerHTML = `<div class="empty-state">No SLD events logged for this subject.</div>`;
    return;
  }

  let cumPink = 0, cumGrey = 0, cumBlue = 0;
  const dates = [];
  const pinkPts = [], greyPts = [], bluePts = [];

  sortedDates.forEach(d => {
    const entry = dateMap.get(d);
    cumPink += entry.pink * (currentWeights.pinkHeart ?? 5);
    cumGrey += entry.grey * (currentWeights.greyHeart ?? 3);
    cumBlue += entry.blue * (currentWeights.blueHeart ?? 1);

    dates.push(d);
    pinkPts.push(cumPink);
    greyPts.push(cumGrey);
    bluePts.push(cumBlue);
  });

  const trace1 = { x: dates, y: pinkPts, name: '🩷 Pink Pts', type: 'scatter', mode: 'lines+markers', line: { color: '#ff69b4', width: 2.5 } };
  const trace2 = { x: dates, y: greyPts, name: '🩶 Grey Pts', type: 'scatter', mode: 'lines+markers', line: { color: '#94a3b8', width: 2.5 } };
  const trace3 = { x: dates, y: bluePts, name: '🩵 Blue Pts', type: 'scatter', mode: 'lines+markers', line: { color: '#38bdf8', width: 2.5 } };

  const layout = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' }, margin: { l: 40, r: 20, t: 20, b: 40 } };
  window.Plotly.newPlot(containerId, [trace1, trace2, trace3], layout, { responsive: true, displayModeBar: false });
}

function renderPinkAccumulationChart(containerId, timelineData = []) {
  const container = document.getElementById(containerId);
  if (!container || !window.Plotly) return;

  if (timelineData.length === 0) {
    container.innerHTML = `<div class="empty-state">No date-tagged media found to display accumulation.</div>`;
    return;
  }

  const dates = timelineData.map(d => d.date);
  const counts = timelineData.map(d => d.cumulativePinkHearts);
  const pts = timelineData.map(d => d.cumulativePinkPts);

  const trace1 = { x: dates, y: counts, name: 'Total 🩷 Pink Hearts', type: 'scatter', mode: 'lines+markers', fill: 'tozeroy', line: { color: '#ff69b4', width: 3 } };
  const trace2 = { x: dates, y: pts, name: 'Pink Heart Points', type: 'scatter', mode: 'lines+markers', line: { color: '#a855f7', width: 2, dash: 'dot' } };

  const layout = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' }, margin: { l: 40, r: 20, t: 20, b: 40 } };
  window.Plotly.newPlot(containerId, [trace1, trace2], layout, { responsive: true, displayModeBar: false });
}

function renderSubjectLeaderboardChart(containerId, subjectStats = []) {
  const container = document.getElementById(containerId);
  if (!container || !window.Plotly) return;

  if (subjectStats.length === 0) { container.innerHTML = `<div class="empty-state">No subject stats recorded.</div>`; return; }

  const top = subjectStats.slice(0, 10).reverse();
  const names = top.map(s => getSubjectDisplayName(s.subject));
  const heartPts = top.map(s => s.heartPoints);
  const eventPts = top.map(s => s.eventPoints);

  const trace1 = { x: heartPts, y: names, name: 'Heart Points', type: 'bar', orientation: 'h', marker: { color: '#ff69b4' } };
  const trace2 = { x: eventPts, y: names, name: 'Event Points', type: 'bar', orientation: 'h', marker: { color: '#38bdf8' } };

  const layout = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' }, barmode: 'stack', margin: { l: 100, r: 20, t: 20, b: 40 } };
  window.Plotly.newPlot(containerId, [trace1, trace2], layout, { responsive: true, displayModeBar: false });
}

function renderCombinationsChart(containerId, combinations = []) {
  const container = document.getElementById(containerId);
  if (!container || !window.Plotly) return;
  if (combinations.length === 0) { container.innerHTML = `<div class="empty-state">No subject combinations found.</div>`; return; }

  const top = combinations.slice(0, 8).reverse();
  const names = top.map(c => c.name);
  const pts = top.map(c => c.totalPoints);

  const trace = { x: pts, y: names, type: 'bar', orientation: 'h', marker: { color: pts, colorscale: 'Viridis' } };
  const layout = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' }, margin: { l: 140, r: 20, t: 20, b: 40 } };
  window.Plotly.newPlot(containerId, [trace], layout, { responsive: true, displayModeBar: false });
}

window.openMediaCropperModal = openMediaCropperModal;
window.closeAvatarCropper = closeAvatarCropper;
window.openLightboxCropModal = openLightboxCropModal;
window.closeLightboxCropModal = closeLightboxCropModal;
window.renderSubjectEventPointsTimelineChart = renderSubjectEventPointsTimelineChart;
window.renderSubjectSldHeartPointsTimelineChart = renderSubjectSldHeartPointsTimelineChart;
window.renderPinkAccumulationChart = renderPinkAccumulationChart;
window.renderSubjectLeaderboardChart = renderSubjectLeaderboardChart;
window.renderCombinationsChart = renderCombinationsChart;
