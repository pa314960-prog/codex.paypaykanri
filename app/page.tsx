'use client';

import { useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, CalendarDays, CheckCircle2, ChevronLeft,
  ChevronRight, CircleDollarSign, FileSpreadsheet, LockKeyhole, Search,
  Sparkles, UploadCloud, WalletCards, X,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Transaction = {
  id: string;
  date: string;
  timestamp: number;
  month: string;
  outflow: number;
  inflow: number;
  content: string;
  counterparty: string;
  method: string;
  installment: string;
  user: string;
  number: string;
};

const yen = new Intl.NumberFormat('ja-JP', {
  style: 'currency', currency: 'JPY', maximumFractionDigits: 0,
});

const chartConfig = {
  outflow: { label: '支出', color: 'var(--color-paypay)' },
  inflow: { label: '入金', color: 'var(--color-income)' },
} satisfies ChartConfig;

function parseDate(value: string) {
  const cleaned = value.trim().replace(/-/g, '/');
  const match = cleaned.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return { timestamp: 0, month: '日付不明' };
  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
  return {
    timestamp: new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).getTime(),
    month: `${year}-${month.padStart(2, '0')}`,
  };
}

function makeTransaction(
  date: string, outflow: number, inflow: number, content: string,
  counterparty: string, method: string, id: string, details: Partial<Transaction> = {},
): Transaction {
  const parsed = parseDate(date);
  return {
    id, date, timestamp: parsed.timestamp, month: parsed.month, outflow, inflow,
    content: content || 'その他', counterparty: counterparty || '—', method: method || '—',
    installment: details.installment ?? '', user: details.user ?? '', number: details.number ?? '',
  };
}

const sampleTransactions: Transaction[] = [
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
].map(([date, outflow, inflow, content, counterparty, method], index) =>
  makeTransaction(String(date), Number(outflow), Number(inflow), String(content), String(counterparty), String(method), `sample-${index}`),
);

function parseNumber(value = '') {
  const normalized = value.replace(/[￥¥円,\s]/g, '').replace(/^\((.+)\)$/, '-$1');
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.abs(number) : 0;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(field); field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = []; field = '';
    } else field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, '').replace(/[\s　]/g, '').toLowerCase();
}

function transactionsFromCsv(text: string) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSVに取引データが見つかりませんでした。');
  const headers = rows[0].map(normalizeHeader);
  const find = (...names: string[]) => headers.findIndex((header) => names.map(normalizeHeader).includes(header));
  const columns = {
    date: find('取引日', '取引日時'),
    outflow: find('出金金額（円）', '出金金額(円)', '出金金額'),
    inflow: find('入金金額（円）', '入金金額(円)', '入金金額'),
    content: find('取引内容'), counterparty: find('取引先', '店舗名'),
    method: find('取引方法', '支払い方法'), installment: find('支払い区分'),
    user: find('利用者'), number: find('取引番号', '決済番号'), merchantAmount: find('取引金額'),
  };
  if (columns.date < 0 || (columns.outflow < 0 && columns.inflow < 0 && columns.merchantAmount < 0)) {
    throw new Error('PayPayのCSV形式を確認できませんでした。「取引日」と「出金金額（円）／入金金額（円）」を含むファイルを選んでください。');
  }
  const value = (row: string[], index: number) => (index >= 0 ? (row[index] ?? '').trim() : '');
  const transactions = rows.slice(1).map((row, index) => {
    const merchantAmount = Number(value(row, columns.merchantAmount).replace(/[,\s]/g, '')) || 0;
    const transactionNumber = value(row, columns.number);
    return makeTransaction(
      value(row, columns.date),
      columns.outflow >= 0 ? parseNumber(value(row, columns.outflow)) : Math.abs(Math.min(merchantAmount, 0)),
      columns.inflow >= 0 ? parseNumber(value(row, columns.inflow)) : Math.max(merchantAmount, 0),
      value(row, columns.content) || (merchantAmount < 0 ? '返金' : '支払い'),
      value(row, columns.counterparty), value(row, columns.method), transactionNumber || `row-${index}`,
      { installment: value(row, columns.installment), user: value(row, columns.user), number: transactionNumber },
    );
  });
  const valid = transactions.filter((transaction) => transaction.date && transaction.timestamp > 0);
  if (!valid.length) throw new Error('読み取れる取引日がありませんでした。CSVの内容を確認してください。');
  return valid.sort((a, b) => b.timestamp - a.timestamp);
}

