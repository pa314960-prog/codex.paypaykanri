'use strict';

export const yen = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
});

export function filteredTransactions(transactions, { query, month, flow }) {
  const keyword = query.trim().toLowerCase();
  return transactions.filter((item) => {
    const matchesKeyword = !keyword || [item.counterparty, item.content, item.method, item.number]
      .join(' ')
      .toLowerCase()
      .includes(keyword);
    const matchesMonth = month === 'all' || item.month === month;
    const matchesFlow = flow === 'all' || (flow === 'out' ? item.outflow > 0 : item.inflow > 0);
    return matchesKeyword && matchesMonth && matchesFlow;
  });
}

export function monthlyData(transactions) {
  const grouped = new Map();
  transactions.forEach((item) => {
    const current = grouped.get(item.month) || { month: item.month, outflow: 0, inflow: 0 };
    current.outflow += item.outflow;
    current.inflow += item.inflow;
    grouped.set(item.month, current);
  });
  return Array.from(grouped.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
}

export function drawChart(canvas, transactions) {
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
  const data = monthlyData(transactions);
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

export function renderBreakdown(container, filtered) {
  const grouped = new Map();
  filtered.forEach((item) => {
    if (item.outflow > 0) grouped.set(item.content, (grouped.get(item.content) || 0) + item.outflow);
  });
  const entries = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  container.replaceChildren();
  if (!entries.length) {
    const note = document.createElement('p');
    note.className = 'empty-note';
    note.textContent = '支出データがありません';
    container.append(note);
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
    container.append(row);
  });
}

function makeCell(className, text) {
  const cell = document.createElement('td');
  cell.className = className;
  cell.textContent = text;
  return cell;
}

export function renderTable(elements, state, filtered, emptyMessage) {
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * state.pageSize;
  const rows = filtered.slice(start, start + state.pageSize);
  elements.transactionRows.replaceChildren();

  if (!rows.length) {
    const row = document.createElement('tr');
    const cell = makeCell('no-results', emptyMessage);
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

export function renderMonthOptions(selectEl, transactions, currentMonth) {
  const months = Array.from(new Set(transactions.map((item) => item.month))).sort().reverse();
  const first = selectEl.firstElementChild;
  selectEl.replaceChildren(first);
  months.forEach((month) => {
    const option = document.createElement('option');
    option.value = month;
    option.textContent = `${month.replace('-', '年')}月`;
    selectEl.append(option);
  });
  selectEl.value = currentMonth;
}
