/* 가상 KIND 뷰어 — 영업(잠정)실적 공정공시 (iXBRL/XBRL) */
'use strict';
const DATA = window.KIND_DATA || [];

const METRICS = [
  { key: 'Revenue', ko: '매출액', el: 'ifrs-full:Revenue', suf: 'Revenue' },
  { key: 'OperatingIncomeLoss', ko: '영업이익', el: 'dart:OperatingIncomeLoss', suf: 'OperatingIncomeLoss' },
  { key: 'ProfitLossBeforeTax', ko: '법인세비용차감전계속사업이익', el: 'krx-common:ProfitLossFromContinuingOperationBeforeCorporateIncomeTax', suf: 'ProfitLossFromContinuingOperationBeforeCorporateIncomeTax' },
  { key: 'ProfitLoss', ko: '당기순이익', el: 'ifrs-full:ProfitLoss', suf: 'ProfitLoss' },
  { key: 'ProfitLossAttributableToOwnersOfParent', ko: '지배기업소유주지분순이익', el: 'ifrs-full:ProfitLossAttributableToOwnersOfParent', suf: 'ProfitLossAttributableToOwnersOfParent' },
];
const CTX = { current: { current: 'CUR_Q', cumulative: 'CUR_YTD' }, previous: { current: 'PREV_Q', cumulative: 'PREV_YTD' }, yoy: { current: 'YOY_Q', cumulative: 'YOY_YTD' } };
const RATE = {
  qoq: 'IncreaseAndDecreaseRateComparedToPreviousQuarter',
  yoy_cur: 'IncreaseAndDecreaseRateComparedToSamePeriodOfLastYear',
  yoy_cum: 'CumulativeIncreaseAndDecreaseRateComparedToSamePeriodOfLastYear',
};
const CTX_KO = {
  CUR_Q: '당분기(잠정)', CUR_YTD: '당분기누적(잠정)', PREV_Q: '직전분기',
  PREV_YTD: '직전분기누적', YOY_Q: '전년동기', YOY_YTD: '전년동기누적', META: '공시기준',
};

/* ---------- 가정 '오늘'(as-of) 시뮬레이션 클럭 ----------
   simNow = 사용자가 가정한 '지금'. 목록은 dt<=simNow 인 공시만 노출하고,
   확정치 공개(revealed)도 이 시각 기준으로 판단한다. 시간흐름 배속이 켜지면
   실제 경과시간 × 배속만큼 simNow가 전진하며 그 사이 접수된 공시가 나타난다. */
let simNow = new Date(2026, 0, 1, 0, 0, 0, 0);   // 기본: 2026-01-01 (시뮬레이션 시작점)
let flowMult = 0;                 // 시간흐름 배속 (0=정지)
let flowTimer = null, flowLast = 0;
let flashUids = new Set();        // 이번 렌더에서 '방금 접수' 하이라이트할 uid
const pad2 = n => String(n).padStart(2, '0');
function fmtSim(d, withTime) {
  const s = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return withTime ? `${s} ${pad2(d.getHours())}:${pad2(d.getMinutes())}` : s;
}
function simNowStr() { return fmtSim(simNow, true); }   // 'YYYY-MM-DD HH:MM' — r.dt와 동일 포맷
function nowStr() { return simNowStr(); }               // 목록 확정공개 기준 = 가정된 지금

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const comma = n => (n == null || n === '') ? '-' : Number(n).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
const num = (r, g, m, s) => { const v = (((r.fin || {})[g] || {})[m] || {})[s]; return (typeof v === 'number') ? v : null; };
const scaleFactor = r => Math.pow(10, r.scale || 0);

/* ---------- 팩트 설명(마우스오버) ---------- */
const DESC = {
  'ifrs-full:Revenue': '매출액 — 기업이 주된 영업활동(재화·용역 제공)으로 얻은 수익. IFRS 표준 element를 재사용.',
  'dart:OperatingIncomeLoss': '영업이익(손실) — 매출총이익에서 판매비와관리비를 차감한 영업활동 성과. 금융감독원(DART) 확장 element.',
  'krx-common:ProfitLossFromContinuingOperationBeforeCorporateIncomeTax': '법인세비용차감전계속사업이익(손실) — 법인세 차감 전 계속사업에서 발생한 손익. KRX 공통 element.',
  'ifrs-full:ProfitLoss': '당기순이익(손실) — 모든 수익·비용을 반영한 회계기간의 최종 손익.',
  'ifrs-full:ProfitLossAttributableToOwnersOfParent': '지배기업 소유주 지분 순이익 — 연결 당기순이익 중 지배기업 주주에게 귀속되는 몫. 연결 재무제표 전용 개념.',
  'krx-gcd:NameOfCompany': '회사명 — 공시 대상 상장법인 명칭과 종목코드.',
  'krx-md-ot:OtherPerformanceIndicators': '기타실적 — 표준 재무계정 외에 회사가 자율 기재하는 성과지표(예: 국가별 매출, 판매량). 문자열 타입이며, 기타실적구분(typed) 축에 항목명이 멤버로 부착된다.',
};
function descFor(el) {
  if (DESC[el]) return DESC[el];
  if (el.indexOf('CumulativeIncreaseAndDecreaseRate') >= 0) return '전년동기 대비 누적(YTD) 증감율 — 누계 기준. XBRL에는 소수로 태깅(예: 0.098 = 9.8%).';
  if (el.indexOf('IncreaseAndDecreaseRateComparedToPreviousQuarter') >= 0) return '직전분기 대비 증감율 — (당기−직전기)/|직전기|. XBRL에는 소수로 태깅(예: 0.057 = 5.7%).';
  if (el.indexOf('IncreaseAndDecreaseRateComparedToSamePeriodOfLastYear') >= 0) return '전년동기 대비 증감율 — 전년 동일 기간 대비. XBRL에는 소수로 태깅.';
  if (el.indexOf('StatusOfProfitLossTransition') >= 0) return '흑자/적자 전환 여부 — 열거형(profitorlosstransitionstatus): 1=흑자전환, 2=적자전환, -=해당없음.';
  return '';
}
/* 태깅된 값 1개 = .fact span (data-* 에 툴팁 정보 내장) */
function factSpan(el, ko, ctxId, ctx, unit, disp, extra, typed) {
  const per = ctx.start ? (ctx.start === ctx.end ? ctx.start : ctx.start + ' ~ ' + ctx.end) : '';
  const dim = ctx.preaudit ? '감사전잠정실적재무제표' : '';
  return `<span class="fact" data-el="${esc(el)}" data-ko="${esc(ko)}" data-ctxko="${esc(CTX_KO[ctxId] || ctxId)}" data-per="${per}" data-dim="${dim}" data-unit="${esc(unit)}" data-extra="${esc(extra || '')}" data-typed="${esc(typed || '')}">${disp}</span>`;
}
function moneyCell(r, group, span, m) {
  const v = num(r, group, m.key, span);
  if (v == null) return '<span class="dash">-</span>';
  const ctxId = CTX[group][span];
  const won = Math.round(v * scaleFactor(r));
  return factSpan(m.el, m.ko + ' (' + (span === 'current' ? '당해실적' : '누계실적') + ')',
    ctxId, r.ctx[ctxId] || {}, 'KRW(원)', comma(v), comma(won) + ' 원');
}
function buildTip(d) {
  let h = `<div class="tt-h">${d.ko}</div>`;
  h += `<div class="tt-r"><b>element</b><code>${d.el}</code></div>`;
  h += `<div class="tt-r"><b>컨텍스트</b>${d.ctxko}</div>`;
  if (d.per) h += `<div class="tt-r"><b>기간</b>${d.per}</div>`;
  if (d.dim) h += `<div class="tt-r"><b>Dimension</b><span class="tt-dim">${d.dim}</span></div>`;
  if (d.typed) h += `<div class="tt-r"><b>기타실적구분</b><span class="tt-dim" style="background:#1c3a5e;color:#bcd">${d.typed}</span></div>`;
  h += `<div class="tt-r"><b>단위</b>${d.unit}${d.extra ? ' · <b style="color:#fff">' + d.extra + '</b>' : ''}</div>`;
  const desc = descFor(d.el);
  if (desc) h += `<div class="tt-d">${desc}</div>`;
  return h;
}

