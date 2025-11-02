export async function loadSamples(mode){
  if(mode==='DEMO'){ return fetchBase('/public/demo/night-shift.json'); }
  return []; // LIVE позже
}
async function fetchBase(rel){ 
  const base = window.location.pathname.replace(/\/[^/]*$/, ''); 
  const r = await fetch(`${base}${rel}`,{cache:'no-store'}); 
  return r.ok ? r.json() : []; 
}
