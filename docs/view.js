'use strict';

import { db } from './firebase-config.js';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {
  yen, filteredTransactions, drawChart, renderBreakdown, renderTable, renderMonthOptions,
} from './shared.js';

const state = {
  transactions: [],
  query: '',
  month: 'all',
  flow: 'all',
  page: 1,
  pageSize:100,
};

const elements = {
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

function showError(message) {
  elements.errorBanner.textContent = message;
  elements.errorBanner.hidden = false;
}

function render() {
  const filtered = filteredTransactions(state.transactions, state);
  const totals = filtered.reduce((sum, item) => ({ outflow: sum.outflow + item.outflow, inflow: sum.inflow + item.inflow }), { outflow: 0, inflow: 0 });
  elements.fileStatus.textContent = state.transactions.length
    ? `● 共有された取引データ・${state.transactions.length.toLocaleString('ja-JP')}件`
    : 'まだ取引データが登録されていません。';
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
    state.transactions.length ? '条件に合う取引がありません' : 'まだ取引データが登録されていません',
  );
  requestAnimationFrame(() => drawChart(elements.canvas, state.transactions));
}

onSnapshot(collection(db, 'transactions'), (snapshot) => {
  state.transactions = snapshot.docs.map((docSnapshot) => docSnapshot.data()).sort((a, b) => b.timestamp - a.timestamp);
  state.page = 1;
  renderMonthOptions(elements.monthSelect, state.transactions, state.month);
  render();
}, (error) => {
  showError(`クラウドからの読み込みに失敗しました: ${error.message}`);
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