/* ---------- 상태/필터 ---------- */
let state = { q: '', basis: 'all', sort: 'date', page: 1, perPage: 40, analysisMode: false, trustMetric: 'Revenue' };

function filtered() {
  const cur = simNowStr();                                  // 가정된 지금 — 이 시각 이후 접수분은 숨김
  let rows = DATA.filter(r => {
    if (r.dt && r.dt > cur) return false;                   // 아직 '접수되지 않은' 미래 공시 제외
    if (state.basis !== 'all' && r.basis !== state.basis) return false;
    if (state.q) {
      const q = state.q.toLowerCase();
      if (!(r.company.toLowerCase().includes(q) || r.code.includes(q))) return false;
    }
    return true;
  });
  rows.sort((a, b) => {
    if (state.sort === 'rev') return (num(b, 'current', 'Revenue', 'current') || -1) - (num(a, 'current', 'Revenue', 'current') || -1);
    if (state.sort === 'company') return a.company.localeCompare(b.company, 'ko');
    return (b.dt || '').localeCompare(a.dt || '');
  });
  return rows;
}

/* ---------- 목록 ---------- */
function renderList() {
  const rows = filtered();
  const total = rows.length, pages = Math.max(1, Math.ceil(total / state.perPage));
  state.page = Math.min(state.page, pages);
  const start = (state.page - 1) * state.perPage;
  const page = rows.slice(start, start + state.perPage);

  document.getElementById('stat').innerHTML =
    `총 <b>${total.toLocaleString()}</b>건 · 연결 ${rows.filter(r => r.basis === 'consolidated').length.toLocaleString()} · 별도 ${rows.filter(r => r.basis === 'separate').length.toLocaleString()}`;

  const body = page.map(r => {
    const rev = num(r, 'current', 'Revenue', 'current');
    const oi = num(r, 'current', 'OperatingIncomeLoss', 'current');
    const badge = r.basis === 'consolidated'
      ? '<span class="bg bg-c">연결</span>' : '<span class="bg bg-s">별도</span>';
    return `<tr class="${flashUids.has(r.uid) ? 'justin' : ''}" onclick="openDetail('${r.uid}')">
      <td class="dt">${esc(r.dt)}</td>
      <td class="cm"><b>${esc(r.company)}</b></td>
      <td class="cd">${esc(r.code)}</td>
      <td class="tt">${r.sub ? '<span class="subtag">자회사</span> ' : ''}${esc(r.title || '')}</td>
      <td>${badge}</td>
      <td class="n">${comma(rev)}</td>
      <td class="n">${comma(oi)}</td>
      <td class="u">${esc(r.unit.replace('단위 : ', ''))}</td>
    </tr>`;
  }).join('');

  document.getElementById('list').innerHTML = body ||
    '<tr><td colspan="8" class="empty">검색 결과가 없습니다.</td></tr>';

  // pager
  let pg = '';
  const win = 2;
  const add = (p, label, cur) => pg += `<button class="${cur ? 'cur' : ''}" ${cur ? '' : `onclick="gotoPage(${p})"`}>${label || p}</button>`;
  if (state.page > 1) add(state.page - 1, '‹');
  for (let p = Math.max(1, state.page - win); p <= Math.min(pages, state.page + win); p++) add(p, null, p === state.page);
  if (state.page < pages) add(state.page + 1, '›');
  document.getElementById('pager').innerHTML =
    `<span class="pinfo">${start + 1}–${Math.min(start + state.perPage, total)} / ${total.toLocaleString()} (p.${state.page}/${pages})</span>` + pg;
}
window.gotoPage = p => { state.page = p; renderList(); window.scrollTo(0, 0); };

/* ---------- 상세 ---------- */
function rateVal(r, kind, m, span) {
  const g = kind === 'qoq' ? 'qoq' : 'yoy_rate';
  const v = (((r.fin || {})[g] || {})[m.key] || {})[span];
  if (typeof v === 'number') return { pct: v };
  const t = (((r.trans || {})[g] || {})[m.key] || {})[span];
  if (t) return { txt: t };
  return null;
}
function rateCell(r, kind, m, span) {
  const v = rateVal(r, kind, m, span);
  if (!v) return '<span class="dash">-</span>';
  const ctx = r.ctx['CUR_Q'] || {};
  if (v.txt) {
    const tel = 'krx-md-ot:StatusOfProfitLossTransition' +
      (kind === 'qoq' ? 'ComparedToPreviousQuarter' : 'ComparedToPreviousYear') + m.suf;
    return factSpan(tel, m.ko + ' 흑자/적자 전환여부', 'CUR_Q', ctx, '전환코드',
      `<span class="trans">${esc(v.txt)}</span>`, v.txt === '흑자전환' ? '1 (흑자전환)' : '2 (적자전환)');
  }
  const el = `krx-md-ot:${RATE[kind]}${m.suf}`;
  const cls = v.pct < 0 ? 'down' : 'up';
  const disp = `<span class="${cls}">${v.pct > 0 ? '+' : ''}${comma(v.pct)}</span>`;
  return factSpan(el, m.ko + ' 증감율', 'CUR_Q', ctx, 'PURE(소수)', disp, (v.pct / 100).toFixed(4));
}

function perfTable(r) {
  const conn = r.basis === 'consolidated';
  const ms = METRICS.filter(m => conn || m.key !== 'ProfitLossAttributableToOwnersOfParent');
  let body = '';
  for (const m of ms) {
    for (const [span, sko] of [['current', '당해실적'], ['cumulative', '누계실적']]) {
      const v = num(r, 'current', m.key, span);
      const curC = moneyCell(r, 'current', span, m);
      const qoq = span === 'current' ? rateCell(r, 'qoq', m, 'current') : '<span class="dash">-</span>';
      const yr = rateCell(r, span === 'current' ? 'yoy_cur' : 'yoy_cum', m, span);
      const first = span === 'current' ? `<td rowspan="2" class="mt">${esc(m.ko)}</td>` : '';
      // 값이 있으면 당해/누계 셀 클릭 시 시계열 바차트
      const ca = `data-chart="metric" data-mk="${m.key}" data-span="${span}"`;
      const spCell = v == null ? `<td class="sp">${sko}</td>`
        : `<td class="sp chartable" ${ca} title="클릭: ${esc(m.ko)} ${sko} 시계열">${sko}</td>`;
      const curCell = v == null ? `<td class="n">${curC}</td>`
        : `<td class="n chartable" ${ca} title="클릭: ${esc(m.ko)} ${sko} 시계열">${curC} <span class="chart-ic">📊</span></td>`;
      body += `<tr>${first}${spCell}${curCell}<td class="n">${qoq}</td><td class="n">${yr}</td></tr>`;
    }
  }
  const p = r.periods || {};
  return `<table class="perf">
    <thead><tr><th colspan="2">구분</th>
      <th>당기실적<br><small>${esc(p.current || '당기')}</small></th>
      <th>전기대비<br>증감율(%)</th>
      <th>전년동기대비<br>증감율(%)</th></tr></thead>
    <tbody>${body}</tbody></table>
    <div class="cpop-note" style="margin:6px 2px 0">📊 <b>당해실적·누계실적</b>을 클릭하면 분기/월별 시계열(잠정 vs 확정) 바차트가 열립니다. 전기·전년동기 수치는 차트로 대체했습니다.</div>`;
}

