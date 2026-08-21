/**
 * SOOP 원본 녹화 상세 모니터링 대시보드 (LiveDownload 룩앤필 풀위드 레이아웃)
 */

import { page } from '../config/state.js';
import { pickNewDirectory } from './storageHelper.js';

export function dashboard(channelId) {
  try {
    page.stop();
  } catch (_) {}

  const bus = new page.BroadcastChannel(channelId);
  const D = { snap: null, logs: [] };

  document.documentElement.innerHTML = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SOOP 원본 녹화 대시보드</title>
  <style>
    :root {
      --bg-base: #121212;
      --bg-surface: #1c1c1c;
      --bg-card: #232323;
      --bg-card-hover: #292929;
      --bg-input: #161616;
      
      --border: #2c2c2c;
      --border-light: #242424;
      
      --text-main: #ffffff;
      --text-sub: #a6a6a6;
      --text-muted: #6e6e6e;
      
      --accent-green: #00c471;
      --accent-green-hover: #00b065;
      --accent-red: #ff4d4f;
      --accent-orange: #ffa000;
      --accent-blue: #1890ff;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      background: var(--bg-base);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, "Noto Sans KR", sans-serif;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      padding-bottom: 60px;
    }

    /* Header */
    header {
      background: var(--bg-base);
      border-bottom: 1px solid var(--border);
      padding: 16px 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      width: 32px;
      height: 32px;
      border-radius: 9px;
      background: var(--accent-green);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #121212;
      font-weight: 900;
      font-size: 16px;
    }

    .brand-title {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.4px;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .brand-version {
      font-size: 11px;
      font-weight: 700;
      background: var(--bg-card);
      color: var(--text-sub);
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid var(--border);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all .15s ease;
      border: 1px solid var(--border);
      background: var(--bg-surface);
      color: var(--text-main);
      outline: none;
      user-select: none;
    }

    .btn:hover {
      background: var(--bg-card-hover);
      border-color: #3e3e3e;
    }

    .btn:active { transform: scale(0.97); }
    .btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

    .btn-green {
      background: var(--accent-green);
      color: #121212;
      border-color: transparent;
      font-weight: 700;
    }
    .btn-green:hover { background: var(--accent-green-hover); color: #121212; }

    .btn-red {
      background: var(--accent-red);
      color: #ffffff;
      border-color: transparent;
      font-weight: 700;
    }
    .btn-red:hover { background: #f5222d; color: #fff; }

    /* Layout Container */
    .main-container {
      max-width: 1400px;
      margin: 28px auto 0;
      padding: 0 40px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* Top KPI 3-Column Summary Cards */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    @media (max-width: 900px) {
      .summary-grid { grid-template-columns: 1fr; }
    }

    .summary-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .summary-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-sub);
    }

    .summary-value {
      font-size: 36px;
      font-weight: 800;
      letter-spacing: -1px;
      color: var(--text-main);
      font-variant-numeric: tabular-nums;
      line-height: 1.2;
    }

    .summary-desc {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    /* Full-width Panels */
    .panel {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 22px 26px;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border-light);
    }

    .panel-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-main);
      letter-spacing: -0.3px;
    }

    .panel-subinfo {
      font-size: 12px;
      color: var(--text-muted);
    }

    /* Sub KPI 4-Column Row */
    .sub-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }

    @media (max-width: 1000px) {
      .sub-grid { grid-template-columns: repeat(2, 1fr); }
    }

    .sub-card {
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: 10px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .sub-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
    }

    .sub-value {
      font-size: 22px;
      font-weight: 800;
      color: var(--text-main);
      font-variant-numeric: tabular-nums;
    }

    /* Value colors */
    .val-green { color: var(--accent-green) !important; }
    .val-red { color: var(--accent-red) !important; }
    .val-orange { color: var(--accent-orange) !important; }

    /* Badges / Pills */
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11.5px;
      font-weight: 700;
      white-space: nowrap;
    }

    .pill-green { background: var(--accent-green); color: #121212; }
    .pill-red { background: var(--accent-red); color: #ffffff; }
    .pill-orange { background: var(--accent-orange); color: #121212; }
    .pill-dark { background: var(--bg-card); color: var(--text-sub); border: 1px solid var(--border); }

    /* Tables (Clean & Spacious) */
    .table-box {
      width: 100%;
      overflow-x: auto;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--bg-card);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }

    th {
      background: var(--bg-surface);
      color: var(--text-muted);
      font-weight: 600;
      font-size: 12px;
      padding: 14px 20px;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }

    td {
      padding: 14px 20px;
      border-bottom: 1px solid var(--border-light);
      color: var(--text-sub);
      vertical-align: middle;
      white-space: nowrap;
    }

    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255, 255, 255, 0.02); color: var(--text-main); }

    code {
      font-family: "JetBrains Mono", Consolas, monospace;
      background: var(--bg-input);
      color: #93c5fd;
      padding: 3px 7px;
      border-radius: 5px;
      font-size: 12px;
      border: 1px solid var(--border);
    }

    /* Terminal & Diagnostics */
    .log-box {
      height: 240px;
      overflow-y: auto;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 18px;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 12px;
      line-height: 1.65;
      color: var(--text-sub);
    }

    .log-row {
      display: flex;
      gap: 10px;
      margin-bottom: 2px;
      word-break: break-all;
    }

    .log-t { color: var(--text-muted); flex-shrink: 0; }
    .log-tag { color: #58a6ff; font-weight: 600; flex-shrink: 0; }
    .log-m { color: var(--text-main); }
    .log-row.error .log-m { color: var(--accent-red); font-weight: 600; }
    .log-row.warn .log-m { color: var(--accent-orange); }

    .json-textarea {
      width: 100%;
      height: 160px;
      background: var(--bg-input);
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 12px;
      line-height: 1.5;
      resize: vertical;
      outline: none;
    }

    .empty-row {
      padding: 28px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand-group">
      <div class="brand-icon">S</div>
      <div class="brand-title">
        <span>SOOP 원본 녹화 대시보드</span>
        <span class="brand-version" id="engineVersion">v4.0</span>
      </div>
    </div>
    <div class="header-actions">
      <button class="btn" id="refreshBtn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        새로고침
      </button>
      <button class="btn btn-green" id="startBtn" disabled>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
        녹화 시작
      </button>
      <button class="btn btn-red" id="stopBtn" disabled>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
        녹화 중지
      </button>
      <button class="btn" id="copyJsonBtn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        진단 JSON 복사
      </button>
    </div>
  </header>

  <main class="main-container">
    <!-- Top 3-Card Summary Grid (LiveDownload Style) -->
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">녹화 상태</div>
        <div class="summary-value" id="kpiStatus">-</div>
        <div class="summary-desc" id="kpiStatusDesc">스트림 감지 대기 중</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">녹화 시간 및 용량</div>
        <div class="summary-value" id="kpiTime">00:00</div>
        <div class="summary-desc" id="kpiSizeDesc">누적 저장: 0 MiB</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">저장 완료 조각 (Chunks)</div>
        <div class="summary-value" id="kpiChunks">0</div>
        <div class="summary-desc" id="kpiChunksDesc">누락: 0개 · 큐 대기: 0 MiB</div>
      </div>
    </div>

    <!-- 미디어 조각 및 파이프라인 지표 (4-Column) -->
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">청크 파이프라인 지표</h2>
        <span class="panel-subinfo">실시간 무손실 저장</span>
      </div>
      <div class="sub-grid" id="pipelineGrid"></div>
      <div id="missingReport" style="margin-top:14px;padding:12px 18px;background:var(--bg-card);border:1px solid var(--border-light);border-radius:10px;font-size:13px;"></div>
    </section>

    <!-- 녹화 세그먼트 (Part 목록) - Full Width -->
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">세그먼트 목록 (Part)</h2>
      </div>
      <div class="table-box">
        <table>
          <thead>
            <tr>
              <th style="width:10%">Part</th>
              <th style="width:18%">생성 사유</th>
              <th style="width:14%">화질/해상도</th>
              <th style="width:14%">저장율 (청크)</th>
              <th style="width:12%">상태</th>
              <th style="width:32%">파일명</th>
            </tr>
          </thead>
          <tbody id="partsTableBody"></tbody>
        </table>
      </div>
    </section>

    <!-- 활성 미디어 버퍼 (MSE) - Full Width -->
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">미디어 버퍼 (트랙)</h2>
      </div>
      <div class="table-box">
        <table>
          <thead>
            <tr>
              <th style="width:8%">트랙</th>
              <th style="width:24%">MIME / Codecs</th>
              <th style="width:24%">Init 헤더 메타</th>
              <th style="width:14%">저장 완료</th>
              <th style="width:12%">대기 큐</th>
              <th style="width:18%">최근 패킷 박스</th>
            </tr>
          </thead>
          <tbody id="buffersTableBody"></tbody>
        </table>
      </div>
    </section>

    <!-- 타임라인 무결성 & 최종 파일 - Full Width -->
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">타임라인 상태 및 결과</h2>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div id="anomaliesBox"></div>
        <div id="outputBox"></div>
      </div>
    </section>

    <!-- 실시간 이벤트 콘솔 - Full Width -->
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">이벤트 로그</h2>
      </div>
      <div id="logTerminal" class="log-box"></div>
    </section>

    <!-- 진단 JSON 데이터 - Full Width -->
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">진단 데이터 (JSON)</h2>
      </div>
      <textarea id="jsonBox" class="json-textarea" readonly></textarea>
    </section>
  </main>
</body>
</html>`;

  const $ = q => document.querySelector(q);
  const esc = x =>
    String(x ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  const cmd = (command, x = {}) => bus.postMessage({ type: 'command', command, ...x });

  function diag() {
    const snapshot = D.snap ? structuredClone(D.snap) : null;
    if (snapshot) {
      delete snapshot.logs;
    }
    return {
      dashboard: { generatedAt: new Date().toISOString(), channelId },
      snapshot,
      recentLogs: D.logs.slice(-100)
    };
  }

  function render(s) {
    D.snap = s;
    const c = s.capture;
    const f = c.fragments;

    const isReady = c.canStart && !c.recording && !c.starting && !c.stopping;

    const stateTitle = c.rotating
      ? 'Part 교체 중'
      : c.starting
        ? '파일 생성 중'
        : c.stopping
          ? '저장 완료 중'
          : c.recording
            ? '녹화 진행 중'
            : isReady
              ? (c.completedAt ? '저장 완료 (대기 중)' : '녹화 준비 완료')
              : '스트림 대기 중';

    const stateColorClass = c.error
      ? 'val-red'
      : c.recording
        ? 'val-red'
        : isReady
          ? 'val-green'
          : 'val-orange';

    const startBtn = $('#startBtn');
    if (startBtn) {
      startBtn.disabled = !isReady;
      startBtn.textContent = isReady ? '녹화 시작' : (c.recording ? '녹화 중' : '대기 중');
    }

    const stopBtn = $('#stopBtn');
    if (stopBtn) {
      stopBtn.disabled = !c.recording || c.stopping;
    }

    const engineVersion = $('#engineVersion');
    if (engineVersion && s.version) {
      engineVersion.textContent = `v${s.version}`;
    }

    const elapsedMins = String(Math.floor(c.elapsedSeconds / 60)).padStart(2, '0');
    const elapsedSecs = String(c.elapsedSeconds % 60).padStart(2, '0');

    // 1. Top 3 Summary Cards
    const kpiStatus = $('#kpiStatus');
    if (kpiStatus) {
      kpiStatus.className = `summary-value ${stateColorClass}`;
      kpiStatus.textContent = stateTitle;
    }
    const kpiStatusDesc = $('#kpiStatusDesc');
    if (kpiStatusDesc) {
      kpiStatusDesc.textContent = c.recording
        ? `Part ${c.partCount} 녹화 중`
        : isReady
          ? (c.completedAt ? `이전 녹화 완료 (${c.sizeMiB} MiB)` : '녹화 준비 완료')
          : '스트림 연결 대기 중';
    }

    const kpiTime = $('#kpiTime');
    if (kpiTime) {
      kpiTime.textContent = `${elapsedMins}:${elapsedSecs}`;
    }
    const kpiSizeDesc = $('#kpiSizeDesc');
    if (kpiSizeDesc) {
      kpiSizeDesc.textContent = `누적 저장: ${c.sizeMiB} MiB (Part ${c.partCount})`;
    }

    const kpiChunks = $('#kpiChunks');
    if (kpiChunks) {
      kpiChunks.className = `summary-value ${f.written > 0 ? 'val-green' : ''}`;
      kpiChunks.textContent = `${f.written} / ${f.queued}`;
    }
    const kpiChunksDesc = $('#kpiChunksDesc');
    if (kpiChunksDesc) {
      kpiChunksDesc.textContent = `누락 확정: ${f.missingCount}개 · 디스크 대기 큐: ${c.pendingMiB} MiB`;
    }

    // 2. Sub Pipeline Grid (4-Column)
    const pipelineGrid = $('#pipelineGrid');
    if (pipelineGrid) {
      pipelineGrid.innerHTML = `
        <div class="sub-card">
          <div class="sub-label">관찰된 세그먼트 청크</div>
          <div class="sub-value">${f.observed}</div>
        </div>
        <div class="sub-card">
          <div class="sub-label">디스크 쓰기 대기 큐</div>
          <div class="sub-value ${c.pendingMiB > 128 ? 'val-orange' : ''}">${c.pendingMiB} <span style="font-size:13px;color:var(--text-muted)">MiB</span></div>
        </div>
        <div class="sub-card">
          <div class="sub-label">화질 변경 횟수</div>
          <div class="sub-value">${c.qualityChanges} <span style="font-size:13px;color:var(--text-muted)">회</span></div>
        </div>
        <div class="sub-card">
          <div class="sub-label">플레이어 재연결</div>
          <div class="sub-value">${c.reconnects} <span style="font-size:13px;color:var(--text-muted)">회</span></div>
        </div>`;
    }

    const missingReport = $('#missingReport');
    if (missingReport) {
      missingReport.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="color:var(--accent-red);font-weight:700;min-width:110px">확정 누락 sequence ${f.missingCount}개 (최근):</span>
            <code>${esc(f.missingConfirmed.join(', ') || '누락 없음 (완벽 수신)')}</code>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="color:var(--accent-orange);font-weight:700;min-width:110px">판정 대기 ${f.missingPendingCount}개 (최근):</span>
            <code>${esc(f.missingPending.join(', ') || '대기 항목 없음')}</code>
          </div>
        </div>`;
    }

    // 3. Parts Table
    const reasonMap = {
      'user-start': '사용자 시작',
      'quality-change': '화질·코덱 변경',
      reconnect: '플레이어 재연결'
    };

    const partsTableBody = $('#partsTableBody');
    if (partsTableBody) {
      partsTableBody.innerHTML =
        s.parts
          .map(
            p => `
        <tr>
          <td><span class="pill pill-green">Part ${p.number}</span></td>
          <td>${esc(reasonMap[p.reason] || p.reason)}</td>
          <td><span class="pill pill-dark">${esc(p.label || '자동 감지')}</span></td>
          <td><span class="pill ${p.writtenChunks === p.chunks ? 'pill-green' : 'pill-orange'}">${p.writtenChunks}/${p.chunks}</span></td>
          <td><span class="pill ${p.status === 'closed' ? 'pill-dark' : 'pill-red'}">${esc(p.status)}</span></td>
          <td><div style="word-break:break-all;white-space:normal;color:var(--text-sub)">${p.files.map(x => esc(x.name)).join('<br>')}</div></td>
        </tr>`
          )
          .join('') || '<tr><td colspan="6" class="empty-row">기록된 세그먼트가 없습니다.</td></tr>';
    }

    // 4. Buffers Table
    const buffersTableBody = $('#buffersTableBody');
    if (buffersTableBody) {
      buffersTableBody.innerHTML =
        s.buffers
          .map(
            r => `
        <tr>
          <td><b>#${r.id}</b></td>
          <td><code>${esc(r.mime)}</code></td>
          <td>
            <span class="${r.initReady ? 'val-green' : 'val-orange'}" style="font-weight:700">${r.firstBox} (${r.initBytes} B)</span>
            ${r.initMeta?.label ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${esc(r.initMeta.label)}</div>` : ''}
          </td>
          <td><span class="pill ${r.writtenChunks === r.sessionChunks ? 'pill-green' : 'pill-orange'}">${r.writtenChunks}/${r.sessionChunks}</span></td>
          <td>${r.pendingWrites}</td>
          <td><code>${esc(r.lastBoxes.map(b => b.type).join(','))}</code></td>
        </tr>`
          )
          .join('') || '<tr><td colspan="6" class="empty-row">연결된 MSE 소스 버퍼가 없습니다.</td></tr>';
    }

    // 5. Anomalies & Outputs
    const anomaliesBox = $('#anomaliesBox');
    if (anomaliesBox) {
      anomaliesBox.innerHTML = f.discontinuities.length
        ? f.discontinuities
            .map(
              x => `
          <div style="padding:12px 18px;background:rgba(255,160,0,0.15);border:1px solid var(--accent-orange);border-radius:10px;color:var(--accent-orange);font-size:13px">
            ${esc(x.stream || 'unknown')} · Track ${x.trackId ?? '-'} · ${esc(x.type)} · seq ${x.sequence ?? '-'}
          </div>`
            )
            .join('')
        : '<div style="padding:14px 18px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;color:var(--accent-green);font-size:13px;font-weight:700">✓ 타임라인 이상 없음</div>';
    }

    const outputBox = $('#outputBox');
    if (outputBox) {
      outputBox.innerHTML = c.mergeScript
        ? `
        <div style="padding:14px 18px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;font-size:13px">
          <div style="margin-bottom:6px;font-weight:700;color:var(--accent-green)">저장 완료</div>
          <div style="margin-bottom:4px"><b>병합 스크립트:</b> <code>${esc(c.mergeScript)}</code></div>
          <div><b>완성 파일:</b> <code>${esc(c.mergedFilename)}</code></div>
        </div>`
        : `<div style="color:var(--text-muted);font-size:13px;padding:14px 18px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px">녹화 중지 시 병합 스크립트(.bat)가 생성됩니다.</div>`;
    }

    D.logs = s.logs.slice(-100);
    renderLogs();

    const jsonBox = $('#jsonBox');
    if (jsonBox) {
      jsonBox.value = JSON.stringify(diag(), null, 2);
    }
  }

  function renderLogs() {
    const e = $('#logTerminal');
    if (!e) return;
    e.innerHTML = D.logs
      .map(x => {
        const timeStr = x.time ? x.time.split('T')[1]?.slice(0, 8) : '';
        const levelClass = x.level === 'error' ? 'error' : x.level === 'warn' ? 'warn' : '';
        return `<div class="log-row ${levelClass}">
          <span class="log-t">[${esc(timeStr)}]</span>
          <span class="log-tag">[${esc(x.type)}]</span>
          <span class="log-m">${esc(x.message)} ${x.data ? esc(JSON.stringify(x.data)) : ''}</span>
        </div>`;
      })
      .join('');
    e.scrollTop = e.scrollHeight;
  }

  bus.addEventListener('message', e => {
    const m = e.data;
    if (m?.type === 'snapshot') {
      render(m.snapshot);
    }
    if (m?.type === 'log') {
      D.logs.push(m.entry);
      if (D.logs.length > 1000) {
        D.logs.shift();
      }
      renderLogs();
    }
    if (m?.type === 'result' && !m.ok) {
      alert(m.error);
    }
  });

  const refreshBtn = $('#refreshBtn');
  if (refreshBtn) refreshBtn.onclick = () => cmd('snapshot');

  const startBtn = $('#startBtn');
  if (startBtn) {
    startBtn.onclick = async () => {
      try {
        const directoryHandle = await pickNewDirectory();
        cmd('start', { directoryHandle });
      } catch (e) {
        if (e?.name !== 'AbortError') {
          alert(e?.message || e);
        }
      }
    };
  }

  const stopBtn = $('#stopBtn');
  if (stopBtn) stopBtn.onclick = () => cmd('stop');

  const copyJsonBtn = $('#copyJsonBtn');
  if (copyJsonBtn) {
    copyJsonBtn.onclick = async () => {
      const t = JSON.stringify(diag(), null, 2);
      try {
        await navigator.clipboard.writeText(t);
      } catch (_) {
        const box = $('#jsonBox');
        if (box) {
          box.select();
          document.execCommand('copy');
        }
      }
      alert('진단 JSON 데이터가 클립보드에 복사되었습니다.');
    };
  }

  cmd('snapshot');
  setTimeout(() => cmd('snapshot'), 300);
  setTimeout(() => cmd('snapshot'), 1000);

  // 1초마다 실시간 스냅샷 동기화
  setInterval(() => {
    cmd('snapshot');
  }, 1000);
}
