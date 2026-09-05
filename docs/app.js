'use strict';

import { db } from './firebase-config.js';
import {
  collection, doc, getDocs, writeBatch, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {
  yen, filteredTransactions, drawChart, renderBreakdown, renderTable, renderMonthOptions,
} from './shared.js';

function parseDate(value) {
  const cleaned = String(value || '').trim().replace(/-/g, '/');
  const match = cleaned.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return { timestamp: 0, month: '日付不明' };
  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
  return {
    timestamp: new Date(+year, +month - 1, +day, +hour, +minute, +second).getTime(),
    month: `${year}-${month.padStart(2, '0')}`,
  };
}

function makeTransaction(date, outflow, inflow, content, counterparty, method, id, details = {}) {
  const parsed = parseDate(date);
  return {
    id,
    date,
    timestamp: parsed.timestamp,
    month: parsed.month,
    outflow,
    inflow,
    content: content || 'その他',
    counterparty: counterparty || '—',
    method: method || '—',
    installment: details.installment || '',
    user: details.user || '',
    number: details.number || '',
  };
}

const state = {
  transactions: [],
  query: '',
  month: 'all',
  flow: 'all',
  page: 1,
  pageSize: 100
};

const elements = {
  fileInput: document.querySelector('#fileInput'),
  fileButton: document.querySelector('#fileButton'),
  dropZone: document.querySelector('#dropZone'),
  errorBanner: document.querySelector('#errorBanner'),
  fileStatus: document.querySelector('#fileStatus'),
  outflowTotal: document.querySelector('#outflowTotal'),
  outflowNote: document.querySelector('#outflowNote'),
  inflowTotal: document.querySelector('#inflowTotal'),
  balanceTotal: document.querySelector('#balanceTotal'),
  transactionCount: document.querySelector('#transactionCount'),
  periodNote: document.querySelector('#periodNote'),
  canvas: document.querySelector('#monthlyChart'),
  breakdown: document.querySelector('#breakdown'),
  searchInput: document.querySelector('#searchInput'),
  monthSelect: document.querySelector('#monthSelect'),
  flowSelect: document.querySelector('#flowSelect'),
  transactionRows: document.querySelector('#transactionRows'),
  resultRange: document.querySelector('#resultRange'),
  pageStatus: document.querySelector('#pageStatus'),
  prevButton: document.querySelector('#prevButton'),
  nextButton: document.querySelector('#nextButton'),
};

function parseNumber(value = '') {
  const normalized = String(value).replace(/[￥¥円,\s]/g, '').replace(/^\((.+)\)$/, '-$1');
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.abs(number) : 0;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return String(value).replace(/^﻿/, '').replace(/[\s　]/g, '').toLowerCase();
}

function transactionsFromCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSVに取引データが見つかりませんでした。');

  const headers = rows[0].map(normalizeHeader);
  const find = (...names) => headers.findIndex((header) => names.map(normalizeHeader).includes(header));
  const columns = {
    date: find('取引日', '取引日時'),
    outflow: find('出金金額（円）', '出金金額(円)', '出金金額'),
    inflow: find('入金金額（円）', '入金金額(円)', '入金金額'),
    content: find('取引内容'),
    counterparty: find('取引先', '店舗名'),
    method: find('取引方法', '支払い方法'),
    installment: find('支払い区分'),
    user: find('利用者'),
    number: find('取引番号', '決済番号'),
    merchantAmount: find('取引金額'),
  };

  if (columns.date < 0 || (columns.outflow < 0 && columns.inflow < 0 && columns.merchantAmount < 0)) {
    throw new Error('PayPayのCSV形式を確認できませんでした。「取引日」と「出金金額（円）／入金金額（円）」を含むファイルを選んでください。');
  }

  const value = (row, index) => (index >= 0 ? String(row[index] || '').trim() : '');
  const transactions = rows.slice(1).map((row, index) => {
    const merchantAmount = Number(value(row, columns.merchantAmount).replace(/[,\s]/g, '')) || 0;
    const transactionNumber = value(row, columns.number);
    return makeTransaction(
      value(row, columns.date),
      columns.outflow >= 0 ? parseNumber(value(row, columns.outflow)) : Math.abs(Math.min(merchantAmount, 0)),
      columns.inflow >= 0 ? parseNumber(value(row, columns.inflow)) : Math.max(merchantAmount, 0),
      value(row, columns.content) || (merchantAmount < 0 ? '返金' : '支払い'),
      value(row, columns.counterparty),
      value(row, columns.method),
      transactionNumber || `row-${index}`,
      {
        installment: value(row, columns.installment),
        user: value(row, columns.user),
        number: transactionNumber,
      },
    );
  });

  const valid = transactions.filter((transaction) => transaction.date && transaction.timestamp > 0);
  if (!valid.length) throw new Error('読み取れる取引日がありませんでした。CSVの内容を確認してください。');
  return valid.sort((a, b) => b.timestamp - a.timestamp);
}