function decodeCsv(buffer: ArrayBuffer) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch { return new TextDecoder('shift_jis').decode(buffer); }
}

function StatCard({ label, value, note, icon, tone = 'neutral' }: {
  label: string; value: string; note: string; icon: React.ReactNode; tone?: 'red' | 'green' | 'neutral';
}) {
  return (
    <Card className="stat-card">
      <CardHeader className="pb-0"><div className={`stat-icon stat-icon-${tone}`}>{icon}</div><CardDescription>{label}</CardDescription></CardHeader>
      <CardContent><p className="stat-value">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></CardContent>
    </Card>
  );
}

export default function Home() {
  const [transactions, setTransactions] = useState(sampleTransactions);
  const [fileName, setFileName] = useState('サンプルデータ');
  const [isDemo, setIsDemo] = useState(true);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState('all');
  const [flow, setFlow] = useState('all');
  const [page, setPage] = useState(1);
  const fileInput = useRef<HTMLInputElement>(null);

  const months = useMemo(() => Array.from(new Set(transactions.map((item) => item.month))).sort().reverse(), [transactions]);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return transactions.filter((item) => {
      const matchesKeyword = !keyword || [item.counterparty, item.content, item.method, item.number].join(' ').toLowerCase().includes(keyword);
      const matchesMonth = month === 'all' || item.month === month;
      const matchesFlow = flow === 'all' || (flow === 'out' ? item.outflow > 0 : item.inflow > 0);
      return matchesKeyword && matchesMonth && matchesFlow;
    });
  }, [transactions, query, month, flow]);

  const totals = useMemo(() => filtered.reduce((sum, item) => ({ outflow: sum.outflow + item.outflow, inflow: sum.inflow + item.inflow }), { outflow: 0, inflow: 0 }), [filtered]);
  const monthlyData = useMemo(() => {
    const grouped = new Map<string, { month: string; outflow: number; inflow: number }>();
    transactions.forEach((item) => {
      const current = grouped.get(item.month) ?? { month: item.month, outflow: 0, inflow: 0 };
      current.outflow += item.outflow; current.inflow += item.inflow; grouped.set(item.month, current);
    });
    return Array.from(grouped.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [transactions]);
  const contentBreakdown = useMemo(() => {
    const grouped = new Map<string, number>();
    filtered.forEach((item) => { if (item.outflow > 0) grouped.set(item.content, (grouped.get(item.content) ?? 0) + item.outflow); });
    const total = Array.from(grouped.values()).reduce((sum, amount) => sum + amount, 0) || 1;
    return Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([label, amount]) => ({ label, amount, percent: Math.round((amount / total) * 100) }));
  }, [filtered]);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function loadFile(file?: File) {
    if (!file) return;
    setError('');
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('CSVファイルを選んでください。'); return; }
    if (file.size > 15 * 1024 * 1024) { setError('15MB以下のCSVファイルを選んでください。'); return; }
    try {
      const parsed = transactionsFromCsv(decodeCsv(await file.arrayBuffer()));
      setTransactions(parsed); setFileName(file.name); setIsDemo(false);
      setQuery(''); setMonth('all'); setFlow('all'); setPage(1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'CSVを読み込めませんでした。');
    }
  }

  function showDemo() {
    setTransactions(sampleTransactions); setFileName('サンプルデータ'); setIsDemo(true);
    setError(''); setQuery(''); setMonth('all'); setFlow('all'); setPage(1);
  }

  return (
    <main className="min-h-screen pb-16">
      <header className="topbar">
        <div className="page-shell flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="brand-mark"><WalletCards aria-hidden="true" /></div>
            <div><p className="font-heading text-[17px] font-bold leading-tight tracking-tight">PayLog</p><p className="text-[10px] font-medium text-muted-foreground">PAYPAY CSV VIEWER</p></div>
          </div>
          <div className="privacy-pill"><LockKeyhole aria-hidden="true" /><span>データは外部送信されません</span></div>
        </div>
      </header>

      <div className="page-shell pt-7 md:pt-10">
        <section className="intro-grid">
          <div>
            <Badge variant="outline" className="mb-3 border-paypay/25 bg-paypay-soft text-paypay"><Sparkles data-icon="inline-start" /> かんたん家計チェック</Badge>
            <h1 className="font-heading text-3xl font-bold tracking-[-0.04em] md:text-[40px] md:leading-[1.15]">PayPayの取引を、<br className="hidden sm:block" />ひと目でわかりやすく。</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground md:text-base">PayPayアプリからダウンロードしたCSVを読み込むと、支出・入金・月ごとの変化を自動で整理します。</p>
          </div>
          <div
            className={`drop-zone ${isDragging ? 'is-dragging' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => { event.preventDefault(); setIsDragging(false); void loadFile(event.dataTransfer.files[0]); }}
          >
            <input ref={fileInput} type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void loadFile(event.target.files?.[0])} aria-label="PayPayのCSVファイルを選択" />
            <div className="drop-icon"><UploadCloud aria-hidden="true" /></div>
            <div className="min-w-0 flex-1"><p className="font-semibold">CSVをここにドロップ</p><p className="mt-0.5 text-xs text-muted-foreground">UTF-8・Shift_JIS / 最大15MB</p></div>
            <Button className="upload-button" onClick={() => fileInput.current?.click()}><FileSpreadsheet data-icon="inline-start" /> ファイルを選ぶ</Button>
          </div>
        </section>

        {error && <div role="alert" className="error-banner"><X aria-hidden="true" /><span>{error}</span></div>}

        <section className="mt-8" aria-labelledby="dashboard-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2"><h2 id="dashboard-title" className="font-heading text-xl font-bold tracking-tight">取引サマリー</h2>{isDemo && <Badge variant="secondary">サンプル表示</Badge>}</div>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5 text-income" aria-hidden="true" />{fileName} ・ {transactions.length.toLocaleString('ja-JP')}件を読み込み</p>
            </div>
            {isDemo && <Button variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>自分のCSVに入れ替える</Button>}
          </div>
          <div className="stats-grid">
            <StatCard label="支出合計" value={yen.format(totals.outflow)} note={`${filtered.filter((item) => item.outflow > 0).length}件の支払い`} icon={<ArrowUpRight />} tone="red" />
            <StatCard label="入金合計" value={yen.format(totals.inflow)} note="チャージ・受け取り・ポイント" icon={<ArrowDownLeft />} tone="green" />
            <StatCard label="差し引き" value={yen.format(totals.inflow - totals.outflow)} note="入金 − 支出" icon={<CircleDollarSign />} />
            <StatCard label="対象取引" value={`${filtered.length.toLocaleString('ja-JP')}件`} note={month === 'all' ? 'すべての期間' : month.replace('-', '年') + '月'} icon={<CalendarDays />} />
          </div>
        </section>

        <section className="analysis-grid mt-5">
          <Card className="chart-card">
            <CardHeader><CardTitle>月ごとのお金の動き</CardTitle><CardDescription>直近6か月の支出と入金</CardDescription></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[260px] w-full aspect-auto">
                <BarChart data={monthlyData} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickFormatter={(value) => `${String(value).slice(5)}月`} />
                  <YAxis tickLine={false} axisLine={false} width={54} tickFormatter={(value) => value >= 10000 ? `${Math.round(value / 10000)}万` : String(value)} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value, name) => <div className="flex min-w-32 items-center justify-between gap-4"><span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label}</span><span className="font-mono font-semibold">{yen.format(Number(value))}</span></div>} />} />
                  <Bar dataKey="outflow" fill="var(--color-outflow)" radius={[5, 5, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="inflow" fill="var(--color-inflow)" radius={[5, 5, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ChartContainer>
              <div className="chart-legend"><span><i className="bg-paypay" />支出</span><span><i className="bg-income" />入金</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>支出の内訳</CardTitle><CardDescription>取引内容ごとの割合</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              {contentBreakdown.length ? contentBreakdown.map((item, index) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm"><div className="flex min-w-0 items-center gap-2"><span className={`breakdown-dot dot-${index + 1}`} /><span className="truncate font-medium">{item.label}</span></div><span className="font-mono text-xs font-semibold tabular-nums">{yen.format(item.amount)}</span></div>
                  <div className="progress-track"><div className={`progress-fill fill-${index + 1}`} style={{ width: `${item.percent}%` }} /></div>
                  <p className="mt-1 text-right text-[10px] text-muted-foreground">{item.percent}%</p>
                </div>
              )) : <p className="py-16 text-center text-sm text-muted-foreground">支出データがありません</p>}
            </CardContent>
          </Card>
        </section>

        <section className="mt-5">
          <Card className="overflow-visible">
            <CardHeader className="border-b md:grid-cols-[1fr_auto]">
              <div><CardTitle>取引履歴</CardTitle><CardDescription>店名や取引内容で絞り込めます</CardDescription></div>
              <div className="filter-row">
                <label className="search-field"><Search aria-hidden="true" /><Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="店名・内容を検索" aria-label="取引を検索" /></label>
                <NativeSelect value={month} onChange={(event) => { setMonth(event.target.value); setPage(1); }} aria-label="月で絞り込み" className="w-[128px]">
                  <NativeSelectOption value="all">すべての月</NativeSelectOption>
                  {months.map((item) => <NativeSelectOption key={item} value={item}>{item.replace('-', '年')}月</NativeSelectOption>)}
                </NativeSelect>
                <NativeSelect value={flow} onChange={(event) => { setFlow(event.target.value); setPage(1); }} aria-label="入出金で絞り込み" className="w-[110px]">
                  <NativeSelectOption value="all">すべて</NativeSelectOption><NativeSelectOption value="out">支出のみ</NativeSelectOption><NativeSelectOption value="in">入金のみ</NativeSelectOption>
                </NativeSelect>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader><TableRow><TableHead className="pl-5">取引日</TableHead><TableHead>取引先 / 内容</TableHead><TableHead className="hidden md:table-cell">取引方法</TableHead><TableHead className="pr-5 text-right">金額</TableHead></TableRow></TableHeader>
                <TableBody>
                  {visibleRows.length ? visibleRows.map((item) => (
                    <TableRow key={`${item.id}-${item.date}`}>
                      <TableCell className="pl-5 text-xs text-muted-foreground">{item.date}</TableCell>
                      <TableCell><p className="max-w-[240px] truncate font-medium">{item.counterparty}</p><p className="text-xs text-muted-foreground">{item.content}</p></TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">{item.method}</TableCell>
                      <TableCell className={`pr-5 text-right font-mono font-semibold tabular-nums ${item.outflow > 0 ? 'text-foreground' : 'text-income'}`}>{item.outflow > 0 ? `−${yen.format(item.outflow)}` : `＋${yen.format(item.inflow)}`}</TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={4} className="h-28 text-center text-muted-foreground">条件に合う取引がありません</TableCell></TableRow>}
                </TableBody>
              </Table>
              <div className="table-footer">
                <p>{filtered.length.toLocaleString('ja-JP')}件中 {filtered.length ? (currentPage - 1) * pageSize + 1 : 0}〜{Math.min(currentPage * pageSize, filtered.length)}件</p>
                <div className="flex items-center gap-1"><Button variant="outline" size="icon-sm" aria-label="前のページ" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft /></Button><span className="min-w-14 text-center text-xs font-medium">{currentPage} / {totalPages}</span><Button variant="outline" size="icon-sm" aria-label="次のページ" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><ChevronRight /></Button></div>
              </div>
            </CardContent>
          </Card>
        </section>

        <footer className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border/70 pt-5 text-xs text-muted-foreground sm:flex-row"><p>CSVはこのブラウザ内だけで処理され、保存・送信されません。</p><Button variant="ghost" size="sm" onClick={showDemo} disabled={isDemo}>サンプルに戻す</Button></footer>
      </div>
    </main>
  );
}
