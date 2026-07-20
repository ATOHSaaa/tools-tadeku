import { todayKey } from './utils.js';

const KEY = (workId) => `iwe-stats-${workId}`;

export function loadStats(workId) {
  try {
    return JSON.parse(localStorage.getItem(KEY(workId)) || '{}');
  } catch {
    return {};
  }
}

export function saveStats(workId, stats) {
  localStorage.setItem(KEY(workId), JSON.stringify(stats));
}

export function recordDailyTotal(workId, totalChars) {
  const stats = loadStats(workId);
  const day = todayKey();
  stats[day] = totalChars;
  saveStats(workId, stats);
  return stats;
}

export function getLast30Days(stats) {
  const days = [];
  const d = new Date();
  for (let i = 29; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(x.getDate() - i);
    const pad = (n) => String(n).padStart(2, '0');
    const key = `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
    days.push({ key, label: `${x.getMonth() + 1}/${x.getDate()}`, total: stats[key] || 0 });
  }
  const deltas = days.map((day, i) => {
    if (i === 0) return { ...day, wrote: 0 };
    const prev = days[i - 1].total;
    const wrote = Math.max(0, day.total - prev);
    return { ...day, wrote };
  });
  return deltas;
}

export function renderStatsChart(container, workId, targetChars, currentTotal) {
  const stats = loadStats(workId);
  const days = getLast30Days(stats);
  const maxW = Math.max(1, ...days.map((d) => d.wrote));
  container.innerHTML = '';
  const summary = document.createElement('div');
  summary.className = 'stats-summary';
  const pct = targetChars ? Math.min(100, Math.round((currentTotal / targetChars) * 100)) : null;
  summary.innerHTML = `
    <div>作品合計: <strong>${currentTotal.toLocaleString()}</strong> 字</div>
    ${targetChars ? `<div>目標: ${targetChars.toLocaleString()} 字 (${pct}%)</div><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>` : ''}
  `;
  container.appendChild(summary);
  const chart = document.createElement('div');
  chart.className = 'stats-chart';
  for (const d of days) {
    const bar = document.createElement('div');
    bar.className = 'stats-bar';
    bar.title = `${d.key}: +${d.wrote}字`;
    bar.innerHTML = `<div class="stats-bar-fill" style="height:${Math.round((d.wrote / maxW) * 100)}%"></div><span>${d.label.split('/')[1]}</span>`;
    chart.appendChild(bar);
  }
  container.appendChild(chart);
}
