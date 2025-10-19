(function(){
  const STORAGE_KEY = 'hr:role';
  const DEFAULT_ROLE = 'HR';
  const VALID_ROLES = new Set(['HR', 'OH', 'Admin']);
  const ROLE_CHANGE_EVENT = 'hr:role';

  let currentRole = DEFAULT_ROLE;

  init();

  function init(){
    const roleFromUrl = readRoleFromUrl();
    if (typeof window.renderSideNav === 'function') {
      const originalRender = window.renderSideNav;
      window.renderSideNav = function(...args){
        const result = originalRender.apply(this, args);
        handleSidebarReady();
        return result;
      };
    }
    if (roleFromUrl) {
      setRole(roleFromUrl, {skipHistory: true});
    } else {
      currentRole = readRoleFromStorage() || DEFAULT_ROLE;
      persistRole(currentRole);
      notifyRoleChange();
    }
    document.addEventListener(ROLE_CHANGE_EVENT, () => {
      handleSidebarReady();
    });
    handleSidebarReady();
  }

  function readRoleFromUrl(){
    try {
      const params = new URLSearchParams(window.location.search);
      const role = params.get('role');
      if (role && VALID_ROLES.has(role)) {
        params.delete('role');
        const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash || ''}`;
        window.history.replaceState({}, document.title, next);
        return role;
      }
    } catch (e) {
      console.warn('auth: failed to parse role from URL', e);
    }
    return null;
  }

  function readRoleFromStorage(){
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID_ROLES.has(stored)) return stored;
    } catch (e) {
      console.warn('auth: failed to read role from storage', e);
    }
    return null;
  }

  function persistRole(role){
    try {
      localStorage.setItem(STORAGE_KEY, role);
    } catch (e) {
      console.warn('auth: failed to persist role', e);
    }
  }

  function notifyRoleChange(){
    document.dispatchEvent(new CustomEvent(ROLE_CHANGE_EVENT, {detail: {role: currentRole}}));
  }

  function setRole(role, options={}){
    if (!VALID_ROLES.has(role)) return;
    if (currentRole === role) return;
    currentRole = role;
    persistRole(role);
    if (!options.skipHistory) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('role', role);
        window.history.replaceState({}, document.title, url);
      } catch (e) {
        console.warn('auth: unable to push role to URL', e);
      }
    }
    notifyRoleChange();
  }

  function handleSidebarReady(evt){
    const root = evt?.detail?.root || document.getElementById('side-nav') || document.getElementById('sidebar-slot');
    if (!root) return;
    applyRoleToSidebar(root);
  }

  function applyRoleToSidebar(root){
    const navItems = root.querySelectorAll('a[data-id]');
    navItems.forEach(link => {
      const key = link.dataset.id || '';
      const allowed = window.routeGuards?.isAllowed(currentRole, key) ?? true;
      const li = link.parentElement;
      if (li && li.tagName === 'LI') {
        li.style.display = allowed ? '' : 'none';
      } else {
        link.style.display = allowed ? '' : 'none';
      }
    });
  }

  window.auth = {
    getRole(){
      return currentRole;
    },
    setRole(role){
      setRole(role);
      handleSidebarReady();
    },
    onRoleChange(handler){
      if (typeof handler !== 'function') return () => {};
      const listener = evt => handler(evt?.detail?.role || currentRole);
      document.addEventListener(ROLE_CHANGE_EVENT, listener);
      return () => document.removeEventListener(ROLE_CHANGE_EVENT, listener);
    }
  };
})();
