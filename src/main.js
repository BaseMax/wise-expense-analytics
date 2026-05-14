/**
 * Wise Expense Analytics - Main Application
 * Copyright 2026 Seyyed Ali Mohammadiyeh (Max Base)
 * MIT License
 * https://github.com/BaseMax/wise-expense-analytics
 */

'use strict';

const App = {
  transactions:     [],
  currencies:       [],
  selectedCurrency: null,
  analytics:        null,
  fileName:         '',
  dailyMonthFilter: 'ALL',
};

const $ = id => document.getElementById(id);

const Views = {
  upload:    $('view-upload'),
  error:     $('view-error'),
  dashboard: $('view-dashboard'),
};

function showView(name) {
  Object.values(Views).forEach(v => v.classList.remove('active'));
  Views[name].classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showLoading(msg = 'Processing…') {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `<div class="spinner"></div><div class="loading-text">${msg}</div>`;
    document.body.appendChild(overlay);
  }
  overlay.querySelector('.loading-text').textContent = msg;
  overlay.classList.add('visible');
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.remove('visible');
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✓', error: '✗', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = `${icons[type] || ''} ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function renderErrors(errors) {
  const container = $('error-list');
  container.innerHTML = '';

  const groups = groupValidationErrors(errors);

  groups.forEach(group => {
    const div = document.createElement('div');
    div.className = 'error-group';

    const header = document.createElement('div');
    header.className = 'error-group-header';
    header.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        ${group.warning
          ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
          : '<polygon points="7.86,2 16.14,2 22,7.86 22,16.14 16.14,22 7.86,22 2,16.14 2,7.86"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
      </svg>
      <span>${group.icon} ${group.label}</span>
      <span style="margin-left:auto;font-weight:400;opacity:.7">${group.errors.length} issue${group.errors.length !== 1 ? 's' : ''}</span>
    `;

    const body = document.createElement('div');
    body.className = 'error-group-body';

    group.errors.forEach(err => {
      const item = document.createElement('div');
      item.className = 'error-item';

      const parts = [];
      if (err.line != null) parts.push(`<span class="error-item-line">Line ${err.line}</span>`);
      if (err.column)       parts.push(`<span class="error-item-col">${err.column}</span>`);
      parts.push(`<span>${err.message}</span>`);

      item.innerHTML = parts.join('');
      body.appendChild(item);
    });

    div.appendChild(header);
    div.appendChild(body);
    container.appendChild(div);
  });
}

function renderCurrencyTabs() {
  const container = $('currency-tabs');
  container.innerHTML = '';
  App.currencies.forEach(cur => {
    const btn = document.createElement('button');
    btn.className = `tab-btn${cur === App.selectedCurrency ? ' active' : ''}`;
    btn.textContent = cur;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', cur === App.selectedCurrency ? 'true' : 'false');
    btn.addEventListener('click', () => {
      App.selectedCurrency = cur;
      refreshDashboard();
    });
    container.appendChild(btn);
  });
}

const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_NAMES_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function monthLabel(monthKey, long = false) {
  const [y, m] = monthKey.split('-');
  return `${(long ? MONTH_NAMES_LONG : MONTH_NAMES_SHORT)[parseInt(m, 10) - 1]} ${y}`;
}

function buildMonthNavigator() {
  const display = $('month-display');
  const prevBtn = $('month-prev');
  const nextBtn = $('month-next');
  if (!display || !prevBtn || !nextBtn) return;

  const sortedMonths = App.analytics?.sortedMonths || [];

  if (App.dailyMonthFilter === 'ALL') {
    display.textContent = 'All Months';
    prevBtn.disabled = true;
    nextBtn.disabled = sortedMonths.length === 0;
  } else {
    const idx = sortedMonths.indexOf(App.dailyMonthFilter);
    display.textContent = monthLabel(App.dailyMonthFilter);
    prevBtn.disabled = false;
    nextBtn.disabled = idx >= sortedMonths.length - 1;
  }
}

function navigateMonth(delta) {
  const sortedMonths = App.analytics?.sortedMonths || [];
  if (!sortedMonths.length) return;

  if (App.dailyMonthFilter === 'ALL') {
    if (delta > 0) App.dailyMonthFilter = sortedMonths[sortedMonths.length - 1];
    else return;
  } else {
    const idx    = sortedMonths.indexOf(App.dailyMonthFilter);
    const newIdx = (idx === -1 ? sortedMonths.length - 1 : idx) + delta;
    if (newIdx < 0) {
      App.dailyMonthFilter = 'ALL';
    } else if (newIdx >= sortedMonths.length) {
      return;
    } else {
      App.dailyMonthFilter = sortedMonths[newIdx];
    }
  }

  buildMonthNavigator();
  renderDailyChart(App.analytics, App.dailyMonthFilter);
  renderDailyBreakdownTable(App.dailyMonthFilter);
}

function renderDailyBreakdownTable(monthKey) {
  const container = $('daily-breakdown');
  if (!container) return;

  if (monthKey === 'ALL') {
    container.innerHTML = `
      <div class="breakdown-hint">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Use the month navigator above to see a day-by-day breakdown table
      </div>`;
    return;
  }

  const currency     = App.selectedCurrency;
  const statusFilter = $('status-filter').value;

  const monthTxs = App.transactions.filter(t =>
    t.srcCurrency === currency &&
    t.monthKey    === monthKey &&
    t.direction   === 'OUT' &&
    (statusFilter === 'ALL' || t.status === statusFilter)
  );

  const byDay = {};
  monthTxs.forEach(t => {
    if (!byDay[t.dateKey]) byDay[t.dateKey] = { out: 0, count: 0, cats: {}, min: Infinity, max: -Infinity };
    const d = byDay[t.dateKey];
    d.out  += t.srcAmount;
    d.count++;
    d.cats[t.category] = (d.cats[t.category] || 0) + t.srcAmount;
    if (t.srcAmount < d.min) d.min = t.srcAmount;
    if (t.srcAmount > d.max) d.max = t.srcAmount;
  });

  const days = Object.keys(byDay).sort();

  if (!days.length) {
    container.innerHTML = '<div class="empty-state">No spending data for this month</div>';
    return;
  }

  const maxOut   = Math.max(...days.map(d => byDay[d].out));
  const totalOut = days.reduce((s, d) => s + byDay[d].out, 0);
  const WDAYS    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const rows = days.map(dateKey => {
    const d      = byDay[dateKey];
    const date   = new Date(dateKey + 'T00:00:00');
    const topCat = Object.entries(d.cats).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const pct    = maxOut > 0 ? (d.out / maxOut * 100).toFixed(1) : 0;
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    return `
      <tr${isWeekend ? ' class="weekend-row"' : ''}>
        <td>
          <span class="day-num">${date.getDate()}</span>
          <span class="day-wday${isWeekend ? ' day-wday-weekend' : ''}">${WDAYS[date.getDay()]}</span>
        </td>
        <td>
          <div class="progress-bar-wrap" style="margin-bottom:5px">
            <div class="progress-bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="amount-out">${fmtAmt(d.out, currency)}</span>
        </td>
        <td>${d.count}</td>
        <td><span class="category-pill">${escHtml(topCat)}</span></td>
        <td class="amount-muted">${fmtAmt(d.min === Infinity ? 0 : d.min, currency)}</td>
        <td class="amount-muted">${fmtAmt(d.max === -Infinity ? 0 : d.max, currency)}</td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="breakdown-header">
      <span class="breakdown-title">${monthLabel(monthKey, true)}</span>
      <span class="breakdown-stat"><strong>${days.length}</strong> active day${days.length !== 1 ? 's' : ''}</span>
      <span class="breakdown-stat"><strong>${monthTxs.length}</strong> transaction${monthTxs.length !== 1 ? 's' : ''}</span>
      <span class="breakdown-stat">Total <strong class="amount-out">${fmtAmt(totalOut, currency)}</strong></span>
      <span class="breakdown-stat">Avg/day <strong>${fmtAmt(totalOut / days.length, currency)}</strong></span>
    </div>
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>Amount Spent</th>
            <th>Txns</th>
            <th>Top Category</th>
            <th>Min Txn</th>
            <th>Max Txn</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function fmtAmt(amount, currency) {
  return `${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ${currency}`;
}

function updateStats(a) {
  $('stat-total-out').textContent   = fmtAmt(a.totalOut,  a.currency);
  $('stat-total-in').textContent    = fmtAmt(a.totalIn,   a.currency);
  $('stat-count').textContent       = a.txCount.toLocaleString();
  $('stat-daily-avg').textContent   = fmtAmt(a.dailyAvg,  a.currency);
  $('stat-active-days').textContent = a.activeDays.toLocaleString();
  $('stat-merchants').textContent   = a.uniqueMerchants.toLocaleString();
}

function renderMerchantsTable(analytics) {
  const container = $('table-merchants');
  if (!analytics.topMerchants.length) {
    container.innerHTML = '<div class="empty-state">No merchant data</div>';
    return;
  }

  const maxAmt = analytics.topMerchants[0].amount;
  const rows = analytics.topMerchants.map((m, i) => `
    <tr class="rank-${i + 1}">
      <td><span class="rank-badge">${i + 1}</span>${escHtml(m.name)}</td>
      <td><span class="category-pill">${escHtml(m.category)}</span></td>
      <td>${m.count}</td>
      <td class="progress-cell">
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${((m.amount / maxAmt) * 100).toFixed(1)}%"></div>
        </div>
      </td>
      <td class="amount-out">${fmtAmt(m.amount, analytics.currency)}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Merchant</th>
          <th>Category</th>
          <th>Txns</th>
          <th>Share</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderMinMaxTable(analytics) {
  const container = $('table-minmax');
  const entries = Object.entries(analytics.minMaxPerMonth).sort(([a], [b]) => b.localeCompare(a));

  if (!entries.length) {
    container.innerHTML = '<div class="empty-state">No data available</div>';
    return;
  }

  const rows = entries.map(([monthKey, { min, max }]) => {
    const [y, mo] = monthKey.split('-');
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const label = `${names[parseInt(mo,10)-1]} ${y}`;
    return `
      <tr>
        <td>${label}</td>
        <td class="day-min">${fmtAmt(min.amount, analytics.currency)}<br><small style="opacity:.6;font-size:11px">${min.dateKey}</small></td>
        <td class="day-max">${fmtAmt(max.amount, analytics.currency)}<br><small style="opacity:.6;font-size:11px">${max.dateKey}</small></td>
        <td>${fmtAmt(max.amount - min.amount, analytics.currency)}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Month</th>
          <th>Min Day</th>
          <th>Max Day</th>
          <th>Range</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderMonthlySummaryTable(analytics) {
  const container = $('table-monthly-summary');
  const months = [...analytics.monthlySummary].reverse();

  if (!months.length) {
    container.innerHTML = '<div class="empty-state">No data available</div>';
    return;
  }

  const rows = months.map(m => `
    <tr>
      <td>${m.label}</td>
      <td class="amount-out">${fmtAmt(m.out, analytics.currency)}</td>
      <td class="amount-in">${fmtAmt(m.in, analytics.currency)}</td>
      <td class="${m.net >= 0 ? 'amount-in' : 'amount-out'}">${m.net >= 0 ? '+' : ''}${fmtAmt(m.net, analytics.currency)}</td>
      <td>${fmtAmt(m.dailyAvg, analytics.currency)}</td>
      <td>${m.activeDays} / ${m.daysInMonth}</td>
      <td>${m.count}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Month</th>
          <th>Total Spent</th>
          <th>Total Received</th>
          <th>Net</th>
          <th>Daily Avg</th>
          <th>Active / Total Days</th>
          <th>Transactions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function updateFileInfoBar() {
  $('display-filename').textContent = App.fileName || 'transactions.csv';

  const a = App.analytics;
  $('display-count').textContent = `${a.txCount.toLocaleString()} transaction${a.txCount !== 1 ? 's' : ''}`;

  if (a.minDate && a.maxDate) {
    const fmt = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    $('display-daterange').textContent = `${fmt(a.minDate)} – ${fmt(a.maxDate)}`;
  } else {
    $('display-daterange').textContent = '-';
  }
}

function refreshDashboard() {
  const statusFilter = $('status-filter').value;
  App.analytics = computeAnalytics(App.transactions, App.selectedCurrency, statusFilter);

  renderCurrencyTabs();
  buildMonthNavigator();
  updateStats(App.analytics);
  updateFileInfoBar();
  renderMerchantsTable(App.analytics);
  renderMinMaxTable(App.analytics);
  renderMonthlySummaryTable(App.analytics);
  renderAllCharts(App.analytics, App.dailyMonthFilter);
  renderDailyBreakdownTable(App.dailyMonthFilter);
}

function processFile(file) {
  if (!file) return;

  if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
    showToast('Please upload a .csv file.', 'error');
    return;
  }

  if (file.size > 20 * 1024 * 1024) {
    showToast('File is too large (max 20 MB).', 'error');
    return;
  }

  App.fileName = file.name;
  showLoading('Parsing CSV…');

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete(results) {
      hideLoading();

      const { valid, errors } = validateWiseCSV(results);

      if (!valid) {
        renderErrors(errors);
        showView('error');
        return;
      }

      const warnings = errors.filter(e => e.warning);
      if (warnings.length) {
        showToast(`${warnings.length} warning(s) found - data loaded anyway.`, 'info');
      }

      showLoading('Computing analytics…');

      setTimeout(() => {
        try {
          App.transactions      = parseTransactions(results.data);
          App.currencies        = detectCurrencies(App.transactions);
          App.selectedCurrency  = App.currencies[0] || 'EUR';
          App.dailyMonthFilter  = 'ALL';

          refreshDashboard();
          showView('dashboard');
          showToast(`Loaded ${App.transactions.length.toLocaleString()} transactions`, 'success');
        } catch (err) {
          console.error('[WEA]', err);
          showToast(`Error: ${err.message || err}`, 'error');
        } finally {
          hideLoading();
        }
      }, 50);
    },
    error(err) {
      hideLoading();
      showToast(`Failed to read file: ${err.message}`, 'error');
    },
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initEvents() {
  const fileInput = $('file-input');
  $('browse-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) processFile(file);
    fileInput.value = '';
  });

  const dropZone = $('drop-zone');
  dropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });

  document.addEventListener('dragover',  e => e.preventDefault());
  document.addEventListener('drop',      e => e.preventDefault());

  dropZone.addEventListener('dragenter', e => { e.preventDefault(); dropZone.classList.add('dragging'); });
  dropZone.addEventListener('dragleave', e => {
    if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('dragging');
  });
  dropZone.addEventListener('dragover',  e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });

  Views.upload.addEventListener('dragover', e => e.preventDefault());
  Views.upload.addEventListener('drop', e => {
    if (dropZone.contains(e.target)) return;
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });

  $('try-again-btn').addEventListener('click', () => {
    showView('upload');
    $('error-list').innerHTML = '';
  });

  $('change-file-btn').addEventListener('click', () => {
    showView('upload');
    destroyAllCharts();
    App.transactions = [];
    App.analytics    = null;
  });


  $('status-filter').addEventListener('change', () => refreshDashboard());

  $('month-prev').addEventListener('click', () => navigateMonth(-1));
  $('month-next').addEventListener('click', () => navigateMonth(+1));
}

document.addEventListener('DOMContentLoaded', () => {
  initEvents();
  showView('upload');
});
