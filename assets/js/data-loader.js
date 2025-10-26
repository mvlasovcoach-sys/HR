export const BUILD_V = '2025-10-25-02';
export function withV(u){ return `${u}${u.includes('?')?'&':'?'}v=${BUILD_V}`; }
export async function fetchJson(u){
  const r = await fetch(u,{cache:'no-store'});
  if(r.status===404) return null;
  if(!r.ok) throw new Error(`HTTP ${r.status} for ${u}`);
  return r.json();
}
const g = typeof window !== 'undefined' ? window : globalThis;
if (!g.loaderGlobals) {
  g.loaderGlobals = {};
}
Object.assign(g.loaderGlobals, { BUILD_V, withV, fetchJson });
