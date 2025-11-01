import { calcWellbeing } from '../assets/js/modules/lib/scores.js';
import fs from 'fs';
import path from 'path';

const employees = [
  { id: 'emp_101', baseStress: 34, baseFatigue: 30, baseBurnout: 24, shiftOffset: 0 },
  { id: 'emp_102', baseStress: 36, baseFatigue: 32, baseBurnout: 27, shiftOffset: 1 },
  { id: 'emp_103', baseStress: 32, baseFatigue: 29, baseBurnout: 23, shiftOffset: 2 },
  { id: 'emp_104', baseStress: 38, baseFatigue: 34, baseBurnout: 28, shiftOffset: 3 },
  { id: 'emp_105', baseStress: 35, baseFatigue: 31, baseBurnout: 26, shiftOffset: 4 },
  { id: 'emp_106', baseStress: 37, baseFatigue: 33, baseBurnout: 29, shiftOffset: 5 }
];

const pattern = ['day', 'day', 'night', 'night', 'off', 'off', 'day'];
const startDate = new Date('2024-09-30T08:00:00Z');
const days = 14;

const state = new Map();
const dataset = [];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

for (let day = 0; day < days; day++) {
  const date = new Date(startDate.getTime());
  date.setUTCDate(startDate.getUTCDate() + day);
  employees.forEach(emp => {
    const shiftIndex = (day + emp.shiftOffset) % pattern.length;
    const shift = pattern[shiftIndex];
    const profile = state.get(emp.id) || { sleepDebt: 0, burnoutLevel: emp.baseBurnout, consecutiveNights: 0 };
    if (shift === 'night') {
      profile.consecutiveNights += 1;
    } else if (shift === 'off') {
      profile.consecutiveNights = Math.max(0, profile.consecutiveNights - 1);
    } else {
      profile.consecutiveNights = 0;
    }

    const baseSleep = shift === 'night' ? 5.2 : shift === 'off' ? 8.4 : 7.1;
    const sleepHours = clamp(Number((baseSleep + (Math.random() - 0.5) * 0.8).toFixed(1)), 4.2, 9.2);

    const sleepDelta = sleepHours < 7 ? (7 - sleepHours) : -Math.max(0, sleepHours - 7) * 0.5;
    profile.sleepDebt = clamp((profile.sleepDebt || 0) + sleepDelta, 0, 12);

    const hrvBase = shift === 'night' ? 38 : shift === 'off' ? 52 : 45;
    const hrv_rmssd = clamp(Math.round(hrvBase + (Math.random() - 0.5) * 6), 30, 60);
    const rhrBase = shift === 'night' ? 62 : shift === 'off' ? 56 : 58;
    const rhr = clamp(Math.round(rhrBase + (Math.random() - 0.5) * 4), 50, 70);
    const subjective_energy = clamp(Math.round((5 - Math.min(4, profile.sleepDebt) * 0.6) + (shift === 'off' ? 0.5 : 0) + (Math.random() - 0.5) * 0.6), 1, 5);

    let stress = emp.baseStress;
    stress += shift === 'night' ? 16 : shift === 'day' ? 4 : -5;
    if (sleepHours < 6.2) stress += 6;
    stress += Math.max(0, profile.consecutiveNights - 1) * 3;
    stress += clamp(60 - hrv_rmssd, 0, 12) * 0.4;
    stress = clamp(Math.round(stress), 0, 100);

    let fatigue = emp.baseFatigue + profile.sleepDebt * 3.2;
    if (shift === 'night') fatigue += 6;
    if (subjective_energy <= 2) fatigue += 5;
    fatigue = clamp(Math.round(fatigue), 0, 100);

    if (stress > 55 || fatigue > 55) {
      profile.burnoutLevel += 1.4;
    } else if (shift === 'off' && profile.sleepDebt < 2) {
      profile.burnoutLevel -= 0.8;
    } else {
      profile.burnoutLevel += 0.2;
    }
    profile.burnoutLevel = clamp(profile.burnoutLevel, 18, 88);
    const burnout = Math.round(profile.burnoutLevel);

    const wellbeing = calcWellbeing(stress, burnout, fatigue);

    const stressExplain = [];
    if (shift === 'night') stressExplain.push('night_shift');
    if (sleepHours < 6) stressExplain.push('sleep_deficit');
    if (hrv_rmssd < 40) stressExplain.push('hrv_low');

    const fatigueExplain = [];
    if (profile.sleepDebt > 2.5) fatigueExplain.push('sleep_deficit');
    if (shift === 'night') fatigueExplain.push('circadian_disruption');
    if (subjective_energy <= 2) fatigueExplain.push('low_energy');

    const burnoutExplain = [];
    if (burnout >= 50) burnoutExplain.push('chronic_load');
    if (profile.consecutiveNights >= 2) burnoutExplain.push('extended_nights');
    if (profile.sleepDebt > 3) burnoutExplain.push('recovery_gap');

    const wellbeingExplain = Array.from(new Set([...stressExplain, ...fatigueExplain, ...burnoutExplain]));

    dataset.push({
      person_id: emp.id,
      ts: new Date(date.getTime() + (8 + emp.shiftOffset) * 60 * 60 * 1000).toISOString(),
      signals: {
        hrv_rmssd,
        rhr,
        sleep_hours: Number(sleepHours.toFixed(1)),
        shift,
        subjective_energy
      },
      scores: {
        stress,
        burnout,
        fatigue,
        wellbeing
      },
      explain: {
        stress: stressExplain,
        burnout: burnoutExplain,
        fatigue: fatigueExplain,
        wellbeing: wellbeingExplain
      }
    });

    state.set(emp.id, profile);
  });
}

const outDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../public/demo');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'night-shift.json'), JSON.stringify(dataset, null, 2));