function decodeCsv(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('shift_jis').decode(buffer);
  }
}

function showError(message) {
  elements.errorBanner.textContent = message;
  elements.errorBanner.hidden = false;
}

function render() {
  const filtered = filteredTransactions(state.transactions, state);
  const totals = filtered.reduce((sum, item) => ({ outflow: sum.outflow + item.outflow, inflow: sum.inflow + item.inflow }), { outflow: 0, inflow: 0 });
  elements.fileStatus.textContent = state.transactions.length
    ? `● クラウドの取引データ・${state.transactions.length.toLocaleString('ja-JP')}件を読み込み`
    : 'まだ取引データがありません。CSVをアップロードしてください。';
  elements.outflowTotal.textContent = yen.format(totals.outflow);
  elements.outflowNote.textContent = `${filtered.filter((item) => item.outflow > 0).length}件の支払い`;
  elements.inflowTotal.textContent = yen.format(totals.inflow);
  elements.balanceTotal.textContent = yen.format(totals.inflow - totals.outflow);
  elements.transactionCount.textContent = `${filtered.length.toLocaleString('ja-JP')}件`;
  elements.periodNote.textContent = state.month === 'all' ? 'すべての期間' : `${state.month.replace('-', '年')}月`;
  renderBreakdown(elements.breakdown, filtered);
  renderTable(
    elements,
    state,
    filtered,
    state.transactions.length ? '条件に合う取引がありません' : 'CSVファイルをアップロードすると取引が表示されます',
  );
  requestAnimationFrame(() => drawChart(elements.canvas, state.transactions));
}

const transactionsCol = collection(db, 'transactions');

function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
  return result;
}

async function syncToFirestore(transactions) {
  const existing = await getDocs(transactionsCol);
  for (const group of chunk(existing.docs, 400)) {
    const batch = writeBatch(db);
    group.forEach((docSnapshot) => batch.delete(docSnapshot.ref));
    await batch.commit();
  }
  for (const group of chunk(transactions, 400)) {
    const batch = writeBatch(db);
    group.forEach((item) => batch.set(doc(transactionsCol), item));
    await batch.commit();
  }
}

onSnapshot(transactionsCol, (snapshot) => {
  state.transactions = snapshot.docs.map((docSnapshot) => docSnapshot.data()).sort((a, b) => b.timestamp - a.timestamp);
  state.page = 1;
  renderMonthOptions(elements.monthSelect, state.transactions, state.month);
  render();
}, (error) => {
  showError(`クラウドからの読み込みに失敗しました: ${error.message}`);
});

async function loadFile(file) {
  if (!file) return;
  elements.errorBanner.hidden = true;
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showError('CSVファイルを選んでください。');
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    showError('15MB以下のCSVファイルを選んでください。');
    return;
  }
  try {
    const transactions = transactionsFromCsv(decodeCsv(await file.arrayBuffer()));
    await syncToFirestore(transactions);
  } catch (error) {
    showError(error instanceof Error ? error.message : 'CSVを読み込めませんでした。');
  } finally {
    elements.fileInput.value = '';
  }
}

elements.fileButton.addEventListener('click', (event) => {
  event.stopPropagation();
  elements.fileInput.click();
});
elements.dropZone.addEventListener('click', () => elements.fileInput.click());
elements.dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    elements.fileInput.click();
  }
});
elements.fileInput.addEventListener('change', () => loadFile(elements.fileInput.files[0]));
elements.dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  elements.dropZone.classList.add('dragging');
});
elements.dropZone.addEventListener('dragleave', () => elements.dropZone.classList.remove('dragging'));
elements.dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  elements.dropZone.classList.remove('dragging');
  loadFile(event.dataTransfer.files[0]);
});
elements.searchInput.addEventListener('input', () => {
  state.query = elements.searchInput.value;
  state.page = 1;
  render();
});
elements.monthSelect.addEventListener('change', () => {
  state.month = elements.monthSelect.value;
  state.page = 1;
  render();
});
elements.flowSelect.addEventListener('change', () => {
  state.flow = elements.flowSelect.value;
  state.page = 1;
  render();
});
elements.prevButton.addEventListener('click', () => {
  state.page = Math.max(1, state.page - 1);
  render();
});
elements.nextButton.addEventListener('click', () => {
  state.page += 1;
  render();
});

new ResizeObserver(() => requestAnimationFrame(() => drawChart(elements.canvas, state.transactions))).observe(elements.canvas.parentElement);
render();
