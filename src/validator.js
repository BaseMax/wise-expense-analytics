/**
 * Wise Expense Analytics - CSV Validator
 * Copyright 2026 Seyyed Ali Mohammadiyeh (Max Base)
 * MIT License
 * https://github.com/BaseMax/wise-expense-analytics
 */

'use strict';

const WISE_REQUIRED_COLUMNS = [
  'ID',
  'Status',
  'Direction',
  'Created on',
  'Source amount (after fees)',
  'Source currency',
  'Target name',
  'Target amount (after fees)',
  'Target currency',
];

const WISE_ALL_COLUMNS = [
  'ID', 'Status', 'Direction', 'Created on', 'Finished on',
  'Source fee amount', 'Source fee currency',
  'Target fee amount', 'Target fee currency',
  'Source name', 'Source amount (after fees)', 'Source currency',
  'Target name', 'Target amount (after fees)', 'Target currency',
  'Exchange rate', 'Reference', 'Batch', 'Created by', 'Category', 'Note',
];

const VALID_DIRECTIONS = new Set(['IN', 'OUT', 'NEUTRAL']);
const VALID_STATUSES   = new Set([
  'COMPLETED', 'CANCELLED', 'PENDING', 'FAILED',
  'REFUNDED', 'WAITING_FOR_AUTHORIZATION', 'CHARGED_BACK',
  'PROCESSING', 'UNKNOWN',
]);

const ERROR_META = {
  PARSE_ERROR:     { label: 'CSV Parse Error',          icon: '⚠' },
  EMPTY_FILE:      { label: 'Empty File',               icon: '📄' },
  MISSING_COLUMN:  { label: 'Missing Required Columns', icon: '🗂' },
  UNKNOWN_COLUMNS: { label: 'Unrecognised Columns',     icon: '❓' },
  COLUMN_COUNT:    { label: 'Malformed Rows',           icon: '🔢' },
  MISSING_VALUE:   { label: 'Missing Values',           icon: '✏' },
  INVALID_VALUE:   { label: 'Invalid Values',           icon: '✗' },
  INVALID_DATE:    { label: 'Invalid Dates',            icon: '📅' },
  INVALID_NUMBER:  { label: 'Invalid Numbers',          icon: '#' },
  TOO_MANY_ERRORS: { label: 'Notice',                   icon: 'ℹ' },
};

function makeError(type, line, column, message, warning = false) {
  const err = { type, line, column, message };
  if (warning) err.warning = true;
  return err;
}

function validateRowData(row, lineNum, headers, errors) {
  const actualCols   = Object.keys(row).length;
  const expectedCols = headers.length;
  if (actualCols !== expectedCols) {
    errors.push(makeError('COLUMN_COUNT', lineNum, null,
      `Row ${lineNum} has ${actualCols} column(s) but the header has ${expectedCols}. The row may be malformed.`
    ));
    return;
  }

  if (!row['ID'] || row['ID'].trim() === '') {
    errors.push(makeError('MISSING_VALUE', lineNum, 'ID',
      `Row ${lineNum}: The "ID" field is empty.`
    ));
  }

  const dir = (row['Direction'] || '').trim().toUpperCase();
  if (dir && !VALID_DIRECTIONS.has(dir)) {
    errors.push(makeError('INVALID_VALUE', lineNum, 'Direction',
      `Row ${lineNum}: Unrecognised direction "${row['Direction']}". File will still load.`, true
    ));
  }

  const status = (row['Status'] || '').trim().toUpperCase();
  if (status && !VALID_STATUSES.has(status)) {
    errors.push(makeError('INVALID_VALUE', lineNum, 'Status',
      `Row ${lineNum}: Unrecognised status "${row['Status']}". File will still load.`, true
    ));
  }

  const createdOn = (row['Created on'] || '').trim();
  if (!createdOn) {
    errors.push(makeError('MISSING_VALUE', lineNum, 'Created on',
      `Row ${lineNum}: The "Created on" field is empty.`
    ));
  } else if (isNaN(new Date(createdOn.replace(' ', 'T')).getTime())) {
    errors.push(makeError('INVALID_DATE', lineNum, 'Created on',
      `Row ${lineNum}: Cannot parse date "${createdOn}" in "Created on". Expected format: YYYY-MM-DD HH:MM:SS.`
    ));
  }

  const srcAmt = (row['Source amount (after fees)'] || '').trim();
  if (srcAmt !== '' && isNaN(parseFloat(srcAmt))) {
    errors.push(makeError('INVALID_NUMBER', lineNum, 'Source amount (after fees)',
      `Row ${lineNum}: Non-numeric value "${srcAmt}" in "Source amount (after fees)".`
    ));
  }

  const tgtAmt = (row['Target amount (after fees)'] || '').trim();
  if (tgtAmt !== '' && isNaN(parseFloat(tgtAmt))) {
    errors.push(makeError('INVALID_NUMBER', lineNum, 'Target amount (after fees)',
      `Row ${lineNum}: Non-numeric value "${tgtAmt}" in "Target amount (after fees)".`
    ));
  }

  const srcCur = (row['Source currency'] || '').trim();
  if (srcCur && !/^[A-Z]{2,5}$/.test(srcCur)) {
    errors.push(makeError('INVALID_VALUE', lineNum, 'Source currency',
      `Row ${lineNum}: Unexpected currency code "${srcCur}" in "Source currency".`
    ));
  }
}

