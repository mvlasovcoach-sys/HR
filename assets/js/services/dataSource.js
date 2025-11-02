function baseUrl(rel){return window.location.pathname.replace(/\/[^/]*$/,'')+rel;}
export async function loadSamples(mode){
  return mode === 'DEMO' ? loadDemoSamples() : loadLiveSamples();
}

export async function loadDemoSamples(){
  return fetchFromBase('/public/demo/night-shift.json');
}

export async function loadLiveSamples(){
  return [];
}

export async function loadDevices(){
  const r=await fetch(baseUrl('/public/demo/devices.json'),{cache:'no-store'});
  return r.ok? r.json(): [];
}

async function fetchFromBase(rel){
  const res = await fetch(baseUrl(rel), { cache:'no-store' });
  return res.ok ? res.json() : [];
}
