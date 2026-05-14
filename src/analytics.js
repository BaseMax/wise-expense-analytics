/**
 * Wise Expense Analytics - Analytics Engine
 * Copyright 2026 Seyyed Ali Mohammadiyeh (Max Base)
 * MIT License
 * https://github.com/BaseMax/wise-expense-analytics
 */

'use strict';

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
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
}

function formatDayLabel(dateKey) {
  const d = new Date(dateKey + 'T00:00:00');
  const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
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
    const currencyMatch = t.srcCurrency === currency;
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
    if (!map[t.dateKey]) map[t.dateKey] = { out: 0, in: 0, count: 0 };
    if (t.direction === 'OUT') map[t.dateKey].out += t.srcAmount;
    if (t.direction === 'IN')  map[t.dateKey].in  += t.srcAmount;
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
    if (!map[monthKey]) map[monthKey] = { out: 0, in: 0, count: 0, activeDays: 0 };
    map[monthKey].out        += day.out;
    map[monthKey].in         += day.in;
    map[monthKey].count      += day.count;
    map[monthKey].activeDays += 1;
  });
  return map;
}

/**
 * Main entry-point: compute full analytics for one currency.
 * @param {Transaction[]} allTransactions
 * @param {string} currency
 * @param {string} statusFilter 'COMPLETED' | 'ALL'
 * @returns {Analytics}
 */
function computeAnalytics(allTransactions, currency, statusFilter = 'COMPLETED') {
  const txs = filterTransactions(allTransactions, currency, statusFilter);

  let totalOut = 0, totalIn = 0, totalFees = 0;
  txs.forEach(t => {
    if (t.direction === 'OUT') { totalOut += t.srcAmount; totalFees += t.feeAmount; }
    if (t.direction === 'IN')  totalIn  += t.srcAmount;
  });

  const dailyTotals   = buildDailyTotals(txs);
  const monthlyTotals = buildMonthlyTotals(dailyTotals);

  const activeDays    = Object.keys(dailyTotals).filter(d => dailyTotals[d].out > 0).length;
  const outDays       = Object.entries(dailyTotals).filter(([, v]) => v.out > 0);
  const dailyAvg      = outDays.length > 0 ? totalOut / outDays.length : 0;

  const dailyAvgPerMonth = {};
  Object.entries(monthlyTotals).forEach(([month, m]) => {
    dailyAvgPerMonth[month] = m.activeDays > 0 ? m.out / m.activeDays : 0;
  });

  const minMaxPerMonth = {};
  Object.entries(dailyTotals).forEach(([dateKey, day]) => {
    if (day.out === 0) return;
    const month = dateKey.slice(0, 7);
    if (!minMaxPerMonth[month]) {
      minMaxPerMonth[month] = {
        min: { dateKey, amount: Infinity },
        max: { dateKey, amount: -Infinity },
      };
    }
    if (day.out < minMaxPerMonth[month].min.amount) minMaxPerMonth[month].min = { dateKey, amount: day.out };
    if (day.out > minMaxPerMonth[month].max.amount) minMaxPerMonth[month].max = { dateKey, amount: day.out };
  });

  const categoryMap = {};
  txs.filter(t => t.direction === 'OUT').forEach(t => {
    const cat = t.category || 'Uncategorized';
    if (!categoryMap[cat]) categoryMap[cat] = { amount: 0, count: 0 };
    categoryMap[cat].amount += t.srcAmount;
    categoryMap[cat].count++;
  });
  const categories = Object.entries(categoryMap)
    .map(([name, d]) => ({ name, amount: d.amount, count: d.count }))
    .sort((a, b) => b.amount - a.amount);

  const merchantMap = {};
  txs.filter(t => t.direction === 'OUT' && t.targetName).forEach(t => {
    if (!merchantMap[t.targetName]) merchantMap[t.targetName] = { amount: 0, count: 0, category: t.category };
    merchantMap[t.targetName].amount += t.srcAmount;
    merchantMap[t.targetName].count++;
  });
  const topMerchants = Object.entries(merchantMap)
    .map(([name, d]) => ({ name, amount: d.amount, count: d.count, category: d.category }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 15);

  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekdayMap   = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
  txs.filter(t => t.direction === 'OUT').forEach(t => {
    const dow = t.date.getDay();
    weekdayMap[dow].total += t.srcAmount;
    weekdayMap[dow].count++;
  });
  const weekdayPattern = weekdayNames.map((name, i) => ({
    name,
    short: name.slice(0, 3),
    avg:   weekdayMap[i].count > 0 ? weekdayMap[i].total / weekdayMap[i].count : 0,
    total: weekdayMap[i].total,
    count: weekdayMap[i].count,
  }));

  const allDates = txs.map(t => t.date).filter(Boolean);
  const minDate = allDates.length ? new Date(Math.min(...allDates)) : null;
  const maxDate = allDates.length ? new Date(Math.max(...allDates)) : null;

  const monthlySummary = Object.entries(monthlyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, data]) => ({
      monthKey,
      label:      formatMonthLabel(monthKey),
      out:        data.out,
      in:         data.in,
      net:        data.in - data.out,
      count:      data.count,
      activeDays: data.activeDays,
      dailyAvg:   data.activeDays > 0 ? data.out / data.activeDays : 0,
      daysInMonth: daysInMonth(monthKey),
    }));

  const sortedDays = Object.keys(dailyTotals).sort();
  const dailyChartData = sortedDays.map(d => ({
    dateKey: d,
    label:   formatDayLabel(d),
    out:     dailyTotals[d].out,
    in:      dailyTotals[d].in,
    count:   dailyTotals[d].count,
  }));

  return {
    currency,
    statusFilter,
    totalOut,
    totalIn,
    totalFees,
    netBalance:     totalIn - totalOut,
    txCount:        txs.length,
    outCount:       txs.filter(t => t.direction === 'OUT').length,
    inCount:        txs.filter(t => t.direction === 'IN').length,
    activeDays,
    dailyAvg,
    uniqueMerchants: Object.keys(merchantMap).length,
    minDate,
    maxDate,
    dailyTotals,
    monthlyTotals,
    dailyAvgPerMonth,
    minMaxPerMonth,
    categories,
    topMerchants,
    weekdayPattern,
    monthlySummary,
    dailyChartData,
    sortedMonths: Object.keys(monthlyTotals).sort(),
  };
}
