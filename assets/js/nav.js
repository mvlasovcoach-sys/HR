// assets/js/nav.js
(function(){
  // 1) Single source of nav items
  window.NAV_ITEMS = [
    {id:'analytics',  href:'Analytics.html',  i18n:'nav.analytics'},
    {id:'engagement', href:'Engagement.html', i18n:'nav.engagement'},
    {id:'corporate',  href:'Corporate.html',  i18n:'nav.corporate'},
    {id:'devices',    href:'Devices.html',    i18n:'nav.devices'},
    {id:'settings',   href:'Settings.html',   i18n:'nav.settings'},
    // pinned at bottom:
    {id:'demo',       href:'Demo.html',       i18n:'nav.demo', position:'bottom'}
  ];

  // 2) Fallback English labels (in case i18n is late)
  const LABEL_EN = {
    analytics:'Analytics', engagement:'Engagement',
    corporate:'Corporate', devices:'Devices', settings:'Settings', demo:'Demo'
  };

  // 3) Render function
  window.renderSideNav = function(activeId){
    // Accept either #side-nav or legacy #sidebar-slot
    const host = document.getElementById('side-nav') || document.getElementById('sidebar-slot');
    if(!host) return;

    host.innerHTML = `
      <nav class="side">
        <div class="brand">SPA2099 HR Health</div>
        <ul class="menu top"   aria-label="Primary"></ul>
        <ul class="menu bottom" aria-label="Secondary"></ul>
      </nav>`;

    const top = host.querySelector('.menu.top');
    const bottom = host.querySelector('.menu.bottom');

    NAV_ITEMS.forEach(item=>{
      const li = document.createElement('li');
      const a  = document.createElement('a');
      const fallback = LABEL_EN[item.id] || item.id;
      a.href = item.href;
      a.dataset.id = item.id;
      a.dataset.short = (item.short || fallback.charAt(0) || item.id).toUpperCase();
      a.setAttribute('aria-label', fallback);
      a.setAttribute('title', fallback);
      a.setAttribute('data-i18n', item.i18n);
      a.setAttribute('data-i18n-attr', 'aria-label,title');

      const label = document.createElement('span');
      label.className = 'nav-label';
      label.textContent = fallback;
      label.setAttribute('data-i18n', item.i18n);

      a.appendChild(label);
      li.appendChild(a);
      (item.position === 'bottom' ? bottom : top).appendChild(li);
    });

    // Active state
    const here = (location.pathname.split('/').pop() || '').toLowerCase();
    host.querySelectorAll('a').forEach(a=>{
      const fname = a.getAttribute('href').split('/').pop().toLowerCase();
      if (fname === here) a.classList.add('active');
    });

    const active = host.querySelector('a.active');
    if (active) {
      const scrollHost = active.closest('.menu.top') || active.parentElement;
      if (scrollHost && typeof active.scrollIntoView === 'function') {
        active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      }
    }

    // Translate just-in-time (if i18n is present)
    try { window.I18N?.refresh?.(host); } catch(e){/* noop */}

    const links = Array.from(host.querySelectorAll('a'));
    links.forEach(link => {
      const labelText = link.querySelector('.nav-label')?.textContent?.trim?.();
      if (labelText) {
        link.dataset.short = labelText.charAt(0).toUpperCase();
      }
      link.addEventListener('keydown', evt => handleKeydown(evt, links));
      link.addEventListener('focus', () => {
        if (typeof link.scrollIntoView === 'function') {
          link.scrollIntoView({block: 'nearest'});
        }
      });
    });

    // Self-check in console to debug
    console.debug('nav:', [...host.querySelectorAll('a')].map(a=>a.textContent.trim()));

    requestAnimationFrame(()=>{
      const initialActive = document.querySelector('#side-nav a.active');
      const topMenu = document.querySelector('#side-nav .menu.top');
      if (initialActive && topMenu && initialActive.closest('.menu.top') === topMenu) {
        initialActive.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    });
  };

  // 4) Last-resort auto-render if page forgot to call
  document.addEventListener('DOMContentLoaded', ()=>{
    if(!document.querySelector('#side-nav a, #sidebar-slot a')){
      const guess = (location.pathname.match(/(\w+)\.html$/)?.[1] || 'corporate').toLowerCase();
      renderSideNav(guess);
    }
  });

  function handleKeydown(evt, links){
    if (!evt || !links || !links.length) return;
    const key = evt.key;
    const current = evt.currentTarget;
    const index = links.indexOf(current);
    if (index === -1) return;

    if (key === 'ArrowDown') {
      evt.preventDefault();
      const next = links[index + 1] || links[0];
      next?.focus();
    } else if (key === 'ArrowUp') {
      evt.preventDefault();
      const prev = links[index - 1] || links[links.length - 1];
      prev?.focus();
    } else if (key === 'Home') {
      evt.preventDefault();
      links[0]?.focus();
    } else if (key === 'End') {
      evt.preventDefault();
      links[links.length - 1]?.focus();
    } else if (key === 'Enter' || key === ' ') {
      evt.preventDefault();
      current?.click();
    }
  }
})();
