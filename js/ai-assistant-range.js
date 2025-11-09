export function sliceHistoryByRange(history, range = 'today') {
  const byDate = d => new Date(d.date);
  const last = history?.at?.(-1) ? byDate(history.at(-1)) : null;
  if (!Array.isArray(history) || !history.length || !last) return Array.isArray(history) ? history : [];

  const start = new Date(last);
  if (range === 'today') {
    return history.filter(x => {
      const dt = byDate(x);
      return dt.toDateString() === last.toDateString();
    });
  }
  if (range === '7d') {
    start.setDate(start.getDate() - 6);
    return history.filter(x => byDate(x) >= start);
  }
  if (range === 'month') {
    start.setMonth(start.getMonth() - 1);
    return history.filter(x => byDate(x) >= start);
  }
  return history;
}
