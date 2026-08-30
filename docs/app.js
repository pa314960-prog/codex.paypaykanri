'use strict';

const yen = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
});

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

const sampleRows = [
  ['2026/08/29 18:42', 1860, 0, '支払い', 'スーパーマーケット', 'PayPay残高'],
  ['2026/08/27 07:36', 540, 0, '支払い', '駅前カフェ', 'PayPayクレジット'],
  ['2026/08/25 12:04', 0, 120, 'ポイント付与', 'PayPayポイント', 'PayPayポイント'],
  ['2026/08/23 20:15', 3280, 0, '支払い', '家電量販店', 'PayPay残高'],
  ['2026/08/18 16:22', 1200, 0, '送る', '友だちへの送金', 'PayPayマネー'],
  ['2026/08/11 09:08', 0, 10000, 'チャージ', '銀行口座', 'PayPay残高'],
  ['2026/08/08 13:31', 780, 0, '支払い', 'コンビニ', 'PayPay残高'],
  ['2026/07/30 19:12', 2650, 0, '支払い', 'レストラン', 'PayPayクレジット'],
  ['2026/07/21 17:48', 0, 88, 'ポイント付与', 'PayPayポイント', 'PayPayポイント'],
  ['2026/07/14 08:20', 430, 0, '支払い', 'コンビニ', 'PayPay残高'],
  ['2026/06/28 14:10', 4980, 0, '支払い', 'スポーツ用品店', 'PayPayクレジット'],
  ['2026/06/10 10:00', 0, 8000, 'チャージ', '銀行口座', 'PayPay残高'],
  ['2026/05/18 18:35', 1620, 0, '支払い', 'ドラッグストア', 'PayPay残高'],
  ['2026/04/09 12:18', 980, 0, '支払い', '書店', 'PayPay残高'],
];

const sampleTransactions = sampleRows.map((row, index) =>
  makeTransaction(row[0], row[1], row[2], row[3], row[4], row[5], `sample-${index}`),
);

const state = {
  transactions: sampleTransactions,
  fileName: 'サンプルデータ',
  demo: true,
  query: '',
  month: 'all',
  flow: 'all',
  page: 1,
  pageSize: 8,
};

