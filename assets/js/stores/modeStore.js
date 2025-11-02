export const ModeStore = {
  mode: 'DEMO',
  init(){
    const q = new URLSearchParams(location.search).get('mode');
    const ls = localStorage.getItem('spa2099_mode');
    this.mode = (q?.toUpperCase() || ls || 'DEMO');
  },
  set(m){
    this.mode = m;
    localStorage.setItem('spa2099_mode', m);
    const sp = new URLSearchParams(location.search);
    sp.set('mode', m.toLowerCase());
    history.replaceState(null,'',`${location.pathname}?${sp}`);
  }
};
