import { devWarn } from '../utils/env.js';

const DEMO_DATA_ROOT = '/HR/assets/data/demo';
const LIVE_DATA_ROOT = '/HR/assets/data/live';

const datasetCache = new Map();

function baseUrl(rel){return window.location.pathname.replace(/\/[^/]*$/,'')+rel;}

export function getMode(){
  const params = new URLSearchParams(window.location.search);
  const attr = document.body?.dataset?.page;
  if (attr === 'demo') return 'demo';
  return params.get('mode') === 'live' ? 'live' : 'demo';
}
export async function loadSamples(mode){
  return mode === 'DEMO' ? loadDemoSamples() : loadLiveSamples();
}

export async function loadDemoSamples(){
  const data = await fetchFromBase('/public/demo/night-shift.json');
  return data ?? [];
}

export async function loadLiveSamples(){
  return [];
}

export async function loadDevices(){
  const data = await safeFetchJson(baseUrl('/public/demo/devices.json'));
  return data ?? [];
}

export async function loadDataset(kind){
  const key = normaliseKind(kind);
  if (!key) return null;
  const mode = getMode();
  const cacheKey = `${mode}:${key}`;
  if (datasetCache.has(cacheKey)) {
    return datasetCache.get(cacheKey);
  }

  const demoUrl = buildDemoUrl(key);
  if (mode === 'demo') {
    const demoData = await safeFetchJson(demoUrl);
    cacheDataset('demo', key, demoData);
    return demoData;
  }

  const liveUrl = buildLiveUrl(key);
  try {
    const response = await fetch(liveUrl, { cache: 'no-store' });
    if (!response.ok) {
      const fallback = await safeFetchJson(demoUrl);
      cacheDataset('demo', key, fallback);
      cacheDataset('live', key, fallback);
      return fallback;
    }
    const payload = await response.json();
    cacheDataset('live', key, payload);
    return payload;
  } catch (err) {
    const fallback = await safeFetchJson(demoUrl);
    cacheDataset('demo', key, fallback);
    cacheDataset('live', key, fallback);
    return fallback;
  }
}

export async function safeFetchJson(url,{label='[demo] dataset not found:'}={}){
  try{
    const response = await fetch(url,{cache:'no-store'});
    if(!response.ok){
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  }catch(err){
    devWarn(label, url, err);
    return null;
  }
}

async function fetchFromBase(rel){
  const data = await safeFetchJson(baseUrl(rel));
  return data ?? [];
}

function cacheDataset(mode, key, data){
  const cacheKey = `${mode}:${key}`;
  datasetCache.set(cacheKey, data);
}

function normaliseKind(value){
  return String(value || '').trim().toLowerCase();
}

function buildDemoUrl(kind){
  const cleanBase = DEMO_DATA_ROOT.replace(/\/+$/, '');
  return `${cleanBase}/${kind}.json`;
}

function buildLiveUrl(kind){
  const base = window.APP_CONFIG?.liveDataBase || LIVE_DATA_ROOT;
  const cleanBase = String(base || '').replace(/\/+$/, '');
  return `${cleanBase}/${kind}.json`;
}

if (typeof globalThis !== 'undefined' && typeof globalThis.safeFetchJson !== 'function') {
  globalThis.safeFetchJson = safeFetchJson;
}