const elements = {
  fileInput: document.querySelector('#fileInput'),
  fileButton: document.querySelector('#fileButton'),
  replaceButton: document.querySelector('#replaceButton'),
  dropZone: document.querySelector('#dropZone'),
  errorBanner: document.querySelector('#errorBanner'),
  demoBadge: document.querySelector('#demoBadge'),
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
  demoButton: document.querySelector('#demoButton'),
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
  return String(value).replace(/^\uFEFF/, '').replace(/[\s　]/g, '').toLowerCase();
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

function filteredTransactions() {
  const keyword = state.query.trim().toLowerCase();
  return state.transactions.filter((item) => {
    const matchesKeyword = !keyword || [item.counterparty, item.content, item.method, item.number]
      .join(' ')
      .toLowerCase()
      .includes(keyword);
    const matchesMonth = state.month === 'all' || item.month === state.month;
    const matchesFlow = state.flow === 'all' || (state.flow === 'out' ? item.outflow > 0 : item.inflow > 0);
    return matchesKeyword && matchesMonth && matchesFlow;
  });
}

function monthlyData() {
  const grouped = new Map();
  state.transactions.forEach((item) => {
    const current = grouped.get(item.month) || { month: item.month, outflow: 0, inflow: 0 };
    current.outflow += item.outflow;
    current.inflow += item.inflow;
    grouped.set(item.month, current);
  });
  return Array.from(grouped.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
}

function drawChart() {
  const canvas = elements.canvas;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);

  const width = rect.width;
  const height = rect.height;
  const padding = { top: 14, right: 12, bottom: 32, left: 48 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const data = monthlyData();
  const maxValue = Math.max(1, ...data.flatMap((item) => [item.outflow, item.inflow]));
  const roundedMax = Math.ceil(maxValue / 5000) * 5000 || 5000;

  ctx.clearRect(0, 0, width, height);
  ctx.font = '10px "Yu Gothic UI", sans-serif';
  ctx.textBaseline = 'middle';

  for (let step = 0; step <= 4; step += 1) {
    const y = padding.top + (plotHeight * step) / 4;
    const value = roundedMax - (roundedMax * step) / 4;
    ctx.strokeStyle = '#e7e9ed';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#7a8290';
    ctx.textAlign = 'right';
    const label = value >= 10000 ? `${Math.round(value / 10000)}万` : String(Math.round(value));
    ctx.fillText(label, padding.left - 8, y);
  }

  const groupWidth = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.min(23, Math.max(7, groupWidth * 0.22));
  data.forEach((item, index) => {
    const center = padding.left + groupWidth * index + groupWidth / 2;
    const values = [
      { value: item.outflow, color: '#ff003c', x: center - barWidth - 2 },
      { value: item.inflow, color: '#189d72', x: center + 2 },
    ];
    values.forEach((bar) => {
      const barHeight = (bar.value / roundedMax) * plotHeight;
      const y = padding.top + plotHeight - barHeight;
      ctx.fillStyle = bar.color;
      ctx.beginPath();
      const radius = Math.min(5, barWidth / 2, barHeight);
      ctx.roundRect(bar.x, y, barWidth, barHeight, [radius, radius, 0, 0]);
      ctx.fill();
    });
    ctx.fillStyle = '#747c89';
    ctx.textAlign = 'center';
    ctx.fillText(`${item.month.slice(5)}月`, center, height - 13);
  });
}

function renderBreakdown(filtered) {
  const grouped = new Map();
  filtered.forEach((item) => {
    if (item.outflow > 0) grouped.set(item.content, (grouped.get(item.content) || 0) + item.outflow);
  });
  const entries = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  elements.breakdown.replaceChildren();
  if (!entries.length) {
    const note = document.createElement('p');
    note.className = 'empty-note';
    note.textContent = '支出データがありません';
    elements.breakdown.append(note);
    return;
  }

  const total = entries.reduce((sum, entry) => sum + entry[1], 0) || 1;
  const colors = ['#ff003c', '#f59e0b', '#3b82f6', '#8b5cf6'];
  entries.forEach(([label, amount], index) => {
    const percent = Math.round((amount / total) * 100);
    const row = document.createElement('div');
    row.className = 'breakdown-row';
    const dot = document.createElement('span');
    dot.className = 'breakdown-dot';
    dot.style.background = colors[index];
    const labelElement = document.createElement('span');
    labelElement.className = 'breakdown-label';
    labelElement.textContent = label;
    const amountElement = document.createElement('span');
    amountElement.className = 'breakdown-amount';
    amountElement.textContent = yen.format(amount);
    const progress = document.createElement('span');
    progress.className = 'progress';
    const fill = document.createElement('span');
    fill.style.width = `${percent}%`;
    fill.style.background = colors[index];
    progress.append(fill);
    const percentElement = document.createElement('small');
    percentElement.className = 'breakdown-percent';
    percentElement.textContent = `${percent}%`;
    row.append(dot, labelElement, amountElement, progress, percentElement);
    elements.breakdown.append(row);
  });
}

function makeCell(className, text) {
  const cell = document.createElement('td');
  cell.className = className;
  cell.textContent = text;
  return cell;
}

function renderTable(filtered) {
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * state.pageSize;
  const rows = filtered.slice(start, start + state.pageSize);
  elements.transactionRows.replaceChildren();

  if (!rows.length) {
    const row = document.createElement('tr');
    const cell = makeCell('no-results', '条件に合う取引がありません');
    cell.colSpan = 4;
    row.append(cell);
    elements.transactionRows.append(row);
  } else {
    rows.forEach((item) => {
      const row = document.createElement('tr');
      row.append(makeCell('date-cell', item.date));
      const merchantCell = document.createElement('td');
      merchantCell.className = 'merchant-cell';
      const merchant = document.createElement('strong');
      merchant.textContent = item.counterparty;
      const content = document.createElement('small');
      content.textContent = item.content;
      merchantCell.append(merchant, content);
      row.append(merchantCell);
      row.append(makeCell('method-cell', item.method));
      const amount = makeCell(`amount-cell${item.outflow > 0 ? '' : ' income'}`, item.outflow > 0 ? `−${yen.format(item.outflow)}` : `＋${yen.format(item.inflow)}`);
      row.append(amount);
      elements.transactionRows.append(row);
    });
  }

  const from = filtered.length ? start + 1 : 0;
  const to = Math.min(start + state.pageSize, filtered.length);
  elements.resultRange.textContent = `${filtered.length.toLocaleString('ja-JP')}件中 ${from}〜${to}件`;
  elements.pageStatus.textContent = `${state.page} / ${totalPages}`;
  elements.prevButton.disabled = state.page <= 1;
  elements.nextButton.disabled = state.page >= totalPages;
}

function renderMonthOptions() {
  const months = Array.from(new Set(state.transactions.map((item) => item.month))).sort().reverse();
  const first = elements.monthSelect.firstElementChild;
  elements.monthSelect.replaceChildren(first);
  months.forEach((month) => {
    const option = document.createElement('option');
    option.value = month;
    option.textContent = `${month.replace('-', '年')}月`;
    elements.monthSelect.append(option);
  });
  elements.monthSelect.value = state.month;
}

function render() {
  const filtered = filteredTransactions();
  const totals = filtered.reduce((sum, item) => ({ outflow: sum.outflow + item.outflow, inflow: sum.inflow + item.inflow }), { outflow: 0, inflow: 0 });
  elements.demoBadge.hidden = !state.demo;
  elements.replaceButton.hidden = !state.demo;
  elements.demoButton.disabled = state.demo;
  elements.fileStatus.replaceChildren();
  const dot = document.createElement('span');
  dot.textContent = '●';
  elements.fileStatus.append(dot, ` ${state.fileName}・${state.transactions.length.toLocaleString('ja-JP')}件を読み込み`);
  elements.outflowTotal.textContent = yen.format(totals.outflow);
  elements.outflowNote.textContent = `${filtered.filter((item) => item.outflow > 0).length}件の支払い`;
  elements.inflowTotal.textContent = yen.format(totals.inflow);
  elements.balanceTotal.textContent = yen.format(totals.inflow - totals.outflow);
  elements.transactionCount.textContent = `${filtered.length.toLocaleString('ja-JP')}件`;
  elements.periodNote.textContent = state.month === 'all' ? 'すべての期間' : `${state.month.replace('-', '年')}月`;
  renderBreakdown(filtered);
  renderTable(filtered);
  requestAnimationFrame(drawChart);
}

function showError(message) {
  elements.errorBanner.textContent = message;
  elements.errorBanner.hidden = false;
}

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
    state.transactions = transactionsFromCsv(decodeCsv(await file.arrayBuffer()));
    state.fileName = file.name;
    state.demo = false;
    state.query = '';
    state.month = 'all';
    state.flow = 'all';
    state.page = 1;
    elements.searchInput.value = '';
    elements.flowSelect.value = 'all';
    renderMonthOptions();
    render();
  } catch (error) {
    showError(error instanceof Error ? error.message : 'CSVを読み込めませんでした。');
  } finally {
    elements.fileInput.value = '';
  }
}

function showDemo() {
  state.transactions = sampleTransactions;
  state.fileName = 'サンプルデータ';
  state.demo = true;
  state.query = '';
  state.month = 'all';
  state.flow = 'all';
  state.page = 1;
  elements.errorBanner.hidden = true;
  elements.searchInput.value = '';
  elements.flowSelect.value = 'all';
  renderMonthOptions();
  render();
}

elements.fileButton.addEventListener('click', (event) => {
  event.stopPropagation();
  elements.fileInput.click();
});
elements.replaceButton.addEventListener('click', () => elements.fileInput.click());
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
elements.demoButton.addEventListener('click', showDemo);

new ResizeObserver(() => requestAnimationFrame(drawChart)).observe(elements.canvas.parentElement);
renderMonthOptions();
render();
