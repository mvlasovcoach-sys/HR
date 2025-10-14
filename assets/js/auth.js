(function(){
  const STORAGE_KEY = 'hr:role';
  const DEFAULT_ROLE = 'HR';
  const VALID_ROLES = new Set(['HR', 'OH', 'Admin']);
  const ROLE_CHANGE_EVENT = 'hr:role';

  let currentRole = DEFAULT_ROLE;

  init();

  function init(){
    const roleFromUrl = readRoleFromUrl();
    if (roleFromUrl) {
      setRole(roleFromUrl, {skipHistory: true});
    } else {
      currentRole = readRoleFromStorage() || DEFAULT_ROLE;
      persistRole(currentRole);
      notifyRoleChange();
    }
    document.addEventListener('sidebar:ready', handleSidebarReady, {once: false});
    document.addEventListener('sidebar:update', handleSidebarReady);
    document.addEventListener(ROLE_CHANGE_EVENT, () => {
      handleSidebarReady();
    });
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
    const root = evt?.detail?.root || document.getElementById('sidebar-slot');
    if (!root) return;
    applyRoleToSidebar(root);
  }

  function applyRoleToSidebar(root){
    const navItems = root.querySelectorAll('[data-role-key]');
    navItems.forEach(item => {
      const key = item.getAttribute('data-role-key');
      const allowed = window.routeGuards?.isAllowed(currentRole, key) ?? true;
      item.style.display = allowed ? '' : 'none';
    });
    const roleLabel = root.querySelector('[data-role-label]');
    if (roleLabel) {
      roleLabel.textContent = currentRole;
    }
  }

  window.auth = {
    getRole(){
      return currentRole;
    },
    setRole(role){
      setRole(role);
      document.dispatchEvent(new CustomEvent('sidebar:update')); // trigger UI refresh
    },
    onRoleChange(handler){
      if (typeof handler !== 'function') return () => {};
      const listener = evt => handler(evt?.detail?.role || currentRole);
      document.addEventListener(ROLE_CHANGE_EVENT, listener);
      return () => document.removeEventListener(ROLE_CHANGE_EVENT, listener);
    }
  };
})();
