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

/**
 * Validate a parsed PapaParse result against the Wise CSV schema.
 * @param {Object} parseResult  PapaParse result with { data, meta, errors }
 * @returns {{ valid: boolean, errors: ValidationError[] }}
 */
function validateWiseCSV(parseResult) {
  const errors = [];

  if (parseResult.errors && parseResult.errors.length) {
    parseResult.errors.forEach(e => {
      errors.push({
        type: 'PARSE_ERROR',
        line: e.row != null ? e.row + 2 : null,
        column: null,
        message: `CSV parse error: ${e.message}`,
      });
    });
    return { valid: false, errors };
  }

  const rows = parseResult.data;

  if (!rows || rows.length === 0) {
    errors.push({
      type: 'EMPTY_FILE',
      line: null,
      column: null,
      message: 'The file is empty. Please export a non-empty transaction history from Wise.',
    });
    return { valid: false, errors };
  }

  const headers = parseResult.meta.fields || Object.keys(rows[0]);

  const missingCols = WISE_REQUIRED_COLUMNS.filter(col => !headers.includes(col));
  if (missingCols.length > 0) {
    missingCols.forEach(col => {
      errors.push({
        type: 'MISSING_COLUMN',
        line: 1,
        column: col,
        message: `Required column "${col}" is missing from the header row.`,
      });
    });
  }

  const unknownCols = headers.filter(col => col && !WISE_ALL_COLUMNS.includes(col));
  if (unknownCols.length > 0) {
    errors.push({
      type: 'UNKNOWN_COLUMNS',
      line: 1,
      column: unknownCols.join(', '),
      message: `Unrecognised column(s): ${unknownCols.map(c => `"${c}"`).join(', ')}. This file may not be a standard Wise export.`,
      warning: true,
    });
  }

  if (missingCols.length > 0) {
    return { valid: false, errors };
  }

  const MAX_ERRORS = 30;

  rows.forEach((row, idx) => {
    if (errors.length >= MAX_ERRORS) return;
    const lineNum = idx + 2;

    const actualCols = Object.keys(row).length;
    const expectedCols = headers.length;
    if (actualCols !== expectedCols) {
      errors.push({
        type: 'COLUMN_COUNT',
        line: lineNum,
        column: null,
        message: `Row ${lineNum} has ${actualCols} column(s) but the header has ${expectedCols}. The row may be malformed.`,
      });
      return;
    }

    if (!row['ID'] || row['ID'].trim() === '') {
      errors.push({
        type: 'MISSING_VALUE',
        line: lineNum,
        column: 'ID',
        message: `Row ${lineNum}: The "ID" field is empty.`,
      });
    }

    const dir = (row['Direction'] || '').trim().toUpperCase();
    if (dir && !VALID_DIRECTIONS.has(dir)) {
      errors.push({
        type: 'INVALID_VALUE',
        line: lineNum,
        column: 'Direction',
        message: `Row ${lineNum}: Unrecognised direction "${row['Direction']}". File will still load.`,
        warning: true,
      });
    }

    const status = (row['Status'] || '').trim().toUpperCase();
    if (status && !VALID_STATUSES.has(status)) {
      errors.push({
        type: 'INVALID_VALUE',
        line: lineNum,
        column: 'Status',
        message: `Row ${lineNum}: Unrecognised status "${row['Status']}". File will still load.`,
        warning: true,
      });
    }

    const createdOn = (row['Created on'] || '').trim();
    if (createdOn) {
      const d = new Date(createdOn.replace(' ', 'T'));
      if (isNaN(d.getTime())) {
        errors.push({
          type: 'INVALID_DATE',
          line: lineNum,
          column: 'Created on',
          message: `Row ${lineNum}: Cannot parse date "${createdOn}" in "Created on". Expected format: YYYY-MM-DD HH:MM:SS.`,
        });
      }
    } else {
      errors.push({
        type: 'MISSING_VALUE',
        line: lineNum,
        column: 'Created on',
        message: `Row ${lineNum}: The "Created on" field is empty.`,
      });
    }

    const srcAmt = (row['Source amount (after fees)'] || '').trim();
    if (srcAmt !== '' && isNaN(parseFloat(srcAmt))) {
      errors.push({
        type: 'INVALID_NUMBER',
        line: lineNum,
        column: 'Source amount (after fees)',
        message: `Row ${lineNum}: Non-numeric value "${srcAmt}" in "Source amount (after fees)".`,
      });
    }

    const tgtAmt = (row['Target amount (after fees)'] || '').trim();
    if (tgtAmt !== '' && isNaN(parseFloat(tgtAmt))) {
      errors.push({
        type: 'INVALID_NUMBER',
        line: lineNum,
        column: 'Target amount (after fees)',
        message: `Row ${lineNum}: Non-numeric value "${tgtAmt}" in "Target amount (after fees)".`,
      });
    }

    const srcCur = (row['Source currency'] || '').trim();
    if (srcCur && !/^[A-Z]{2,5}$/.test(srcCur)) {
      errors.push({
        type: 'INVALID_VALUE',
        line: lineNum,
        column: 'Source currency',
        message: `Row ${lineNum}: Unexpected currency code "${srcCur}" in "Source currency".`,
      });
    }
  });

  if (errors.filter(e => !e.warning).length >= MAX_ERRORS) {
    errors.push({
      type: 'TOO_MANY_ERRORS',
      line: null,
      column: null,
      message: `Too many errors found. Only the first ${MAX_ERRORS} are shown. Please check your file and export it again from Wise.`,
      warning: true,
    });
  }

  const blockingErrors = errors.filter(e => !e.warning);
  return { valid: blockingErrors.length === 0, errors };
}

/**
 * Group an array of ValidationError objects by their `type` for display.
 * Returns an array of { type, label, icon, errors[] }.
 */
function groupValidationErrors(errors) {
  const META = {
    PARSE_ERROR:      { label: 'CSV Parse Error',          icon: '⚠' },
    EMPTY_FILE:       { label: 'Empty File',               icon: '📄' },
    MISSING_COLUMN:   { label: 'Missing Required Columns', icon: '🗂' },
    UNKNOWN_COLUMNS:  { label: 'Unrecognised Columns',     icon: '❓' },
    COLUMN_COUNT:     { label: 'Malformed Rows',           icon: '🔢' },
    MISSING_VALUE:    { label: 'Missing Values',           icon: '✏' },
    INVALID_VALUE:    { label: 'Invalid Values',           icon: '✗' },
    INVALID_DATE:     { label: 'Invalid Dates',            icon: '📅' },
    INVALID_NUMBER:   { label: 'Invalid Numbers',          icon: '#' },
    TOO_MANY_ERRORS:  { label: 'Notice',                   icon: 'ℹ' },
  };

  const groups = {};
  errors.forEach(err => {
    if (!groups[err.type]) {
      groups[err.type] = {
        type: err.type,
        label: (META[err.type] || { label: err.type }).label,
        icon:  (META[err.type] || { icon: '•' }).icon,
        warning: !!err.warning,
        errors: [],
      };
    }
    groups[err.type].errors.push(err);
  });

  return Object.values(groups);
}