function validateWiseCSV(parseResult) {
  const errors = [];

  if (parseResult.errors && parseResult.errors.length) {
    parseResult.errors.forEach(e => {
      errors.push(makeError('PARSE_ERROR', e.row != null ? e.row + 2 : null, null,
        `CSV parse error: ${e.message}`
      ));
    });
    return { valid: false, errors };
  }

  const rows = parseResult.data;

  if (!rows || rows.length === 0) {
    errors.push(makeError('EMPTY_FILE', null, null,
      'The file is empty. Please export a non-empty transaction history from Wise.'
    ));
    return { valid: false, errors };
  }

  const headers = parseResult.meta.fields || Object.keys(rows[0]);

  const missingCols = WISE_REQUIRED_COLUMNS.filter(col => !headers.includes(col));
  missingCols.forEach(col => {
    errors.push(makeError('MISSING_COLUMN', 1, col,
      `Required column "${col}" is missing from the header row.`
    ));
  });

  const unknownCols = headers.filter(col => col && !WISE_ALL_COLUMNS.includes(col));
  if (unknownCols.length > 0) {
    errors.push(makeError('UNKNOWN_COLUMNS', 1, unknownCols.join(', '),
      `Unrecognised column(s): ${unknownCols.map(c => `"${c}"`).join(', ')}. This file may not be a standard Wise export.`,
      true
    ));
  }

  if (missingCols.length > 0) return { valid: false, errors };

  const MAX_ERRORS = 30;

  rows.forEach((row, idx) => {
    if (errors.length < MAX_ERRORS) validateRowData(row, idx + 2, headers, errors);
  });

  if (errors.filter(e => !e.warning).length >= MAX_ERRORS) {
    errors.push(makeError('TOO_MANY_ERRORS', null, null,
      `Too many errors found. Only the first ${MAX_ERRORS} are shown. Please check your file and export it again from Wise.`,
      true
    ));
  }

  const blockingErrors = errors.filter(e => !e.warning);
  return { valid: blockingErrors.length === 0, errors };
}

/**
 * Group an array of ValidationError objects by their `type` for display.
 * Returns an array of { type, label, icon, errors[] }.
 */
function groupValidationErrors(errors) {
  const groups = {};
  errors.forEach(err => {
    if (!groups[err.type]) {
      const meta = ERROR_META[err.type] || { label: err.type, icon: '•' };
      groups[err.type] = { type: err.type, label: meta.label, icon: meta.icon, warning: !!err.warning, errors: [] };
    }
    groups[err.type].errors.push(err);
  });
  return Object.values(groups);
}
