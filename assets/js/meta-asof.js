(function(){
  if (typeof document === 'undefined') return;

  const nodes = document.querySelectorAll('#meta-asof-time');
  if (!nodes.length) return;

  const timeZone = 'Europe/Paris';
  const now = new Date();

  const partsFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const partMap = partsFormatter.formatToParts(now).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  const offsetSource = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset'
  })
    .formatToParts(now)
    .find(part => part.type === 'timeZoneName')?.value || 'UTC+00';

  const offsetMatch = offsetSource.match(/([+-])(\d{1,2})(?::?(\d{2}))?/);
  let offset = '+00:00';
  if (offsetMatch) {
    const sign = offsetMatch[1];
    const hours = offsetMatch[2].padStart(2, '0');
    const minutes = (offsetMatch[3] || '00').padStart(2, '0');
    offset = `${sign}${hours}:${minutes}`;
  }

  const isoParts = {
    year: partMap.year ?? String(now.getUTCFullYear()),
    month: partMap.month ?? String(now.getUTCMonth() + 1).padStart(2, '0'),
    day: partMap.day ?? String(now.getUTCDate()).padStart(2, '0'),
    hour: partMap.hour ?? String(now.getUTCHours()).padStart(2, '0'),
    minute: partMap.minute ?? String(now.getUTCMinutes()).padStart(2, '0'),
    second: partMap.second ?? String(now.getUTCSeconds()).padStart(2, '0')
  };

  const iso = `${isoParts.year}-${isoParts.month}-${isoParts.day}T${isoParts.hour}:${isoParts.minute}:${isoParts.second}${offset}`;

  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(now);

  const timeLabel = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(now);

  const offsetLabelMap = {
    '+01:00': 'CET',
    '+02:00': 'CEST'
  };

  const tzName = offsetLabelMap[offset] || new Intl.DateTimeFormat('en-GB', {
    timeZone,
    timeZoneName: 'short',
    hour: '2-digit'
  })
    .formatToParts(now)
    .find(part => part.type === 'timeZoneName')?.value || offset;

  const clean = value => String(value ?? '').replace(/\u202f/g, ' ').trim();
  const label = `${clean(dateLabel)} · ${clean(timeLabel)} ${tzName}`;

  nodes.forEach(node => {
    node.textContent = label;
    node.setAttribute('datetime', iso);
  });
})();
