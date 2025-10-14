(async function(){
  const slot = document.getElementById('sidebar-slot');
  if (!slot) return;

  try {
    const html = await window.dataLoader.fetch('./partials/sidebar.html', {as: 'text'});
    slot.innerHTML = html;
  } catch (e) {
    slot.innerHTML = '<nav class="side"><div class="side__brand">SPA2099 HR Health</div>\
      <ul class="side__nav">\
        <li><a href="./Summary.html" data-key="summary">Summary</a></li>\
        <li><a href="./User.html" data-key="wellness">Wellness</a></li>\
        <li><a href="./Analytics.html" data-key="analytics">Analytics</a></li>\
        <li><a href="./Engagement.html" data-key="engagement">Engagement</a></li>\
        <li><a href="./Corporate.html" data-key="corporate">Corporate</a></li>\
        <li><a href="./Devices.html" data-key="devices">Devices</a></li>\
        <li><a href="./Settings.html" data-key="settings">Settings</a></li>\
      </ul></nav>';
  }
  const here = location.pathname.split('/').pop().toLowerCase();
  slot.querySelectorAll('.side__nav a').forEach(a => {
    const fname = a.getAttribute('href').split('/').pop().toLowerCase();
    if (fname === here) a.classList.add('is-active');
  });

  window.i18n?.translate();
})();
