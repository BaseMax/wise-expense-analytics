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

function buildMonthFilterOptions() {
  const sel = $('daily-month-filter');
  while (sel.options.length > 1) sel.remove(1);

  (App.analytics?.sortedMonths || []).forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    const [y, mo] = m.split('-');
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    opt.textContent = `${names[parseInt(mo, 10) - 1]} ${y}`;
    sel.appendChild(opt);
  });

  sel.value = App.dailyMonthFilter;
}

function fmtAmt(amount, currency) {
  return `${currency} ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
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
  buildMonthFilterOptions();
  updateStats(App.analytics);
  updateFileInfoBar();
  renderMerchantsTable(App.analytics);
  renderMinMaxTable(App.analytics);
  renderMonthlySummaryTable(App.analytics);
  renderAllCharts(App.analytics, App.dailyMonthFilter);
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
          console.error(err);
          showToast('Unexpected error processing file.', 'error');
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
    dropZone.classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });

  Views.upload.addEventListener('dragover', e => e.preventDefault());
  Views.upload.addEventListener('drop', e => {
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

  $('daily-month-filter').addEventListener('change', e => {
    App.dailyMonthFilter = e.target.value;
    renderDailyChart(App.analytics, App.dailyMonthFilter);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initEvents();
  showView('upload');
});
