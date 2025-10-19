// assets/js/nav.js
(function(){
  window.NAV_ITEMS = [
    {id:'summary',    href:'Summary.html',    i18n:'nav.summary'},
    {id:'analytics',  href:'Analytics.html',  i18n:'nav.analytics'},
    {id:'engagement', href:'Engagement.html', i18n:'nav.engagement'},
    {id:'corporate',  href:'Corporate.html',  i18n:'nav.corporate'},
    {id:'devices',    href:'Devices.html',    i18n:'nav.devices'},
    {id:'settings',   href:'Settings.html',   i18n:'nav.settings'},
    // bottom section
    {id:'demo',       href:'Demo.html',       i18n:'nav.demo', position:'bottom'}
  ];

  window.renderSideNav = function(activeId){
    const host = document.getElementById('side-nav') || document.getElementById('sidebar-slot');
    if(!host) return;
    host.innerHTML = `
      <nav class="side">
        <div class="brand">SPA2099 HR Health</div>
        <ul class="menu top"></ul>
        <ul class="menu bottom"></ul>
      </nav>`;
    const top = host.querySelector('.menu.top');
    const bottom = host.querySelector('.menu.bottom');

    NAV_ITEMS.forEach(item=>{
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = item.href;
      a.dataset.id = item.id;
      a.textContent = (window.I18N?.t?.(item.i18n)) || item.id; // fallback text
      li.appendChild(a);
      (item.position==='bottom'? bottom : top).appendChild(li);
    });

    // active state
    const here = (location.pathname.split('/').pop() || '').toLowerCase();
    host.querySelectorAll('a').forEach(a=>{
      const fname = a.getAttribute('href').split('/').pop().toLowerCase();
      if(fname === here) a.classList.add('active');
    });

    // i18n refresh after DOM paint
    if(window.I18N?.refresh) I18N.refresh(host);

    // debug self-check
    console.debug('nav:', [...host.querySelectorAll('a')].map(a=>a.textContent.trim()));
  };

  // last-resort auto render if a page forgets to call renderSideNav
  document.addEventListener('DOMContentLoaded', ()=>{
    if(!document.querySelector('#side-nav a, #sidebar-slot a')){
      const guess = (location.pathname.match(/(\w+)\.html$/)?.[1] || 'summary')
        .toLowerCase();
      renderSideNav(guess);
    }
  });
})();