function otherRowsTable(r) {
  const rows = r.other_rows || [];
  if (!rows.length) return '';
  const pnum = s => { let t = String(s || '').replace(/,/g, '').replace(/%/g, '').trim(); if (t.startsWith('+')) t = t.slice(1); return /^-?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null; };
  const plain = v => { v = (v || '').trim(); return v && v !== '-' ? esc(v) : '<span class="dash">-</span>'; };
  const OPI = 'krx-md-ot:OtherPerformanceIndicators';
  const RQ = 'krx-md-ot:IncreaseAndDecreaseRateComparedToPreviousQuarterOtherPerformanceIndicators';
  const RY = 'krx-md-ot:IncreaseAndDecreaseRateComparedToSamePeriodOfLastYearOtherPerformanceIndicators';
  let section = '';
  const body = rows.map(x => {
    const label = (x.label || '').trim();
    const cur = (x.current || '').trim(), prev = (x.previous || '').trim(), yoy = (x.yoy || '').trim();
    const qraw = (x.qoq || '').trim(), yraw = (x.yoy_rate || '').trim();
    const isData = [cur, prev, yoy].some(v => pnum(v) !== null);
    if (!isData) {
      if (label && !label.replace(/\s/g, '').startsWith('구분')) section = label;
      return `<tr><td class="mt" style="width:auto">${esc(label)}</td>
        <td class="n">${plain(cur)}</td><td class="n">${plain(qraw)}</td><td class="n">${plain(yraw)}</td></tr>`;
    }
    const tl = section ? `${section} / ${label}` : label;
    const opi = (cell, g) => {
      cell = (cell || '').trim();
      if (!cell || cell === '-') return '<span class="dash">-</span>';
      const cid = CTX[g].current;
      return factSpan(OPI, `기타실적 · ${tl}`, cid, r.ctx[cid] || {}, '문자열', esc(cell), '', tl);
    };
    const rate = (raw, el) => {
      const n = pnum(raw);
      if (n === null) return raw && raw !== '-' ? `<span class="trans">${esc(raw)}</span>` : '<span class="dash">-</span>';
      const cls = n < 0 ? 'down' : 'up';
      return factSpan(el, `기타실적 증감율 · ${tl}`, 'CUR_Q', r.ctx['CUR_Q'] || {}, 'PURE(소수)', `<span class="${cls}">${n > 0 ? '+' : ''}${comma(n)}</span>`, (n / 100).toFixed(4), tl);
    };
    // 당기실적이 수치면 클릭 시 동일 typed axis 시계열 차트
    const numeric = pnum(cur) !== null;
    const ca = `data-chart="other" data-tl="${esc(tl)}"`;
    const curCell = numeric
      ? `<td class="n chartable" ${ca} title="클릭: ${esc(tl)} 시계열">${opi(cur, 'current')} <span class="chart-ic">📊</span></td>`
      : `<td class="n">${opi(cur, 'current')}</td>`;
    return `<tr><td class="mt" style="width:auto">${esc(label)}</td>
      ${curCell}<td class="n">${rate(qraw, RQ)}</td><td class="n">${rate(yraw, RY)}</td></tr>`;
  }).join('');
  return `<div class="sec" style="margin-top:16px">▸ 기타·가변 항목 <span style="font-weight:400;color:#889;font-size:12px">(회사 자율기재 · 기타실적 · 📊 당기실적 클릭 시 시계열 · 마우스오버 시 태깅정보)</span></div>
    <table class="perf"><thead><tr>
      <th>구분</th><th>당기실적</th><th>전기대비<br>증감율(%)</th>
      <th>전년동기대비<br>증감율(%)</th></tr></thead>
    <tbody>${body}</tbody></table>`;
}

function formTab(r) {
  const conn = r.basis === 'consolidated';
  return `
    <div class="ftitle">${conn ? '연결재무제표 기준 ' : ''}영업(잠정)실적(공정공시)</div>
    <div class="funit">(${esc(r.unit || '단위 : 원, %')})</div>
    <div class="sec">1. ${conn ? '연결' : ''} 실적내용</div>
    ${perfTable(r)}
    ${otherRowsTable(r)}
    <div class="sec">2. 정보제공내역</div>
    <table class="kv">
      <tr><th>정보제공자</th><td>${esc(r.provider || '-')}</td></tr>
      <tr><th>정보제공대상자</th><td>${esc(r.recipient || '-')}</td></tr>
      <tr><th>정보제공(예정)일시</th><td>${esc(r.when || '-')}</td></tr>
      <tr><th>행사명(장소)</th><td>${esc(r.place || '-')}</td></tr>
    </table>
    <div class="sec">3. 기타 투자판단에 참고할 사항</div>
    <div class="note">${esc(r.etc || '-')}</div>
    <div class="sec">※ 관련공시</div>
    <div class="note">${esc(r.related || '-')}</div>`;
}

function computeFacts(r) {
  const facts = [];
  const f = scaleFactor(r), conn = r.basis === 'consolidated';
  const ms = METRICS.filter(m => conn || m.key !== 'ProfitLossAttributableToOwnersOfParent');
  facts.push({ el: 'krx-gcd:NameOfCompany', ko: r.sub_name ? '회사명(자회사)' : '회사명', ctx: 'META', unit: '', val: r.sub_name || `${r.company} (${r.code})`, txt: true });
  for (const m of ms) {
    for (const g of ['current', 'previous', 'yoy']) {
      for (const span of ['current', 'cumulative']) {
        const v = num(r, g, m.key, span);
        if (v == null) continue;
        const cid = CTX[g][span];
        facts.push({ el: m.el, ko: `${m.ko} (${span === 'current' ? '당해' : '누계'})`, ctx: cid, unit: 'KRW', val: comma(Math.round(v * f)) });
      }
    }
    // 증감율
    for (const [kind, span, pfx] of [['qoq', 'current', RATE.qoq], ['yoy_cur', 'current', RATE.yoy_cur], ['yoy_cum', 'cumulative', RATE.yoy_cum]]) {
      const rv = rateVal(r, kind === 'qoq' ? 'qoq' : 'yoy', m, span);
      if (rv && rv.pct != null) facts.push({ el: `krx-md-ot:${pfx}${m.suf}`, ko: `${m.ko} 증감율`, ctx: 'CUR_Q', unit: 'PURE', val: (rv.pct / 100).toFixed(4) });
    }
  }
  // 기타·가변 항목 (OtherPerformanceIndicators, 문자열 + 기타실적구분 typed 축)
  const pnum = s => { let t = String(s || '').replace(/,/g, '').replace(/%/g, '').trim(); if (t.startsWith('+')) t = t.slice(1); return /^-?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null; };
  let section = '';
  for (const row of (r.other_rows || [])) {
    const label = (row.label || '').trim();
    const cur = (row.current || '').trim(), prev = (row.previous || '').trim(), yoy = (row.yoy || '').trim();
    const isData = [cur, prev, yoy].some(v => pnum(v) !== null);
    if (!isData) { if (label && !label.replace(/\s/g, '').startsWith('구분')) section = label; continue; }
    const tl = section ? `${section} / ${label}` : label;
    for (const [cell, g] of [[cur, 'current'], [prev, 'previous'], [yoy, 'yoy']]) {
      if (cell && cell !== '-') facts.push({ el: 'krx-md-ot:OtherPerformanceIndicators', ko: `기타실적 · ${tl}`, ctx: CTX[g].current, unit: 'string', val: cell, typed: tl });
    }
    const q = pnum(row.qoq), yr = pnum(row.yoy_rate);
    if (q !== null) facts.push({ el: 'krx-md-ot:IncreaseAndDecreaseRateComparedToPreviousQuarterOtherPerformanceIndicators', ko: `기타실적 증감율 · ${tl}`, ctx: 'CUR_Q', unit: 'PURE', val: (q / 100).toFixed(4), typed: tl });
    if (yr !== null) facts.push({ el: 'krx-md-ot:IncreaseAndDecreaseRateComparedToSamePeriodOfLastYearOtherPerformanceIndicators', ko: `기타실적 증감율 · ${tl}`, ctx: 'CUR_Q', unit: 'PURE', val: (yr / 100).toFixed(4), typed: tl });
  }
  return facts;
}

