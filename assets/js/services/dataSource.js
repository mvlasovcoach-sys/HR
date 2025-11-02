export async function loadSamples(mode){
  if(mode==='DEMO'){ return fetchBase('/public/demo/night-shift.json'); }
  return []; // LIVE позже
}
async function fetchBase(rel){
  const base = window.location.pathname.replace(/\/[^/]*$/, '');
  const res = await fetch(`${base}${rel}`, { cache:'no-store' });
  return res.ok ? res.json() : [];
}
