export async function loadSamples(mode){
  return mode === 'DEMO' ? loadDemoSamples() : loadLiveSamples();
}

export async function loadDemoSamples(){
  return fetchFromBase('/public/demo/night-shift.json');
}

export async function loadLiveSamples(){
  return [];
}

async function fetchFromBase(rel){
  const base = window.location.pathname.replace(/\/[^/]*$/, '');
  const res = await fetch(`${base}${rel}`, { cache:'no-store' });
  return res.ok ? res.json() : [];
}
