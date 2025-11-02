import { renderToolbar } from '../components/Toolbar.js';
import { ModeStore } from '../stores/modeStore.js';
import { loadDevices } from '../services/dataSource.js';

const tableHost = () => document.getElementById('fleet-table');
const coverageHost = () => document.getElementById('devices-coverage');
const cardsHost = () => document.getElementById('fleet-cards');

function setCoverage(content){
  const host = coverageHost();
  if (!host) return;
  host.innerHTML = content;
}

function setCards(content){
  const host = cardsHost();
  if (!host) return;
  host.innerHTML = content;
}

function showLoading(){
  const host = tableHost();
  if (!host) return;
  host.innerHTML = '<div class="devices-loading">Loading…</div>';
}

function renderEmpty(message){
  const host = tableHost();
  if (!host) return;
  host.innerHTML = `<div class="devices-empty">${message}</div>`;
  setCards('');
  setCoverage(`<div>${message}</div>`);
}

function renderDevicesTable(devices){
  const host = tableHost();
  if (!host) return;
  const list = Array.isArray(devices) ? devices : [];
  if (!list.length){
    renderEmpty('No demo devices available.');
    return;
  }
  const rows = list.map(device => {
    const id = device?.device_id || device?.id || '—';
    const type = device?.type || '—';
    const fw = device?.fw || '—';
    const status = formatStatus(device?.status);
    const battery = formatBattery(device?.battery);
    const lastSeen = formatLastSeen(device?.last_seen);
    return `<tr>
      <th scope="row">${escapeHtml(id)}</th>
      <td>${escapeHtml(type)}</td>
      <td>${escapeHtml(fw)}</td>
      <td>${status}</td>
      <td>${battery}</td>
      <td>${lastSeen}</td>
    </tr>`;
  }).join('');

  host.innerHTML = `<table class="devices-table-table">
    <thead>
      <tr>
        <th scope="col">ID</th>
        <th scope="col">Type</th>
        <th scope="col">FW</th>
        <th scope="col">Status</th>
        <th scope="col">Battery</th>
        <th scope="col">Last seen</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;

  setCoverage(`<div>${list.length} device${list.length === 1 ? '' : 's'} in fleet (Demo)</div>`);
  setCards('');
}

function formatStatus(value){
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '—';
  const upper = text.toLowerCase();
  return upper.charAt(0).toUpperCase() + upper.slice(1);
}

function formatBattery(value){
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return `${num}%`;
}

function formatLastSeen(value){
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function escapeHtml(value){
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function applyMode(mode){
  const next = (mode || '').toUpperCase() === 'LIVE' ? 'LIVE' : 'DEMO';
  ModeStore.set(next);
  if (next === 'LIVE'){
    renderEmpty('Live mode enabled. Switch to Demo.');
    return;
  }
  showLoading();
  try {
    const devices = await loadDevices();
    renderDevicesTable(devices);
  } catch (err) {
    renderEmpty('Failed to load demo devices.');
  }
}

async function initPage(){
  ModeStore.init();
  renderToolbar({
    mount: document.getElementById('toolbar'),
    title: 'Devices',
    mode: ModeStore.mode,
    onModeChange: applyMode
  });
  await applyMode(ModeStore.mode);
}

if (document.readyState !== 'loading') {
  initPage();
} else {
  document.addEventListener('DOMContentLoaded', initPage);
}
