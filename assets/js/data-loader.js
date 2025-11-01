export const BUILD_V='2025-10-26-01';
export const withV=u=>{
  if(u==null)return u;
  try{
    const url=u instanceof URL?new URL(u.toString()):new URL(String(u),typeof document!=='undefined'?document.baseURI:undefined);
    if(!url.searchParams.has('v')){url.searchParams.set('v',BUILD_V);}return url.toString();
  }catch(err){
    const value=String(u);
    if(!value)return value;
    return `${value}${value.includes('?')?'&':'?'}v=${BUILD_V}`;
  }
};
export async function fetchJson(u){const r=await fetch(u,{cache:'no-store'});if(r.status===404)return null;if(!r.ok)throw new Error(`HTTP ${r.status} for ${u}`);return r.json();}

const BASE='/HR';
const SCENARIO_PATH={
  live:`${BASE}/data/scenario/live.json`,
  night:`${BASE}/data/scenario/night.json`,
  demo:`${BASE}/data/scenario/demo.json`
};

const SCENARIO_ALIASES={
  live:'live',
  production:'live',
  prod:'live',
  default:'live',
  main:'live',
  night:'night',
  'night-shift':'night',
  'night_shift':'night',
  nightshift:'night',
  demo:'demo',
  sandbox:'demo',
  preview:'demo'
};

const scenarioCache=new Map();

const indexCache = new Map();
const dayCache = new Map();

function ensureLoaderGlobals(){
  const g = typeof window !== 'undefined' ? window : globalThis;
  if (!g.loaderGlobals) {
    g.loaderGlobals = {};
  }
  return g.loaderGlobals;
}

function normaliseDateKey(value){
  if (!value) return null;
  if (value instanceof Date) {
    const copy = new Date(value);
    copy.setHours(0, 0, 0, 0);
    return copy.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return normaliseDateKey(new Date(value));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      return normaliseDateKey(date);
    }
  }
  return null;
}

function versionedPath(path){
  try {
    return withV(path);
  } catch (err) {
    return path;
  }
}

export const canonicalScenarioKey=value=>{
  const key=String(value||'').toLowerCase().trim();
  if(key&&SCENARIO_ALIASES[key])return SCENARIO_ALIASES[key];
  if(key&&SCENARIO_PATH[key])return key;
  return 'live';
};

function scenarioUrl(key){
  const canonical=canonicalScenarioKey(key);
  const path=SCENARIO_PATH[canonical];
  if(!path) throw new Error(`Unknown scenario: ${key}`);
  return withV(path);
}

export async function loadScenarioManifest(input,{refresh=false,fallback=true}={}){
  const requested=canonicalScenarioKey(input);
  if(!refresh&&scenarioCache.has(requested)){
    return scenarioCache.get(requested);
  }

  const fetchManifest=async key=>{
    const url=scenarioUrl(key);
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok){
      return {ok:false,status:response.status,url};
    }
    const payload=await response.json();
    return {ok:true,data:payload};
  };

  let result=await fetchManifest(requested);
  if(!result.ok){
    if(result.status===404&&fallback&&requested!=='demo'){
      console.warn('Scenario not found, fallback to demo');
      const fallbackResult=await fetchManifest('demo');
      if(!fallbackResult.ok){
        const error=new Error('No dataset available');
        error.code='SCENARIO_UNAVAILABLE';
        throw error;
      }
      const manifest=decorateScenarioManifest(fallbackResult.data,{requested,resolved:'demo',fallback:true});
      cacheScenarioManifest(manifest,requested,'demo');
      dispatchScenarioFallback(requested,'demo');
      return manifest;
    }
    const error=new Error(`Scenario load failed (${result.status||'unknown'})`);
    error.code='SCENARIO_UNAVAILABLE';
    throw error;
  }

  const manifest=decorateScenarioManifest(result.data,{requested,resolved:canonicalScenarioKey(result.data?.key||requested),fallback:false});
  cacheScenarioManifest(manifest,requested,manifest.meta.resolved);
  return manifest;
}

function decorateScenarioManifest(data,{requested,resolved,fallback}){
  const resolvedKey=canonicalScenarioKey(resolved||requested);
  const manifest=Object.assign({},data||{}, {
    key: resolvedKey
  });
  manifest.meta={requested:canonicalScenarioKey(requested),resolved:resolvedKey,fallback:!!fallback};
  return manifest;
}

function cacheScenarioManifest(manifest,requested,resolved){
  const canonicalRequested=canonicalScenarioKey(requested);
  const canonicalResolved=canonicalScenarioKey(resolved||manifest?.key||canonicalRequested);
  scenarioCache.set(canonicalRequested,manifest);
  scenarioCache.set(canonicalResolved,manifest);
}

function dispatchScenarioFallback(from,to){
  try{
    if(typeof window!=='undefined'&&window.dispatchEvent){
      window.dispatchEvent(new CustomEvent('scenario:fallback',{detail:{from:canonicalScenarioKey(from),to:canonicalScenarioKey(to)}}));
    }
  }catch(err){
    /* noop */
  }
}

function currentScenario(){
  try {
    const raw=localStorage.getItem('hr:scenario') || 'live';
    return canonicalScenarioKey(raw);
  } catch (err) {
    return 'live';
  }
}

export async function loadIndex({ refresh = false, scenario } = {}){
  const scenarioKey = canonicalScenarioKey(scenario || currentScenario());
  const cacheKey = `${scenarioKey}`;
  if (!refresh && indexCache.has(cacheKey)) {
    return indexCache.get(cacheKey);
  }

  let manifest = null;
  try {
    manifest = await loadScenarioManifest(scenarioKey);
  } catch (err) {
    console.error('[DataLoader] Failed to resolve scenario index', err);
  }

  const indexPath = manifest?.stress?.index || './data/stress/raw/index.json';
  const url = versionedPath(indexPath);
  try {
    const payload = await fetchJson(url);
    indexCache.set(cacheKey, payload);
    return payload;
  } catch (err) {
    console.error('[DataLoader] Failed to load stress index', err);
    indexCache.set(cacheKey, null);
    return null;
  }
}

export async function loadDay(input, { refresh = false, scenario } = {}){
  const iso = normaliseDateKey(input);
  if (!iso) return null;
  const requestedScenario = canonicalScenarioKey(scenario || currentScenario());
  let manifest = null;
  try {
    manifest = await loadScenarioManifest(requestedScenario);
  } catch (err) {
    console.error('[DataLoader] Failed to resolve scenario manifest', err);
  }
  const resolvedScenario = canonicalScenarioKey(manifest?.meta?.resolved || manifest?.key || requestedScenario);
  const cacheKey = `${resolvedScenario}|${iso}`;
  if (!refresh && dayCache.has(cacheKey)) {
    return dayCache.get(cacheKey);
  }

  const basePath = manifest?.stress?.base || './data/stress/raw';
  const trimmedBase = String(basePath || '').replace(/\/+$/, '');
  const url = versionedPath(`${trimmedBase}/${iso}.json`);

  try {
    const payload = await fetchJson(url);
    dayCache.set(cacheKey, payload);
    return payload;
  } catch (err) {
    console.error(`[DataLoader] Failed to load stress day ${iso}`, err);
    dayCache.set(cacheKey, null);
    return null;
  }
}

const globals = ensureLoaderGlobals();
Object.assign(globals, { BUILD_V, withV, fetchJson, loadIndex, loadDay, canonicalScenarioKey, loadScenarioManifest });
