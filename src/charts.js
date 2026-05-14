/**
 * Wise Expense Analytics - Chart Rendering
 * Copyright 2026 Seyyed Ali Mohammadiyeh (Max Base)
 * MIT License
 * https://github.com/BaseMax/wise-expense-analytics
 */

'use strict';

const T = {
  indigo:    '#6366f1',
  indigoL:   '#818cf8',
  purple:    '#8b5cf6',
  cyan:      '#06b6d4',
  green:     '#10b981',
  greenL:    '#34d399',
  red:       '#ef4444',
  redL:      '#f87171',
  amber:     '#f59e0b',
  amberL:    '#fbbf24',
  blue:      '#3b82f6',
  pink:      '#ec4899',
  teal:      '#14b8a6',
  orange:    '#f97316',
  lime:      '#84cc16',

  grid:      'rgba(30,45,74,0.7)',
  text:      '#9aacc8',
  textMuted: '#5a6e8f',
  card:      '#141c2e',
};

const CATEGORY_PALETTE = [
  T.indigo, T.purple, T.cyan, T.green, T.amber,
  T.red,    T.pink,   T.teal, T.orange,T.lime,
  T.blue,   '#a78bfa','#fb7185','#38bdf8','#4ade80',
];

function applyChartDefaults() {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.color          = T.text;
  Chart.defaults.borderColor    = T.grid;
  Chart.defaults.font.family    = "'Inter', sans-serif";
  Chart.defaults.font.size      = 12;
  Chart.defaults.plugins.legend.labels.color     = T.text;
  Chart.defaults.plugins.legend.labels.boxWidth  = 12;
  Chart.defaults.plugins.legend.labels.padding   = 16;
  Chart.defaults.plugins.tooltip.backgroundColor = '#1a2440';
  Chart.defaults.plugins.tooltip.borderColor     = '#253550';
  Chart.defaults.plugins.tooltip.borderWidth     = 1;
  Chart.defaults.plugins.tooltip.padding         = 12;
  Chart.defaults.plugins.tooltip.titleColor      = '#e8edf8';
  Chart.defaults.plugins.tooltip.bodyColor       = '#9aacc8';
  Chart.defaults.plugins.tooltip.cornerRadius    = 10;
  Chart.defaults.plugins.tooltip.titleFont       = { weight: '700', size: 13 };
}

function makeGradient(ctx, color, alpha1 = 0.45, alpha2 = 0.0) {
  const grad = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
  grad.addColorStop(0, hexAlpha(color, alpha1));
  grad.addColorStop(1, hexAlpha(color, alpha2));
  return grad;
}

function hexAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const _charts = {};

function destroyChart(id) {
  if (_charts[id]) {
    _charts[id].destroy();
    delete _charts[id];
  }
}

function destroyAllCharts() {
  Object.keys(_charts).forEach(destroyChart);
}

function fmt(amount, currency, decimals = 2) {
  return `${currency} ${amount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function renderMonthlyChart(analytics) {
  destroyChart('monthly');
  const el = document.getElementById('chart-monthly');
  if (!el) return;

  const { sortedMonths, monthlyTotals, currency } = analytics;
  const labels = sortedMonths.map(m => {
    const [y, mo] = m.split('-');
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${names[parseInt(mo,10)-1]} '${y.slice(2)}`;
  });

  const outData = sortedMonths.map(m => +monthlyTotals[m].out.toFixed(2));
  const inData  = sortedMonths.map(m => +monthlyTotals[m].in.toFixed(2));

  const ctx = el.getContext('2d');
  _charts.monthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Spent',
          data: outData,
          backgroundColor: hexAlpha(T.indigo, 0.8),
          hoverBackgroundColor: T.indigo,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Received',
          data: inData,
          backgroundColor: hexAlpha(T.green, 0.8),
          hoverBackgroundColor: T.green,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw, currency)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: T.grid },
          ticks: { color: T.text },
        },
        y: {
          grid: { color: T.grid },
          ticks: {
            color: T.text,
            callback: v => `${currency} ${v.toLocaleString()}`,
          },
          beginAtZero: true,
        },
      },
    },
  });
}

