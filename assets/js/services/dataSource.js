import { devWarn } from '../utils/env.js';

function baseUrl(rel){return window.location.pathname.replace(/\/[^/]*$/,'')+rel;}
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

if (typeof globalThis !== 'undefined' && typeof globalThis.safeFetchJson !== 'function') {
  globalThis.safeFetchJson = safeFetchJson;
}
