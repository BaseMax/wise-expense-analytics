/**
 * Wise Expense Analytics - Analytics Engine
 * Copyright 2026 Seyyed Ali Mohammadiyeh (Max Base)
 * MIT License
 * https://github.com/BaseMax/wise-expense-analytics
 */

'use strict';

const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAY_NAMES     = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str.trim().replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

function toDateKey(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function toMonthKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-');
  return `${MONTH_NAMES_SHORT[parseInt(m, 10) - 1]} ${y}`;
}

function formatDayLabel(dateKey) {
  const d = new Date(dateKey + 'T00:00:00');
  return `${WEEKDAY_NAMES[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
}

function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * Convert raw PapaParse rows into typed transaction objects.
 * @param {Object[]} rows  Raw row objects from PapaParse
 * @returns {Transaction[]}
 */
function parseTransactions(rows) {
  return rows
    .map((row, i) => {
      const date = parseDate(row['Created on']);
      if (!date) return null;

      const srcAmt = parseFloat(row['Source amount (after fees)'] || 0) || 0;
      const tgtAmt = parseFloat(row['Target amount (after fees)'] || 0) || 0;
      const feeAmt = parseFloat(row['Source fee amount'] || 0) || 0;

      return {
        id:           (row['ID'] || '').trim(),
        status:       (row['Status'] || '').trim().toUpperCase(),
        direction:    (row['Direction'] || '').trim().toUpperCase(),
        date,
        dateKey:      toDateKey(date),
        monthKey:     toMonthKey(date),
        srcAmount:    srcAmt,
        srcCurrency:  (row['Source currency'] || '').trim().toUpperCase(),
        tgtAmount:    tgtAmt,
        tgtCurrency:  (row['Target currency'] || '').trim().toUpperCase(),
        feeAmount:    feeAmt,
        sourceName:   (row['Source name'] || '').trim(),
        targetName:   (row['Target name'] || '').trim(),
        category:     (row['Category'] || 'Uncategorized').trim() || 'Uncategorized',
        reference:    (row['Reference'] || '').trim(),
        note:         (row['Note'] || '').trim(),
        rowIndex:     i,
      };
    })
    .filter(Boolean);
}

/**
 * Detect all source currencies present in the transaction set,
 * sorted by most-used first (for OUT spending).
 */
function detectCurrencies(transactions) {
  const counts = {};
  transactions.forEach(t => {
    if (t.direction === 'OUT') {
      counts[t.srcCurrency] = (counts[t.srcCurrency] || 0) + 1;
    }
  });
  transactions.forEach(t => {
    if (t.direction === 'IN' && !counts[t.srcCurrency]) {
      counts[t.srcCurrency] = 0;
    }
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([cur]) => cur)
    .filter(Boolean);
}

/**
 * Filter transactions to a specific currency and optional status filter.
 */
function filterTransactions(transactions, currency, statusFilter = 'COMPLETED') {
  return transactions.filter(t => {
    const currencyMatch = currency === 'ALL' || t.srcCurrency === currency;
    const statusMatch   = statusFilter === 'ALL' || t.status === statusFilter;
    return currencyMatch && statusMatch;
  });
}

/**
 * Build daily totals { dateKey: { out, in, count } } for a filtered set.
 */
function buildDailyTotals(transactions) {
  const map = {};
  transactions.forEach(t => {
    if (!map[t.dateKey]) map[t.dateKey] = { out: 0, in: 0, count: 0, outCount: 0, inCount: 0 };
    if (t.direction === 'OUT') { map[t.dateKey].out += t.srcAmount; map[t.dateKey].outCount++; }
    if (t.direction === 'IN')  { map[t.dateKey].in  += t.srcAmount; map[t.dateKey].inCount++;  }
    map[t.dateKey].count++;
  });
  return map;
}

/**
 * Build monthly totals { monthKey: { out, in, count, activeDays } }.
 */
function buildMonthlyTotals(dailyTotals) {
  const map = {};
  Object.entries(dailyTotals).forEach(([dateKey, day]) => {
    const monthKey = dateKey.slice(0, 7);
    if (!map[monthKey]) map[monthKey] = { out: 0, in: 0, count: 0, activeDays: 0, outCount: 0, inCount: 0 };
    map[monthKey].out        += day.out;
    map[monthKey].in         += day.in;
    map[monthKey].count      += day.count;
    map[monthKey].outCount   += day.outCount;
    map[monthKey].inCount    += day.inCount;
    map[monthKey].activeDays += 1;
  });
  return map;
}

function buildDailyAvgPerMonth(monthlyTotals) {
  const dailyAvgPerMonth      = {};
  const dailyCountAvgPerMonth = {};
  Object.entries(monthlyTotals).forEach(([m, data]) => {
    dailyAvgPerMonth[m]      = data.activeDays > 0 ? data.out / data.activeDays : 0;
    dailyCountAvgPerMonth[m] = data.activeDays > 0 ? (data.outCount || 0) / data.activeDays : 0;
  });
  return { dailyAvgPerMonth, dailyCountAvgPerMonth };
}

function buildMinMaxPerMonth(dailyTotals) {
  const map = {};
  Object.entries(dailyTotals).forEach(([dateKey, day]) => {
    if (day.out === 0) return;
    const month = dateKey.slice(0, 7);
    if (!map[month]) map[month] = {
      min: { dateKey, amount: Infinity },
      max: { dateKey, amount: -Infinity },
    };
    if (day.out < map[month].min.amount) map[month].min = { dateKey, amount: day.out };
    if (day.out > map[month].max.amount) map[month].max = { dateKey, amount: day.out };
  });
  return map;
}

function buildCategories(txs) {
  const map = {};
  txs.filter(t => t.direction === 'OUT').forEach(t => {
    const cat = t.category || 'Uncategorized';
    if (!map[cat]) map[cat] = { amount: 0, count: 0 };
    map[cat].amount += t.srcAmount;
    map[cat].count++;
  });
  return Object.entries(map)
    .map(([name, d]) => ({ name, amount: d.amount, count: d.count }))
    .sort((a, b) => b.amount - a.amount);
}

function buildMerchants(txs, limit = 15) {
  const map = {};
  txs.filter(t => t.direction === 'OUT' && t.targetName).forEach(t => {
    if (!map[t.targetName]) map[t.targetName] = { amount: 0, count: 0, category: t.category };
    map[t.targetName].amount += t.srcAmount;
    map[t.targetName].count++;
  });
  const sorted = Object.entries(map)
    .map(([name, d]) => ({ name, amount: d.amount, count: d.count, category: d.category }))
    .sort((a, b) => b.amount - a.amount);
  return { topMerchants: sorted.slice(0, limit), uniqueMerchants: sorted.length };
}

function buildWeekdayPattern(txs) {
  const map = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
  txs.filter(t => t.direction === 'OUT').forEach(t => {
    const entry = map[t.date.getDay()];
    entry.total += t.srcAmount;
    entry.count++;
  });
  return WEEKDAY_NAMES.map((name, i) => ({
    name,
    short: name.slice(0, 3),
    avg:   map[i].count > 0 ? map[i].total / map[i].count : 0,
    total: map[i].total,
    count: map[i].count,
  }));
}

function buildMonthlySummary(monthlyTotals) {
  return Object.entries(monthlyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, data]) => ({
      monthKey,
      label:       formatMonthLabel(monthKey),
      out:         data.out,
      in:          data.in,
      net:         data.in - data.out,
      count:       data.count,
      activeDays:  data.activeDays,
      dailyAvg:    data.activeDays > 0 ? data.out / data.activeDays : 0,
      daysInMonth: daysInMonth(monthKey),
    }));
}

function buildDailyChartData(dailyTotals) {
  return Object.keys(dailyTotals).sort().map(d => ({
    dateKey:  d,
    label:    formatDayLabel(d),
    out:      dailyTotals[d].out,
    in:       dailyTotals[d].in,
    count:    dailyTotals[d].count,
    outCount: dailyTotals[d].outCount || 0,
    inCount:  dailyTotals[d].inCount  || 0,
  }));
}

function computeAnalytics(allTransactions, currency, statusFilter = 'COMPLETED') {
  const isAllCurrencies = currency === 'ALL';
  const txs = filterTransactions(allTransactions, currency, statusFilter);

  let totalOut = 0, totalIn = 0, totalFees = 0, outCount = 0, inCount = 0;
  const outByCurrency = {};
  const inByCurrency  = {};

  txs.forEach(t => {
    if (t.direction === 'OUT') {
      totalOut  += t.srcAmount;
      totalFees += t.feeAmount;
      outCount++;
      if (isAllCurrencies) outByCurrency[t.srcCurrency] = (outByCurrency[t.srcCurrency] || 0) + t.srcAmount;
    } else if (t.direction === 'IN') {
      totalIn += t.srcAmount;
      inCount++;
      if (isAllCurrencies) inByCurrency[t.srcCurrency] = (inByCurrency[t.srcCurrency] || 0) + t.srcAmount;
    }
  });

  const dailyTotals   = buildDailyTotals(txs);
  const monthlyTotals = buildMonthlyTotals(dailyTotals);

  const activeDays = Object.values(dailyTotals).filter(d => d.out > 0).length;
  const dailyAvg   = activeDays > 0 ? totalOut / activeDays : 0;

  const { dailyAvgPerMonth, dailyCountAvgPerMonth } = buildDailyAvgPerMonth(monthlyTotals);
  const { topMerchants, uniqueMerchants }            = buildMerchants(txs);

  const allDates = txs.map(t => t.date).filter(Boolean);

  return {
    currency,
    statusFilter,
    isAllCurrencies,
    outByCurrency,
    inByCurrency,
    totalOut,
    totalIn,
    totalFees,
    netBalance:           totalIn - totalOut,
    txCount:              txs.length,
    outCount,
    inCount,
    activeDays,
    dailyAvg,
    uniqueMerchants,
    minDate:              allDates.length ? new Date(Math.min(...allDates)) : null,
    maxDate:              allDates.length ? new Date(Math.max(...allDates)) : null,
    dailyTotals,
    monthlyTotals,
    dailyAvgPerMonth,
    dailyCountAvgPerMonth,
    minMaxPerMonth:       buildMinMaxPerMonth(dailyTotals),
    categories:           buildCategories(txs),
    topMerchants,
    weekdayPattern:       buildWeekdayPattern(txs),
    monthlySummary:       buildMonthlySummary(monthlyTotals),
    dailyChartData:       buildDailyChartData(dailyTotals),
    sortedMonths:         Object.keys(monthlyTotals).sort(),
  };
}
