/**
 * Asynchronous HTML Component Template Loader
 * Auto-injects extracted partial HTML components into the page container
 */
async function loadHtmlComponents() {
  const components = [
    { file: 'html/navigation_header.html', targetId: 'appHeaderContainer', insertBefore: 'main.main-content' },
    { file: 'html/bottom_nav_bar.html', targetId: 'bottomNavBarContainer', appendTo: 'body' },
    { file: 'html/lightbox_modal.html', targetId: 'lightboxModalContainer', appendTo: 'body' },
    { file: 'html/event_wizard_modal.html', targetId: 'eventWizardContainer', appendTo: 'body' },
    { file: 'html/manage_groups_modal.html', targetId: 'manageGroupsContainer', appendTo: 'body' },
    { file: 'html/cropper_modals.html', targetId: 'cropperModalsContainer', appendTo: 'body' }
  ];

  for (const comp of components) {
    try {
      const resp = await fetch(comp.file);
      if (!resp.ok) continue;
      const htmlText = await resp.text();
      let container = document.getElementById(comp.targetId);
      if (!container) {
        container = document.createElement('div');
        container.id = comp.targetId;
        if (comp.insertBefore) {
          const targetEl = document.querySelector(comp.insertBefore);
          if (targetEl && targetEl.parentNode) {
            targetEl.parentNode.insertBefore(container, targetEl);
          } else {
            document.body.appendChild(container);
          }
        } else {
          document.body.appendChild(container);
        }
      }
      container.innerHTML = htmlText;
    } catch (err) {
      console.warn(`Template load skipped for ${comp.file}:`, err);
    }
  }
}

window.loadHtmlComponents = loadHtmlComponents;
