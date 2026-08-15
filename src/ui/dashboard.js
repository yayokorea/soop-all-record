/**
 * [6] 대시보드 UI 및 이벤트 렌더러 (Dashboard UI & Event Renderers)
 */

import { page } from '../config/state.js';

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
  <title>SOOP 원본 캡처 센터 · 상세 모니터링</title>
  <style>
    :root {
      --bg: #f8fafc;
      --card: #ffffff;
      --text: #0f172a;
      --text-sub: #475569;
      --text-muted: #94a3b8;
      --border: #e2e8f0;
      --border-light: #f1f5f9;
      --primary: #10b981;
      --primary-light: #ecfdf5;
      --primary-dark: #047857;
      --danger: #ef4444;
      --danger-light: #fef2f2;
      --danger-dark: #b91c1c;
      --warn: #f59e0b;
      --warn-light: #fffbeb;
      --warn-dark: #b45309;
      --info: #3b82f6;
      --info-light: #eff6ff;
      --info-dark: #1d4ed8;
      --shadow-sm: 0 1px 2px 0 rgba(0,0,0,0.05);
      --shadow: 0 4px 12px -2px rgba(15,23,42,0.06), 0 2px 6px -2px rgba(15,23,42,0.04);
      --shadow-lg: 0 12px 28px -4px rgba(15,23,42,0.08), 0 4px 12px -2px rgba(15,23,42,0.04);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, "Noto Sans KR", sans-serif;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
      padding: 14px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      box-shadow: var(--shadow-sm);
    }
    .header-title { display: flex; align-items: center; gap: 10px; }
    .header-title h1 { font-size: 18px; font-weight: 700; letter-spacing: -0.4px; color: var(--text); }
    .header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all .15s ease;
      border: 1px solid var(--border);
      background: #fff;
      color: var(--text-sub);
      box-shadow: var(--shadow-sm);
      outline: none;
    }
    .btn:hover { background: #f8fafc; color: var(--text); border-color: #cbd5e1; }
    .btn:active { transform: scale(0.97); }
    .btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
    .btn-primary { background: var(--primary); color: #fff; border-color: transparent; }
    .btn-primary:hover { background: #059669; color: #fff; }
    .btn-danger { background: var(--danger); color: #fff; border-color: transparent; }
    .btn-danger:hover { background: #dc2626; color: #fff; }
    .main-container { max-width: 1440px; margin: 24px auto; padding: 0 24px; display: flex; flex-direction: column; gap: 20px; }
    .panel {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px 24px;
      box-shadow: var(--shadow);
      transition: box-shadow .2s;
    }
    .panel:hover { box-shadow: var(--shadow-lg); }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-light);
    }
    .panel-title { font-size: 16px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 8px; }
    .panel-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: var(--border-light); color: var(--text-sub); }
    .grid-kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); gap: 14px; }
    .kpi-card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: all .15s;
    }
    .kpi-card:hover { background: #fff; border-color: #cbd5e1; transform: translateY(-2px); box-shadow: var(--shadow-sm); }
    .kpi-label { font-size: 12px; font-weight: 600; color: var(--text-sub); }
    .kpi-value { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: var(--text); word-break: break-all; }
    .ok { color: var(--primary-dark) !important; }
    .warn { color: var(--warn-dark) !important; }
    .error { color: var(--danger-dark) !important; }
    .info { color: var(--info-dark) !important; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; letter-spacing: -0.2px; }
    .badge-ok { background: var(--primary-light); color: var(--primary-dark); }
    .badge-warn { background: var(--warn-light); color: var(--warn-dark); }
    .badge-error { background: var(--danger-light); color: var(--danger-dark); }
    .badge-info { background: var(--info-light); color: var(--info-dark); }
    .badge-muted { background: var(--border-light); color: var(--text-sub); }
    .table-wrapper { overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; background: #fff; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    th { background: var(--bg); color: var(--text-sub); font-weight: 600; font-size: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border); white-space: nowrap; }
    td { padding: 12px 16px; border-bottom: 1px solid var(--border-light); color: var(--text); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(248, 250, 252, 0.8); }
    code { font-family: "JetBrains Mono", Consolas, monospace; background: #f1f5f9; color: #334155; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    .log-console { height: 280px; overflow: auto; background: #0f172a; color: #e2e8f0; padding: 14px; border-radius: 10px; font-family: "JetBrains Mono", Consolas, monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; }
    .log-line { margin-bottom: 2px; }
    .log-line.error { color: #f87171; }
    .log-line.warn { color: #fbbf24; }
    .log-line.info { color: #93c5fd; }
    .json-box { width: 100%; height: 220px; background: var(--bg); color: #334155; border: 1px solid var(--border); border-radius: 10px; padding: 14px; font-family: "JetBrains Mono", Consolas, monospace; font-size: 12px; line-height: 1.5; resize: vertical; }
    .empty-msg { padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px; }
    .pulse-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: var(--primary); box-shadow: 0 0 8px var(--primary); }
    .pulse-dot.recording { background: var(--danger); box-shadow: 0 0 8px var(--danger); animation: soopMsePulse 1.2s infinite; }
    @keyframes soopMsePulse { 0% { transform: scale(0.9); opacity: 0.8; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(0.9); opacity: 0.8; } }
  </style>
</head>
<body>
  <header>
    <div class="header-title">
      <span class="pulse-dot" id="headerDot"></span>
      <h1>SOOP 원본 녹화 · 상세 모니터링</h1>
      <span class="badge badge-info">Direct-to-Disk</span>
    </div>
    <div class="header-actions">
      <button class="btn" id="refresh">새로고침</button>
      <button class="btn btn-primary" id="start" disabled>녹화 시작 · 폴더 선택</button>
      <button class="btn btn-danger" id="stop" disabled>녹화 중지</button>
      <button class="btn" id="copy">진단 JSON 복사</button>
    </div>
  </header>
  <main class="main-container">
    <section class="panel">
      <div class="panel-header">
        <div class="panel-title"><span>📊</span> 현재 녹화 상태</div>
        <span class="panel-badge" id="liveStateBadge">연결 대기</span>
      </div>
      <div id="status" class="grid-kpi"></div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div class="panel-title"><span>🛡️</span> 조각 무결성 모니터링</div>
      </div>
      <div id="fragments" class="grid-kpi"></div>
      <div id="missing" style="margin-top:14px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#334155;"></div>
    </section>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(500px,1fr));gap:20px">
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title"><span>🎬</span> 녹화 Part 목록</div>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Part</th><th>사유</th><th>화질</th><th>Gen</th><th>저장율</th><th>상태</th><th>파일명</th></tr></thead>
            <tbody id="parts"></tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div class="panel-title"><span>📡</span> 활성 트랙 버퍼</div>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>ID</th><th>Gen</th><th>타입</th><th>Init 정보</th><th>저장율</th><th>대기</th><th>최근 박스</th></tr></thead>
            <tbody id="buffers"></tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="panel">
      <div class="panel-header">
        <div class="panel-title"><span>⚡</span> 타임라인 이상 감지</div>
      </div>
      <div id="anomalies"></div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div class="panel-title"><span>📦</span> 최종 생성 파일 및 병합 스크립트</div>
      </div>
      <div id="outputs"></div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div class="panel-title"><span>📜</span> 실시간 이벤트 로그</div>
      </div>
      <div id="logs" class="log-console"></div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div class="panel-title"><span>⚙️</span> 문제 해결용 진단 JSON</div>
      </div>
      <textarea id="json" class="json-box" readonly></textarea>
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
    const status = c.rotating
      ? 'Part 전환 중'
      : c.starting
        ? '파일 준비 중'
        : c.stopping
          ? '파일 마무리 중'
          : c.recording
            ? '녹화 중'
            : c.canStart
              ? '시작 가능'
              : '스트림 준비 중';

    const statusBadgeClass = c.error
      ? 'badge-error'
      : c.recording
        ? 'badge-error'
        : c.canStart
          ? 'badge-ok'
          : 'badge-warn';

    const statusTextClass = c.error ? 'error' : c.recording ? 'error' : c.canStart ? 'ok' : 'warn';

    $('#start').disabled = !c.canStart;
    $('#start').textContent = c.canStart ? '녹화 시작 · 폴더 선택' : '시작 준비 중';
    $('#stop').disabled = !c.recording;

    const dot = $('#headerDot');
    if (dot) {
      dot.className = c.recording ? 'pulse-dot recording' : 'pulse-dot';
      dot.style.background = c.recording ? '#ef4444' : c.canStart ? '#10b981' : '#94a3b8';
    }

    $('#liveStateBadge').className = `badge ${statusBadgeClass}`;
    $('#liveStateBadge').textContent = status;

    $('#status').innerHTML = `
      <div class="kpi-card"><div class="kpi-label">녹화 상태</div><div class="kpi-value ${statusTextClass}">${esc(status)}</div></div>
      <div class="kpi-card"><div class="kpi-label">녹화 시간</div><div class="kpi-value">${Math.floor(c.elapsedSeconds / 60)}분 ${c.elapsedSeconds % 60}초</div></div>
      <div class="kpi-card"><div class="kpi-label">저장 용량</div><div class="kpi-value">${c.sizeMiB} <span style="font-size:14px;color:var(--text-sub)">MiB</span></div></div>
      <div class="kpi-card"><div class="kpi-label">Part 번호</div><div class="kpi-value">${c.partCount}</div></div>
      <div class="kpi-card"><div class="kpi-label">화질 변경</div><div class="kpi-value">${c.qualityChanges} <span style="font-size:14px;color:var(--text-sub)">회</span></div></div>
      <div class="kpi-card"><div class="kpi-label">플레이어 재연결</div><div class="kpi-value">${c.reconnects} <span style="font-size:14px;color:var(--text-sub)">회</span></div></div>
      <div class="kpi-card"><div class="kpi-label">디스크 쓰기 대기</div><div class="kpi-value ${c.pendingMiB > 128 ? 'warn' : 'ok'}">${c.pendingMiB} <span style="font-size:14px;color:var(--text-sub)">MiB</span></div></div>
      <div class="kpi-card"><div class="kpi-label">오류 상태</div><div class="kpi-value ${c.error ? 'error' : 'ok'}" style="font-size:15px">${esc(c.error || '정상')}</div></div>`;

    $('#fragments').innerHTML = `
      <div class="kpi-card"><div class="kpi-label">관찰된 조각</div><div class="kpi-value">${f.observed}</div></div>
      <div class="kpi-card"><div class="kpi-label">저장 대상</div><div class="kpi-value">${f.queued}</div></div>
      <div class="kpi-card"><div class="kpi-label">디스크 저장 완료</div><div class="kpi-value ${f.written === f.queued && !c.recording ? 'ok' : ''}">${f.written}</div></div>
      <div class="kpi-card"><div class="kpi-label">쓰기 실패</div><div class="kpi-value ${f.failed ? 'error' : 'ok'}">${f.failed}</div></div>
      <div class="kpi-card"><div class="kpi-label">확정 누락</div><div class="kpi-value ${f.missingCount ? 'error' : 'ok'}">${f.missingCount}</div></div>
      <div class="kpi-card"><div class="kpi-label">중복 / 지연 도착</div><div class="kpi-value">${f.duplicates} / ${f.late}</div></div>`;

    $('#missing').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px">
        <div><b style="color:var(--danger-dark)">누락 확정 번호:</b> <code>${esc(f.missingConfirmed.join(', ') || '없음 (완벽)')}</code></div>
        <div><b style="color:var(--warn-dark)">판정 대기 번호:</b> <code>${esc(f.missingPending.join(', ') || '없음')}</code></div>
      </div>`;

    const reason = {
      'user-start': '사용자 시작',
      'quality-change': '화질·코덱 변경',
      reconnect: '플레이어 재연결'
    };

    $('#parts').innerHTML =
      s.parts
        .map(
          p => `
      <tr>
        <td><span class="badge badge-info">Part ${p.number}</span></td>
        <td>${esc(reason[p.reason] || p.reason)}</td>
        <td><span class="badge badge-muted">${esc(p.label)}</span></td>
        <td>${p.generation}</td>
        <td><span class="badge ${p.writtenChunks === p.chunks ? 'badge-ok' : 'badge-warn'}">${p.writtenChunks}/${p.chunks}</span></td>
        <td><span class="badge ${p.status === 'closed' ? 'badge-ok' : 'badge-error'}">${esc(p.status)}</span></td>
        <td style="font-size:12px;color:var(--text-sub)">${p.files.map(x => esc(x.name)).join('<br>')}</td>
      </tr>`
        )
        .join('') || '<tr><td colspan="7" class="empty-msg">아직 기록된 Part가 없습니다.</td></tr>';

    $('#buffers').innerHTML =
      s.buffers
        .map(
          r => `
      <tr>
        <td><b>#${r.id}</b></td>
        <td>${r.generation}</td>
        <td><span class="badge badge-muted">${esc(r.mime)}</span></td>
        <td class="${r.initReady ? 'ok' : 'warn'}">${r.firstBox} ${r.initBytes}B<br><small style="color:var(--text-sub)">${esc(r.initMeta?.label || '')}</small></td>
        <td><span class="badge ${r.writtenChunks === r.sessionChunks ? 'badge-ok' : 'badge-warn'}">${r.writtenChunks}/${r.sessionChunks}</span></td>
        <td>${r.pendingWrites}</td>
        <td><code>${esc(r.lastBoxes.map(b => b.type).join(','))}</code></td>
      </tr>`
        )
        .join('') || '<tr><td colspan="7" class="empty-msg">연결된 트랙 버퍼가 없습니다.</td></tr>';

    $('#anomalies').innerHTML = f.discontinuities.length
      ? f.discontinuities
          .map(
            x => `
      <div style="padding:10px 14px;background:var(--warn-light);border:1px solid #fed7aa;border-radius:8px;color:var(--warn-dark);font-size:13px;margin-bottom:6px">
        Track ${x.trackId} · ${esc(x.type)} · seq ${x.sequence ?? '-'} · ${esc(JSON.stringify(x))}
      </div>`
          )
          .join('')
      : '<div style="padding:12px;background:var(--primary-light);border:1px solid #a7f3d0;border-radius:8px;color:var(--primary-dark);font-size:13px;font-weight:600">✓ 타임라인 이상이 감지되지 않았습니다. 원본 스트림이 매우 안정적입니다.</div>';

    $('#outputs').innerHTML = c.mergeScript
      ? `
      <div style="padding:14px;background:#f8fafc;border:1px solid var(--border);border-radius:10px;font-size:13px">
        <div style="margin-bottom:8px;font-weight:700;color:var(--primary-dark)">✓ 녹화 및 파일 쓰기가 완료되었습니다!</div>
        <div style="margin-bottom:4px"><b>무손실 병합 스크립트:</b> <code>${esc(c.mergeScript)}</code></div>
        <div><b>완성 파일:</b> <code>${esc(c.mergedFilename)}</code></div>
      </div>`
      : `<div style="color:var(--text-muted);font-size:13px">녹화 중지 후 Part별 무손실 병합 스크립트(.bat)와 녹화정보 JSON이 자동 생성됩니다.</div>`;

    D.logs = s.logs.slice(-100);
    renderLogs();
    $('#json').value = JSON.stringify(diag(), null, 2);
  }

  function renderLogs() {
    const e = $('#logs');
    e.innerHTML = D.logs
      .map(
        x =>
          `<div class="log-line ${x.level}">[${esc(x.time.split('T')[1].slice(0, 8))}] [${esc(x.type)}] ${esc(x.message)} ${x.data ? esc(JSON.stringify(x.data)) : ''}</div>`
      )
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

  $('#refresh').onclick = () => cmd('snapshot');

  $('#start').onclick = async () => {
    try {
      if (!page.showDirectoryPicker) {
        throw new Error('File System Access API 미지원');
      }
      const directoryHandle = await page.showDirectoryPicker({
        mode: 'readwrite',
        id: 'soop-mse-capture'
      });
      cmd('start', { directoryHandle });
    } catch (e) {
      if (e?.name !== 'AbortError') {
        alert(e?.message || e);
      }
    }
  };

  $('#stop').onclick = () => cmd('stop');

  $('#copy').onclick = async () => {
    const t = JSON.stringify(diag(), null, 2);
    try {
      await navigator.clipboard.writeText(t);
    } catch (_) {
      $('#json').select();
      document.execCommand('copy');
    }
    alert('진단 JSON 데이터가 클립보드에 복사되었습니다.');
  };

  cmd('snapshot');
  setTimeout(() => cmd('snapshot'), 500);
  setTimeout(() => cmd('snapshot'), 1500);
}