function factsTab(r) {
  const facts = computeFacts(r);
  const rows = facts.map(x => {
    const c = r.ctx[x.ctx] || {};
    const per = c.start ? (c.start === c.end ? c.start : `${c.start} ~ ${c.end}`) : '';
    const dim = c.preaudit ? '<span class="dim">감사전잠정</span>' : '';
    const typed = x.typed ? `<br><span class="dim tdim">기타실적구분: ${esc(x.typed)}</span>` : '';
    const valSpan = factSpan(x.el, x.ko, x.ctx, c, x.unit, esc(x.val), x.unit === 'KRW' ? esc(x.val) + ' 원' : '');
    return `<tr><td class="el">${esc(x.el)}</td><td>${esc(x.ko)}</td>
      <td class="ctx">${esc(CTX_KO[x.ctx] || x.ctx)} ${dim}<br><small>${esc(per)}</small>${typed}</td>
      <td class="n">${valSpan}</td><td class="un">${esc(x.unit)}</td></tr>`;
  }).join('');
  const idBox = r.sub_name
    ? `<div class="idbox idsub">🏢 entity identifier: <b>${esc(r.sub_name)}</b> <span class="idsubtag">자회사</span> · Dimension <b>krx-common:SubsidiariesAxis</b>=MaterialSubsidiariesMember<br><small>이 공시는 ${esc(r.company)}(${esc(r.code)})가 자회사 <b>${esc(r.sub_name)}</b>의 실적을 대신 공시한 것 → 모든 fact의 entity가 자회사로 태깅됩니다.</small></div>`
    : `<div class="idbox">entity identifier: <b>${esc(r.code)}</b> (${esc(r.company)}) · scheme krx.or.kr/CIK</div>`;
  return `${idBox}
    <div class="fnote">이 공시에서 태깅된 XBRL 팩트 <b>${facts.length}</b>건 · 금액 단위 KRW(원), 증감율 소수</div>
    <table class="facts"><thead><tr><th>XBRL element</th><th>항목(lineitem)</th><th>컨텍스트(기간/Dimension)</th><th>값</th><th>단위</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function kindTab(r) {
  if (!r.kind_url)
    return '<div class="fnote">이 공시는 KIND 원문 링크가 없습니다.</div>';
  return `<div class="kindbar">
      <span>🔗 KIND 공시원문 · 접수번호 <b>${esc(r.acptno)}</b></span>
      <a class="kopen" href="${r.kind_url}" target="_blank">새 창에서 열기 ↗</a>
    </div>
    <iframe class="kindframe" src="${r.kind_url}" title="KIND 공시원문" loading="lazy"></iframe>
    <div class="kindnote">※ 한국거래소 KIND(kind.krx.co.kr) 실시간 원문입니다. 표시되지 않으면 위 "새 창에서 열기"를 이용하세요.</div>`;
}

/* ---------- 잠정 신뢰도(트랙레코드) — point-in-time ----------
   가상 KIND는 실시간 운영 가정. 공시 D를 열면 asOf=D.dt(엄격). 그 시점 이후에 공개된(revealed_at>asOf)
   확정치는 가린다. '사후 분석 모드' 토글 시 asOf=∞ 로 미래 확정치까지 노출(경고 배너). */
const TRUST_METRICS = [
  { key: 'Revenue', ko: '매출액' },
  { key: 'OperatingIncomeLoss', ko: '영업이익' },
  { key: 'ProfitLoss', ko: '당기순이익' },
];
const HOW_KO = { direct: '정기보고서 직접', derived: '연간−3분기 파생', notfiled: '정기보고서 미제출', nodata: '대사불가', implausible: '업종/계정 상이' };

function jamWon(r, mkey) { const v = num(r, 'current', mkey, 'current'); return (v == null) ? null : Math.round(v * scaleFactor(r)); }
function qLabel(end) { if (!end) return '-'; const [y, m] = end.split('-'); return `${y} ${Math.ceil(+m / 3)}Q`; }
/* 당해기간이 정식 분기(3개월)인지 — 월별 잠정공시(HD현대중공업 등) 배제 */
function isQuarterlyCtx(c) {
  if (!c || !c.start || !c.end) return false;
  const [ey, em, ed] = c.end.split('-').map(Number);
  if (({ 3: 31, 6: 30, 9: 30, 12: 31 })[em] !== ed) return false;
  const [sy, sm] = c.start.split('-').map(Number);
  return sy === ey && sm === em - 2;
}
function fmtWon(v) { if (v == null) return '<span class="dash">-</span>'; const eok = v / 1e8; return Math.abs(eok) >= 10000 ? (eok / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + '조' : Math.round(eok).toLocaleString('ko-KR') + '억'; }
function shortWon(v) { if (v == null) return '-'; const eok = v / 1e8; return Math.abs(eok) >= 10000 ? (eok / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + '조' : Math.round(eok).toLocaleString('ko-KR') + '억'; }
function asOfOf(r) { return state.analysisMode ? '9999-12-31' : (r.dt || '').slice(0, 10); }
function revealed(rc, asOf) { return rc && (rc.how === 'direct' || rc.how === 'derived') && rc.rev && rc.rev <= asOf; }

/* 목록용 매출 수정폭 배지 — 가정된 지금(nowStr) 기준 공개된 확정만 */
function listDelta(r) {
  const rc = r.recon;
  if (!rc || rc.how === 'nodata' || rc.how === 'implausible' || rc.how === 'monthly') return '<span class="u">—</span>';
  if (!revealed(rc, nowStr())) return '<span class="wait2">확정대기</span>';
  const d = rc.d && rc.d.Revenue;
  if (typeof d !== 'number') return '<span class="u">—</span>';
  const cls = Math.abs(d) < 0.5 ? 'dz' : (d < 0 ? 'dn' : 'dp');
  return `<span class="ldelta ${cls}" title="매출 잠정 대비 확정 수정폭">${d > 0 ? '+' : ''}${d.toFixed(1)}%</span>`;
}

/* 같은 회사·기준의 공시들을 당해분기(end)로 모아 잠정/확정/수정폭 시계열 구성 */
function trackRecord(r, asOf) {
  const peers = DATA.filter(x => x.code === r.code && x.basis === r.basis && x.ctx && x.ctx.CUR_Q)
    .filter(x => isQuarterlyCtx(x.ctx.CUR_Q))                // 월별 잠정공시 제외(분기만)
    .filter(x => !x.sub)                                     // 자회사 대신공시(identifier·재무가 자회사 것) 제외
    .filter(x => (x.dt || '').slice(0, 10) <= asOf)          // as-of 이후 공시 자체도 미존재
    .sort((a, b) => (a.ctx.CUR_Q.end || '').localeCompare(b.ctx.CUR_Q.end || '') || (a.dt || '').localeCompare(b.dt || ''));
  // 기간(end)별 그룹 → 정정 버전 체인
  const byEnd = new Map();
  for (const p of peers) { const e = p.ctx.CUR_Q.end; (byEnd.get(e) || byEnd.set(e, []).get(e)).push(p); }
  const rows = [];
  for (const [end, versions] of byEnd) {
    versions.sort((a, b) => (a.dt || '').localeCompare(b.dt || ''));
    const latest = versions[versions.length - 1];        // asOf 시점 현행본
    const first = versions[0];                            // 최초 발표(플래시)
    versions.forEach(v => rows.push({ end, v, isLatest: v === latest, isFirst: v === first, nver: versions.length, restated: versions.length > 1 }));
  }
  return rows;
}

function trustBadge(r, asOf) {
  // '값이 담긴 최초 발표'의 정확도 — 분기별 첫 유효발표 기준. 현재 공시·미확정 제외.
  const out = [];
  for (const m of TRUST_METRICS) {
    const ds = trustChartRows(r, asOf, m.key)
      .filter(o => !o.isCur && !o.pending && typeof o.d === 'number')
      .map(o => Math.abs(o.d));
    if (ds.length) out.push({ ko: m.ko, avg: ds.reduce((a, b) => a + b, 0) / ds.length, n: ds.length, max: Math.max(...ds) });
  }
  return out;
}

function trustTab(r) {
  const asOf = asOfOf(r);
  const mk = state.trustMetric || 'Revenue';
  const finsec = !!r.finsec;
  const rows = trackRecord(r, asOf);
  const badge = finsec ? [] : trustBadge(r, asOf);

  const banner = state.analysisMode
    ? `<div class="pit-warn">⚠ 사후 분석 모드 — 공시 시점(${esc((r.dt || '').slice(0, 10))})엔 알 수 없던 <b>미래 확정정보</b>를 표시 중입니다. 실시간 재현이 아닙니다.</div>`
    : `<div class="pit-note">🕘 이 창은 <b>${esc((r.dt || '').slice(0, 10))} 시점</b>으로 재현됩니다. 그 이후 공개된 확정치(정기보고서)는 가려집니다(point-in-time).</div>`;

  const badgeHtml = finsec
    ? `<div class="cred cred-fin">🏦 <b>대사불가(금융업종)</b> — 은행·보험·증권·금융지주는 매출·영업이익·순이익의 계정 정의가 정기보고서(DART)와 달라 잠정 대비 대사가 불가합니다. 아래는 잠정 발표치 추이만 표시합니다.</div>`
    : badge.length
      ? `<div class="cred">이 회사 <b>최초 잠정 발표</b> 정확도 <span class="credsub">(최초 공시 vs 확정 · 이 시점까지 공개분)</span>：` +
        badge.map(b => `<b>${esc(b.ko)}</b> 평균 ±${b.avg.toFixed(2)}% <small>(${b.n}개 분기·최대 ${b.max.toFixed(1)}%)</small>`).join(' · ') + `</div>`
      : `<div class="cred cred-none">과거 확정 대사 데이터가 아직 없습니다 (이 시점 기준).</div>`;

  const seg = TRUST_METRICS.map(m =>
    `<button class="${mk === m.key ? 'on' : ''}" onclick="setTrustMetric('${m.key}')">${esc(m.ko)}</button>`).join('');

  const body = rows.map(x => {
    const p = x.v, rc = p.recon, isCur = p.uid === r.uid;
    const jam = jamWon(p, mk);
    const rev = revealed(rc, asOf);
    const conf = rev ? (rc.conf && rc.conf[mk]) : null;
    const d = rev ? (rc.d && rc.d[mk]) : null;
    let confCell, dCell;
    if (finsec) { confCell = '<span class="finx">대사불가</span>'; dCell = '<span class="wait">—</span>'; }
    else if (isCur && !rev) { confCell = '<span class="wait">확정 대기</span>'; dCell = '<span class="wait">—</span>'; }
    else if (conf == null) { confCell = revealed(rc, asOf) ? '<span class="dash">-</span>' : `<span class="wait">확정 대기</span>`; dCell = '<span class="wait">—</span>'; }
    else {
      confCell = fmtWon(conf);
      const cls = Math.abs(d) < 0.5 ? 'dz' : (d < 0 ? 'dn' : 'dp');
      dCell = `<span class="${cls}">${d > 0 ? '+' : ''}${d.toFixed(2)}%</span>`;
    }
    const verTag = x.restated ? `<span class="vtag ${x.isLatest ? 'vcur' : 'vold'}">${x.isLatest ? '★현행' : '정정전'}</span>` : '';
    const rowcls = (isCur ? 'cur ' : '') + (x.restated && !x.isLatest ? 'old' : '');
    return `<tr class="${rowcls}">
      <td class="q">${esc(qLabel(x.end))} ${verTag}${isCur ? '<span class="here">지금 이 공시</span>' : ''}<br><small>${esc((p.dt || '').slice(0, 10))} 공시</small></td>
      <td class="n">${fmtWon(jam)}</td>
      <td class="n">${confCell}</td>
      <td class="n">${dCell}</td>
      <td class="rv"><small>${finsec ? '금융업종' : (rev ? esc(rc.rev) + ' 확정' : (rc && rc.how === 'notfiled' ? '미제출' : (rc && (rc.how === 'nodata' || rc.how === 'implausible') ? esc(HOW_KO[rc.how]) : '—')))}</small></td>
    </tr>`;
  }).join('');

  return `${banner}
    <div class="trustbar">
      <label class="pit-toggle"><input type="checkbox" ${state.analysisMode ? 'checked' : ''} onchange="toggleAnalysis(this.checked)"> 사후 분석 모드(미래 확정치 공개)</label>
    </div>
    ${badgeHtml}
    <div class="trustcharts">
      <div id="trustchart-Revenue" class="trustchart"></div>
      <div id="trustchart-OperatingIncomeLoss" class="trustchart"></div>
      <div id="trustchart-ProfitLoss" class="trustchart"></div>
    </div>
    <div class="tabletop">
      <span class="seg trustseg">${seg}</span>
      <span class="tablehint">상세표 지표 · <b>${esc((TRUST_METRICS.find(m => m.key === mk) || {}).ko)}</b> 기준</span>
    </div>
    <table class="track"><thead><tr>
      <th>분기 / 공시</th><th class="n">잠정(공정공시)</th><th class="n">확정(정기보고서)</th><th class="n">수정폭</th><th>확정 공개</th>
    </tr></thead><tbody>${body || '<tr><td colspan="5" class="empty">해당 시점 기준 이력이 없습니다.</td></tr>'}</tbody></table>
    <div class="trustfoot">· 잠정=거래소 공정공시 감사전 실적, 확정=DART 정기보고서(검토/감사후). 당해분기(3M) 기준. 억/조원 표기.<br>
      · 수정폭 = (확정−잠정)/|잠정|. Q4 확정치는 「사업보고서 연간 − 3분기 누계」로 파생.</div>`;
}

/* 분기별 1행 = 해당 지표 값이 담긴 '최초 발표' 버전.
   주의: HD현대 계열 등은 텍스트만 있는 조기 플래시(값=null)를 먼저 낸 뒤 상세 공시를 낸다.
   그 경우 절대 첫 공시(isFirst)가 아니라 '값이 있는 첫 버전'을 골라야 분기가 누락되지 않는다. */
function trustChartRows(r, asOf, mk) {
  const byEnd = new Map();
  for (const x of trackRecord(r, asOf)) {
    if (!byEnd.has(x.end)) byEnd.set(x.end, []);
    byEnd.get(x.end).push(x.v);   // 버전들은 dt 오름차순
  }
  const finsec = !!r.finsec;   // 금융업종: 확정 대사불가(계정 정의 상이)
  const out = [];
  for (const [end, versions] of byEnd) {
    const chosen = versions.find(p => jamWon(p, mk) != null) || versions[versions.length - 1];
    const rc = chosen.recon, rev = !finsec && revealed(rc, asOf);
    out.push({
      end, q: qLabel(end), dt: (chosen.dt || '').slice(0, 10), isCur: chosen.uid === r.uid,
      jam: jamWon(chosen, mk), conf: rev ? (rc.conf && rc.conf[mk]) : null,
      d: rev ? (rc.d && rc.d[mk]) : null, pending: !finsec && !rev, finunmatch: finsec,
    });
  }
  return out.filter(o => o.jam != null);
}

function renderTrustCharts(r) {
  for (const m of TRUST_METRICS) renderOneTrustChart(r, m.key, m.ko);
}
function renderOneTrustChart(r, mk, ko) {
  const el = document.getElementById('trustchart-' + mk);
  if (!el || typeof Plotly === 'undefined') return;
  const asOf = asOfOf(r);
  const rows = trustChartRows(r, asOf, mk);
  if (rows.length < 1) { el.innerHTML = `<div class="chart-empty">${esc(ko)} · 표시할 대사 이력이 없습니다.</div>`; return; }

  // 단위 선택
  const vals = rows.flatMap(o => [o.jam, o.conf]).filter(v => v != null).map(Math.abs);
  const mx = Math.max(...vals, 1);
  const [div, unit] = mx >= 1e12 ? [1e12, '조원'] : mx >= 1e8 ? [1e8, '억원'] : [1, '원'];
  const xs = rows.map(o => o.q);
  const sc = v => v == null ? null : v / div;

  const finsec = !!r.finsec;
  const jamTrace = {
    x: xs, y: rows.map(o => sc(o.jam)), name: '잠정(공정공시)', mode: 'markers', type: 'scatter',
    marker: { symbol: 'circle-open', size: 15, color: '#12518a', line: { width: 2.5, color: '#12518a' } },
    hovertemplate: '%{x} 잠정<br>%{y:,.2f} ' + unit + '<extra></extra>',
  };
  const traces = [jamTrace];
  if (!finsec) traces.push({          // 금융업종은 확정 대사불가 → 확정 점 미표시
    x: xs, y: rows.map(o => sc(o.conf)), name: '확정(정기보고서)', mode: 'markers', type: 'scatter',
    marker: { symbol: 'circle', size: 13, color: '#1a7a3a', line: { width: 2, color: '#fff' } },
    hovertemplate: '%{x} 확정<br>%{y:,.2f} ' + unit + '<extra></extra>',
  });
  // 축 아래 3행: 분기명 → 절대금액(확정, 미제출은 잠정) → 괴리율. 세로 분리로 겹침 방지.
  const anns = [];
  rows.forEach(o => {
    anns.push({ x: o.q, y: 0, xref: 'x', yref: 'paper', yanchor: 'top', yshift: -7, showarrow: false, text: o.q, font: { size: 10.5, color: '#556' }, align: 'center' });
    const amt = o.conf != null ? shortWon(o.conf) : (o.jam != null ? shortWon(o.jam) : '-');
    anns.push({ x: o.q, y: 0, xref: 'x', yref: 'paper', yanchor: 'top', yshift: -21, showarrow: false, text: amt, font: { size: 10, color: '#1f2a37' }, align: 'center' });
    let txt, col;
    if (o.finunmatch) { txt = '대사불가'; col = '#a5760b'; }
    else if (o.pending) { txt = '확정대기'; col = '#8a95a3'; }
    else if (typeof o.d !== 'number') { txt = '—'; col = '#8a95a3'; }
    else if (Math.abs(o.d) < 0.5) { txt = `${o.d > 0 ? '+' : ''}${o.d.toFixed(2)}%`; col = '#1a7a3a'; }
    else { txt = `${o.d > 0 ? '▲' : '▼'}${Math.abs(o.d).toFixed(2)}%`; col = o.d > 0 ? '#c0392b' : '#1558a6'; }
    anns.push({ x: o.q, y: 0, xref: 'x', yref: 'paper', yanchor: 'top', yshift: -35, showarrow: false, text: `<b>${txt}</b>`, font: { size: 10, color: col }, align: 'center' });
  });
  // 현재(잠정) 수준 기준선 + 정정대기 분기 수직선
  const shapes = [];
  const last = rows[rows.length - 1];
  if (last && last.jam != null) shapes.push({ type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: sc(last.jam), y1: sc(last.jam), line: { color: '#c3ccd6', width: 1, dash: 'dash' } });
  const pend = rows.find(o => o.pending);
  if (pend) shapes.push({ type: 'line', xref: 'x', x0: pend.q, x1: pend.q, yref: 'paper', y0: 0, y1: 1, line: { color: '#c3ccd6', width: 1, dash: 'dash' } });

  const subtitle = finsec ? '(금융업종 · 확정 대사불가)' : '(최초발표 기준)';
  const layout = {
    title: { text: `${ko} · ${finsec ? '잠정 추이' : '잠정 vs 확정'} <span style="font-size:10px;color:#889">${subtitle}</span>`, font: { size: 13, color: '#0b3d68' }, x: 0, xanchor: 'left' },
    margin: { l: 58, r: 16, t: 34, b: 62 }, height: 316,
    paper_bgcolor: '#fff', plot_bgcolor: '#fff',
    xaxis: { showgrid: false, showticklabels: false, ticks: '', fixedrange: true },
    yaxis: { title: { text: unit, font: { size: 11, color: '#889' } }, gridcolor: '#eef1f5', griddash: 'dash', zeroline: false, tickfont: { size: 10, color: '#667' }, fixedrange: true },
    legend: { orientation: 'h', x: 1, xanchor: 'right', y: 1.16, font: { size: 11 } },
    annotations: anns, shapes: shapes, hovermode: 'closest',
  };
  Plotly.newPlot(el, traces, layout, { displayModeBar: false, responsive: true });
}
window.setTrustMetric = k => { state.trustMetric = k; paintDetail(); };
window.toggleAnalysis = on => { state.analysisMode = on; paintDetail(); };

/* ---------- 시계열 바차트(당해/누계·기타항목 클릭) ----------
   조회 공시의 당해기간이 분기(3M)면 분기 시계열(잠정 연·확정 진), 월(1M)이면 월별 시계열(잠정만).
   point-in-time: 이 공시 시점(asOf) 이전 발표만·그 시점까지 공개된 확정만. */
function ctxKind(c) {
  if (!c || !c.start || !c.end) return null;
  if (isQuarterlyCtx(c)) return 'Q';
  const [sy, sm] = c.start.split('-').map(Number);
  const [ey, em] = c.end.split('-').map(Number);
  if (sy === ey && sm === em) return 'M';          // 같은 연·월 = 월별
  return 'other';
}
function mLabel(end) { if (!end) return '-'; const [y, m] = end.split('-'); return `${y.slice(2)}.${m}`; }  // '24.05'
function metricWon(r, mk, span) { const v = num(r, 'current', mk, span); return (v == null) ? null : Math.round(v * scaleFactor(r)); }

/* 지표(매출/영업이익 등) 분기·월 시계열: [{end,label,jam,conf,d,isCur,monthly}] */
function metricSeries(r, mk, span) {
  const asOf = asOfOf(r), finsec = !!r.finsec;
  const monthly = ctxKind(r.ctx && r.ctx.CUR_Q) === 'M';
  const peers = DATA.filter(x => x.code === r.code && x.basis === r.basis && !x.sub && x.ctx && x.ctx.CUR_Q)
    .filter(x => (x.dt || '').slice(0, 10) <= asOf)
    .filter(x => monthly ? ctxKind(x.ctx.CUR_Q) === 'M' : isQuarterlyCtx(x.ctx.CUR_Q));
  const byEnd = new Map();
  for (const p of peers) { const e = p.ctx.CUR_Q.end; if (!byEnd.has(e)) byEnd.set(e, []); byEnd.get(e).push(p); }
  const rows = [];
  for (const [end, vers] of byEnd) {
    vers.sort((a, b) => (a.dt || '').localeCompare(b.dt || ''));
    const chosen = vers.find(p => metricWon(p, mk, span) != null) || vers[vers.length - 1];
    const jam = metricWon(chosen, mk, span);
    if (jam == null) continue;
    const rc = chosen.recon, rev = !monthly && !finsec && revealed(rc, asOf);
    const cf = span === 'cumulative' ? 'confY' : 'conf', df = span === 'cumulative' ? 'dY' : 'd';
    const conf = rev ? ((rc[cf] || {})[mk]) : null, d = rev ? ((rc[df] || {})[mk]) : null;
    const pctx = (span === 'cumulative' ? chosen.ctx.CUR_YTD : chosen.ctx.CUR_Q) || {};   // 당해=분기, 누계=YTD 기간
    const per = pctx.start ? (pctx.start === pctx.end ? pctx.start : pctx.start + ' ~ ' + pctx.end) : '';
    rows.push({ end, label: monthly ? mLabel(end) : qLabel(end), jam, monthly, per, isCur: chosen.uid === r.uid,
      conf: (typeof conf === 'number') ? conf : null, d: (typeof d === 'number') ? d : null });
  }
  return rows.sort((a, b) => a.end.localeCompare(b.end));
}

/* 기타·가변항목: 같은 회사 공시들에서 동일 typed axis(섹션/항목명) 값만 모아 시계열 [{end,label,jam,isCur}] */
function otherSeries(r, tl) {
  const asOf = asOfOf(r);
  const kind = ctxKind(r.ctx && r.ctx.CUR_Q);          // 조회 공시 주기(월/분기)와 동일한 것만 모아 기간단위 일치
  const pnum = s => { let t = String(s || '').replace(/,/g, '').replace(/%/g, '').trim(); if (t.startsWith('+')) t = t.slice(1); return /^-?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null; };
  const peers = DATA.filter(x => x.code === r.code && x.basis === r.basis && !x.sub && x.ctx && x.ctx.CUR_Q && (x.other_rows || []).length)
    .filter(x => (x.dt || '').slice(0, 10) <= asOf)
    .filter(x => ctxKind(x.ctx.CUR_Q) === kind);
  const byEnd = new Map();
  for (const p of peers) {
    let section = '', val = null;
    for (const row of p.other_rows) {
      const label = (row.label || '').trim(), cur = (row.current || '').trim();
      const isData = [cur, (row.previous || ''), (row.yoy || '')].some(v => pnum(v) !== null);
      if (!isData) { if (label && !label.replace(/\s/g, '').startsWith('구분')) section = label; continue; }
      if ((section ? `${section} / ${label}` : label) === tl) { val = pnum(cur); break; }
    }
    if (val == null) continue;
    const end = p.ctx.CUR_Q.end;
    if (!byEnd.has(end)) byEnd.set(end, []);
    byEnd.get(end).push({ p, val, kind: ctxKind(p.ctx.CUR_Q) });
  }
  const rows = [];
  for (const [end, arr] of byEnd) {
    arr.sort((a, b) => (a.p.dt || '').localeCompare(b.p.dt || ''));
    const last = arr[arr.length - 1];
    const pctx = last.p.ctx.CUR_Q || {};   // 기타실적은 당분기(CUR_Q) 컨텍스트에 태깅
    const per = pctx.start ? (pctx.start === pctx.end ? pctx.start : pctx.start + ' ~ ' + pctx.end) : '';
    rows.push({ end, label: last.kind === 'M' ? mLabel(end) : qLabel(end), jam: last.val, per, isCur: last.p.uid === r.uid });
  }
  return rows.sort((a, b) => a.end.localeCompare(b.end));
}

const CPOP_LIGHT = '#9cc0e4', CPOP_DARK = '#0b3d68';   // 잠정(연) / 확정(진)
function openMetricChart(mk, span) {
  const r = DATA.find(x => x.uid === curUid); if (!r) return;
  const meta = METRICS.find(m => m.key === mk) || { ko: mk };
  const rows = metricSeries(r, mk, span);
  const monthly = rows.length ? rows[0].monthly : ctxKind(r.ctx && r.ctx.CUR_Q) === 'M';
  const sub = monthly ? '월별 추이(잠정)' : (r.finsec ? '분기별 추이 · 금융업종(확정 대사불가)' : '분기별 · 잠정 vs 확정');
  renderCPop(`${meta.ko} · ${span === 'cumulative' ? '누계실적' : '당해실적'}`, sub, rows,
    { hasConf: rows.some(o => o.conf != null), unitMode: 'won', cur: r.uid });
}
function openOtherChart(tl) {
  const r = DATA.find(x => x.uid === curUid); if (!r) return;
  renderCPop(`기타실적 · ${tl}`, 'typed axis 동일 항목 시계열(잠정)', otherSeries(r, tl),
    { hasConf: false, unitMode: 'raw', cur: r.uid, tl });
}
window.openMetricChart = openMetricChart;
window.openOtherChart = openOtherChart;
window.closeChartPop = () => document.getElementById('cpop').classList.remove('on');

function renderCPop(title, sub, rows, opts) {
  document.getElementById('cpopTitle').textContent = title;
  document.getElementById('cpopSub').textContent = sub;
  document.getElementById('cpop').classList.add('on');
  const el = document.getElementById('cpopChart'), legend = document.getElementById('cpopLegend'), note = document.getElementById('cpopNote');
  if (!rows.length) { el.innerHTML = '<div class="chart-empty">표시할 시계열이 없습니다 (이 시점 기준).</div>'; legend.innerHTML = ''; note.textContent = ''; return; }

  let div = 1, unit = '';
  if (opts.unitMode === 'won') {
    const mx = Math.max(...rows.flatMap(o => [o.jam, o.conf]).filter(v => v != null).map(Math.abs), 1);
    [div, unit] = mx >= 1e12 ? [1e12, '조원'] : mx >= 1e8 ? [1e8, '억원'] : [1, '원'];
  }
  const xs = rows.map(o => o.label), sc = v => v == null ? null : v / div;
  const fmt = v => v == null ? '' : (opts.unitMode === 'won'
    ? (v / div).toLocaleString('ko-KR', { maximumFractionDigits: div >= 1e12 ? 2 : 0 })
    : v.toLocaleString('ko-KR'));
  const uSuf = unit ? ' ' + unit : '';
  const itemLine = opts.tl ? opts.tl.replace(/%/g, '％') + '<br>' : '';   // 기타항목: typed axis 항목명
  const traces = [{
    x: xs, y: rows.map(o => sc(o.jam)), customdata: rows.map(o => o.per || '-'),
    name: '잠정', type: 'bar', marker: { color: CPOP_LIGHT },
    text: rows.map(o => fmt(o.jam)), textposition: 'outside', textfont: { size: 10, color: '#12518a' },
    cliponaxis: false,
    hovertemplate: `<b>%{x}</b> 잠정<br>${itemLine}기간 %{customdata}<br>%{text}${uSuf}<extra></extra>`,
  }];
  if (opts.hasConf) {   // 확정치 있는 분기만(null 막대는 제외 → 빈 레이블 NaN transform 방지)
    const cx = [], cy = [], ct = [], cc = [];
    rows.forEach(o => { if (o.conf != null) { cx.push(o.label); cy.push(sc(o.conf)); ct.push(fmt(o.conf)); cc.push(o.per || '-'); } });
    traces.push({
      x: cx, y: cy, customdata: cc, name: '확정', type: 'bar', marker: { color: CPOP_DARK },
      text: ct, textposition: 'outside', textfont: { size: 10, color: CPOP_DARK },
      cliponaxis: false,
      hovertemplate: `<b>%{x}</b> 확정<br>기간 %{customdata}<br>%{text}${uSuf}<extra></extra>`,
    });
  }
  const layout = {
    barmode: 'group', bargap: 0.3, bargroupgap: 0.06, height: 372,
    margin: { l: 58, r: 16, t: 16, b: 40 }, paper_bgcolor: '#fff', plot_bgcolor: '#fff',
    xaxis: { type: 'category', tickfont: { size: 11, color: '#334' }, fixedrange: true },   // 월 레이블('24.05')이 수치로 해석되지 않도록 범주 고정
    yaxis: { title: { text: unit, font: { size: 11, color: '#889' } }, gridcolor: '#eef1f5', griddash: 'dash', zeroline: true, zerolinecolor: '#d5dde6', tickfont: { size: 10, color: '#667' }, fixedrange: true },
    showlegend: false, hovermode: 'closest',
  };
  Plotly.newPlot(el, traces, layout, { displayModeBar: false, responsive: true });

  legend.innerHTML = `<span><i style="background:${CPOP_LIGHT}"></i>잠정(공정공시)</span>`
    + (opts.hasConf ? `<span><i style="background:${CPOP_DARK}"></i>확정(정기보고서)</span>` : '');
  note.textContent = opts.hasConf
    ? '· 잠정=거래소 공정공시(감사전) · 확정=DART 정기보고서(검토·감사후) · 각 막대에 수치 표기.'
    : (opts.unitMode === 'raw'
      ? '· 회사 자율기재(기타실적) 원자료 수치 · 동일 typed axis 항목만 모아 시계열화(확정 대사 없음).'
      : '· 잠정(공정공시) 발표치 추이 · 월별 공시는 정기보고서 대사 대상이 아니라 확정치가 없습니다.');
}

let curUid = null, curTab = 'form';
window.openDetail = uid => {
  curUid = uid; curTab = 'form';
  document.getElementById('overlay').classList.add('on');
  document.body.style.overflow = 'hidden';
  paintDetail();
};
window.closeDetail = () => {
  document.getElementById('overlay').classList.remove('on');
  document.body.style.overflow = '';
};
window.setTab = t => { curTab = t; paintDetail(); };

function paintDetail() {
  const r = DATA.find(x => x.uid === curUid);
  if (!r) return;
  const ixHref = `../output/ixbrl/${r.uid}.html`;
  const xbHref = `../output/instances/${r.uid}.xml`;
  document.getElementById('dhead').innerHTML =
    `<div class="dh-cm">${esc(r.company)} <span class="dh-cd">${esc(r.code)}</span>
      ${r.basis === 'consolidated' ? '<span class="bg bg-c">연결</span>' : '<span class="bg bg-s">별도</span>'}</div>
     <div class="dh-dt">${esc(r.dt)} · ${esc(r.title || '영업(잠정)실적(공정공시)')}${r.sub ? ' <span class="subtag2">⚠ 자회사 대신공시 — 재무·identifier는 자회사 것</span>' : ''} · Entry Point A700000401</div>`;
  document.getElementById('dtabs').innerHTML =
    ['form', '공시서식(iXBRL 뷰)', 'trust', '잠정 신뢰도', 'kind', 'KIND공시원문', 'facts', 'XBRL 팩트', 'raw', '원본 파일']
      .reduce((a, _, i, arr) => { if (i % 2) a.push(`<button class="${curTab === arr[i - 1] ? 'on' : ''}" onclick="setTab('${arr[i - 1]}')">${arr[i]}</button>`); return a; }, []).join('');
  let html = '';
  if (curTab === 'form') html = formTab(r);
  else if (curTab === 'trust') html = trustTab(r);
  else if (curTab === 'kind') html = kindTab(r);
  else if (curTab === 'facts') html = factsTab(r);
  else {
    const kindBtn = r.kind_url
      ? `<a class="rawbtn kind" href="${r.kind_url}" target="_blank">🔗 KIND 공시원문 열기 (접수번호 ${esc(r.acptno)})</a>`
      : `<div class="rawbtn off">🔗 KIND 공시원문 — 접수번호 미확보(대형주 조기 잠정실적 속보 등)</div>`;
    html = `<div class="raw">
      <p>이 공시의 원문·기계판독용 산출물입니다. (파일 프로토콜에서 바로 열립니다)</p>
      ${kindBtn}
      <a class="rawbtn" href="${ixHref}" target="_blank">📄 iXBRL 원본 열기 (Inline XBRL, .html)</a>
      <a class="rawbtn" href="${xbHref}" target="_blank">🧾 XBRL 인스턴스 열기 (.xml)</a>
      <div class="rawmeta">
        <div><b>uid</b> ${esc(r.uid)}</div>
        ${r.acptno ? `<div><b>접수번호</b> ${esc(r.acptno)}</div>` : ''}
        <div><b>schemaRef</b> entry_point/A700000401/A700000401_entry_point_2023-12-31.xsd</div>
        <div><b>단위</b> ${esc(r.unit)} → XBRL 원(KRW), scale ${r.scale}</div>
      </div></div>`;
  }
  document.getElementById('dbody').innerHTML = html;
  if (curTab === 'trust') renderTrustCharts(r);
}

/* ---------- 가정 오늘(as-of) + 시간흐름 컨트롤 ---------- */
function updateAsofUI(syncText) {
  const el = document.getElementById('asofNow');
  if (el) el.textContent = fmtSim(simNow, true);
  const dstr = fmtSim(simNow, false);
  const de = document.getElementById('asofDate');
  if (de && de.value !== dstr) de.value = dstr;
  if (syncText) { const te = document.getElementById('asofText'); if (te) te.value = dstr; }
}
/* 가정 시각을 특정 날짜로 설정. endOfDay=true 면 그 날 23:59까지 접수분 전부 노출(스냅샷). */
function applyAsofDate(y, mo, d, endOfDay) {
  const dt = new Date(y, mo - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, 0, 0);
  const real = new Date();
  simNow = dt > real ? real : dt;          // 실제 미래는 가정 불가 → 현재로 클램프
  setFlow(0);
  updateAsofUI(true);
  state.page = 1; renderList();
}
/* YYYYMMDD / YYYY.MM.DD / YYYY-MM-DD (구분자 . - / 혼용·생략 허용) 파싱 */
function parseAsofText(str) {
  const m = /^(\d{4})[.\-/]?(\d{1,2})[.\-/]?(\d{1,2})$/.exec((str || '').trim());
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  applyAsofDate(y, mo, d, true);
  return true;
}
function setFlow(mult) {
  flowMult = mult;
  document.querySelectorAll('#flowseg button').forEach(b => b.classList.toggle('on', +b.dataset.mult === mult));
  if (flowTimer) { clearInterval(flowTimer); flowTimer = null; }
  if (mult > 0) { flowLast = Date.now(); flowTimer = setInterval(flowTick, 250); }
}
function flowTick() {
  const t = Date.now();
  const dReal = t - flowLast; flowLast = t;
  const prev = simNowStr();
  let next = new Date(simNow.getTime() + dReal * flowMult);
  const real = new Date();
  const capped = next > real;
  simNow = capped ? real : next;
  const cur = simNowStr();
  updateAsofUI(false);
  if (cur !== prev) {                       // 시각(분)이 바뀌면 그 사이 접수분을 반영
    flashUids = new Set(DATA.filter(r => r.dt && r.dt > prev && r.dt <= cur).map(r => r.uid));
    if (flashUids.size) state.page = 1;     // 방금 접수분이 최신순 첫 페이지 상단에 뜨도록
    renderList();
    flashUids = new Set();
  }
  if (capped) setFlow(0);                    // 실제 현재를 따라잡으면 자동 정지
}

/* ---------- 초기화 ---------- */
function bind() {
  const q = document.getElementById('q');
  q.addEventListener('input', () => { state.q = q.value.trim(); state.page = 1; renderList(); });
  document.querySelectorAll('[data-basis]').forEach(b => b.onclick = () => {
    document.querySelectorAll('[data-basis]').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); state.basis = b.dataset.basis; state.page = 1; renderList();
  });
  document.getElementById('sort').onchange = e => { state.sort = e.target.value; renderList(); };
  // 가정 오늘(as-of) 입력 — 텍스트(3형식) + 달력
  const asofText = document.getElementById('asofText');
  const flagBad = () => { asofText.classList.add('bad'); setTimeout(() => asofText.classList.remove('bad'), 700); };
  asofText.addEventListener('keydown', e => { if (e.key === 'Enter') { if (!parseAsofText(asofText.value)) flagBad(); } });
  asofText.addEventListener('blur', () => { if (asofText.value.trim() && !parseAsofText(asofText.value)) flagBad(); });
  document.getElementById('asofDate').addEventListener('change', e => {
    const v = e.target.value; if (!v) return;
    const [y, mo, d] = v.split('-').map(Number); applyAsofDate(y, mo, d, true);
  });
  document.querySelectorAll('#flowseg button').forEach(b => b.onclick = () => setFlow(+b.dataset.mult));
  updateAsofUI(true);   // 초기: 2026-01-01로 세팅
  document.getElementById('overlay').addEventListener('click', e => { if (e.target.id === 'overlay') closeDetail(); });
  // 당해/누계·기타항목 셀 클릭 → 시계열 바차트 팝업
  document.addEventListener('click', e => {
    const c = e.target.closest && e.target.closest('.chartable');
    if (!c) return;
    if (c.dataset.chart === 'metric') openMetricChart(c.dataset.mk, c.dataset.span);
    else if (c.dataset.chart === 'other') openOtherChart(c.dataset.tl);
  });
  const cpop = document.getElementById('cpop');
  cpop.addEventListener('click', e => { if (e.target.id === 'cpop') closeChartPop(); });
  document.addEventListener('keydown', e => {   // Esc: 차트 팝업 먼저, 없으면 상세 닫기
    if (e.key !== 'Escape') return;
    if (cpop.classList.contains('on')) closeChartPop(); else closeDetail();
  });
  // 팩트 마우스오버 툴팁
  const tip = document.getElementById('tip');
  document.addEventListener('mouseover', e => {
    const f = e.target.closest && e.target.closest('.fact');
    if (!f) return;
    tip.innerHTML = buildTip(f.dataset);
    tip.style.display = 'block';
  });
  document.addEventListener('mousemove', e => {
    if (tip.style.display !== 'block') return;
    const pad = 15, w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + w > window.innerWidth) x = e.clientX - w - pad;
    if (y + h > window.innerHeight) y = e.clientY - h - pad;
    tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, y) + 'px';
  });
  document.addEventListener('mouseout', e => {
    const f = e.target.closest && e.target.closest('.fact');
    if (f) tip.style.display = 'none';
  });
  renderList();
  // 딥링크: #d=UID[&t=facts|raw] 로 상세 자동 열기
  const m = /#d=([^&]+)/.exec(location.hash);
  if (m && DATA.some(x => x.uid === m[1])) {
    openDetail(m[1]);
    const t = /[&#]t=(\w+)/.exec(location.hash);
    if (t) setTab(t[1]);
  }
}
document.addEventListener('DOMContentLoaded', bind);