function renderDailyChart(analytics, monthFilter = 'ALL') {
  destroyChart('daily');
  const el = document.getElementById('chart-daily');
  if (!el) return;

  let data = analytics.dailyChartData;
  if (monthFilter !== 'ALL') {
    data = data.filter(d => d.dateKey.startsWith(monthFilter));
  }

  const labels  = data.map(d => d.label);
  const outData = data.map(d => +d.out.toFixed(2));

  const ctx = el.getContext('2d');
  const gradient = makeGradient(ctx, T.indigo, 0.4, 0.0);

  _charts.daily = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Daily Spending',
        data: outData,
        borderColor: T.indigoL,
        backgroundColor: gradient,
        borderWidth: 2,
        pointRadius: data.length > 60 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: T.indigoL,
        fill: true,
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` Spent: ${fmt(ctx.raw, analytics.currency)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: T.grid },
          ticks: {
            color: T.text,
            maxTicksLimit: 16,
            maxRotation: 45,
          },
        },
        y: {
          grid: { color: T.grid },
          ticks: {
            color: T.text,
            callback: v => `${analytics.currency} ${v.toLocaleString()}`,
          },
          beginAtZero: true,
        },
      },
    },
  });
}

function renderCategoryChart(analytics) {
  destroyChart('categories');
  const el = document.getElementById('chart-categories');
  if (!el) return;

  const cats = analytics.categories.slice(0, 10);
  if (!cats.length) return;

  _charts.categories = new Chart(el.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: cats.map(c => c.name),
      datasets: [{
        data: cats.map(c => +c.amount.toFixed(2)),
        backgroundColor: CATEGORY_PALETTE.slice(0, cats.length),
        hoverBackgroundColor: CATEGORY_PALETTE.slice(0, cats.length).map(c => c),
        borderWidth: 2,
        borderColor: '#141c2e',
        hoverBorderColor: '#1a2440',
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 14,
            font: { size: 11 },
            generateLabels: chart => {
              const ds = chart.data.datasets[0];
              const total = ds.data.reduce((a, b) => a + b, 0);
              return chart.data.labels.map((label, i) => ({
                text: `${label} (${((ds.data[i] / total) * 100).toFixed(1)}%)`,
                fillStyle: ds.backgroundColor[i],
                strokeStyle: ds.backgroundColor[i],
                lineWidth: 0,
                index: i,
                hidden: false,
              }));
            },
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = ((ctx.raw / total) * 100).toFixed(1);
              return ` ${fmt(ctx.raw, analytics.currency)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

function renderDailyAvgChart(analytics) {
  destroyChart('dailyAvg');
  const el = document.getElementById('chart-daily-avg');
  if (!el) return;

  const months = analytics.sortedMonths;
  const labels = months.map(m => {
    const [y, mo] = m.split('-');
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${names[parseInt(mo,10)-1]} '${y.slice(2)}`;
  });
  const avgs = months.map(m => +(analytics.dailyAvgPerMonth[m] || 0).toFixed(2));

  _charts.dailyAvg = new Chart(el.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Daily Avg',
        data: avgs,
        backgroundColor: months.map((_, i) =>
          hexAlpha(CATEGORY_PALETTE[i % CATEGORY_PALETTE.length], 0.8)
        ),
        hoverBackgroundColor: months.map((_, i) =>
          CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]
        ),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` Avg/day: ${fmt(ctx.raw, analytics.currency)}`,
          },
        },
      },
      scales: {
        x: { grid: { color: T.grid }, ticks: { color: T.text } },
        y: {
          grid: { color: T.grid },
          ticks: { color: T.text, callback: v => `${analytics.currency} ${v}` },
          beginAtZero: true,
        },
      },
    },
  });
}

function renderWeekdayChart(analytics) {
  destroyChart('weekday');
  const el = document.getElementById('chart-weekday');
  if (!el) return;

  const days = analytics.weekdayPattern;
  _charts.weekday = new Chart(el.getContext('2d'), {
    type: 'bar',
    data: {
      labels: days.map(d => d.short),
      datasets: [{
        label: 'Avg per Transaction',
        data: days.map(d => +d.avg.toFixed(2)),
        backgroundColor: days.map((_, i) =>
          hexAlpha([T.indigo,T.purple,T.cyan,T.green,T.amber,T.pink,T.orange][i], 0.8)
        ),
        hoverBackgroundColor: [T.indigo,T.purple,T.cyan,T.green,T.amber,T.pink,T.orange],
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: ([ctx]) => analytics.weekdayPattern[ctx.dataIndex].name,
            label: ctx => [
              ` Avg: ${fmt(ctx.raw, analytics.currency)}`,
              ` Transactions: ${analytics.weekdayPattern[ctx.dataIndex].count}`,
            ],
          },
        },
      },
      scales: {
        x: { grid: { color: T.grid }, ticks: { color: T.text } },
        y: {
          grid: { color: T.grid },
          ticks: { color: T.text, callback: v => `${analytics.currency} ${v}` },
          beginAtZero: true,
        },
      },
    },
  });
}

function renderAllCharts(analytics, monthFilter = 'ALL') {
  applyChartDefaults();
  renderMonthlyChart(analytics);
  renderDailyChart(analytics, monthFilter);
  renderCategoryChart(analytics);
  renderDailyAvgChart(analytics);
  renderWeekdayChart(analytics);
}
