export const ORG_WELLBEING_LEVELS = [
  { name: 'green',  min: 75, max: 100, label: 'Good',    className: 'kwb--good'    },
  { name: 'yellow', min: 50, max: 74,  label: 'Medium',  className: 'kwb--medium'  },
  { name: 'red',    min: 0,  max: 49,  label: 'Anomaly', className: 'kwb--anomaly' }
];

export function levelForWellbeing(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return ORG_WELLBEING_LEVELS[1];
  }
  if (numeric >= ORG_WELLBEING_LEVELS[0].min) return ORG_WELLBEING_LEVELS[0];
  if (numeric >= ORG_WELLBEING_LEVELS[1].min) return ORG_WELLBEING_LEVELS[1];
  return ORG_WELLBEING_LEVELS[2];
}
