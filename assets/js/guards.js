(function(){
  const ROUTE_MAP = {
    summary: {roles: ['HR', 'OH', 'Admin']},
    analytics: {roles: ['HR', 'OH', 'Admin']},
    engagement: {roles: ['HR', 'OH', 'Admin']},
    corporate: {roles: ['HR', 'OH', 'Admin']},
    devices: {roles: ['HR', 'OH', 'Admin']},
    settings: {roles: ['Admin']},
    wellness: {roles: []},
    pilot: {roles: ['Admin']},
    index: {roles: ['HR', 'OH', 'Admin']},
    about: {roles: ['HR', 'OH', 'Admin']}
  };

  const FILE_TO_KEY = {
    'summary.html': 'summary',
    'analytics.html': 'analytics',
    'engagement.html': 'engagement',
    'corporate.html': 'corporate',
    'devices.html': 'devices',
    'settings.html': 'settings',
    'user.html': 'wellness',
    'pilot.html': 'pilot',
    'index.html': 'index'
  };

  const DEFAULT_REDIRECT = './Corporate.html';

  function getKeyForLocation(){
    try {
      const path = window.location.pathname.split('/').pop() || 'index.html';
      return FILE_TO_KEY[path.toLowerCase()] || 'index';
    } catch (e) {
      return 'index';
    }
  }

  function rolesFor(key){
    return ROUTE_MAP[key]?.roles || [];
  }

  function isAllowed(role, key){
    if (!role) return false;
    const allowedRoles = rolesFor(key);
    if (!allowedRoles.length) return false;
    return allowedRoles.includes(role);
  }

  function enforce(){
    const role = window.auth?.getRole?.() || 'HR';
    const key = getKeyForLocation();
    if (!isAllowed(role, key)) {
      if (key === 'wellness') {
        redirect();
        return;
      }
      if (!rolesFor(key).length) {
        redirect();
        return;
      }
      redirect();
    }
  }

  function redirect(){
    if (window.location.pathname.endsWith('Corporate.html')) return;
    window.location.replace(DEFAULT_REDIRECT);
  }

  window.routeGuards = {
    isAllowed,
    rolesFor,
    getKeyForLocation
  };

  document.addEventListener('DOMContentLoaded', enforce);
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    enforce();
  }

  if (window.auth?.onRoleChange) {
    window.auth.onRoleChange(() => enforce());
  }
})();
