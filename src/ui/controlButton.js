/**
 * SOOP 플레이어 제어 버튼 및 팝오버 메뉴 컴포넌트
 */

import { page, S, PARAM, id, mb } from '../config/state.js';
import { chooseDirectory, rememberDirectory } from './storageHelper.js';
import { toast, friendlyError } from './toast.js';
import { start, stop } from '../core/diskWriter.js';
import { setControlButtonUpdater } from '../core/mseHook.js';

let controlButton = null;
let popover = null;

export function hidePopover() {
  if (popover) {
    popover.style.display = 'none';
  }
}

export function openDebug() {
  const debugUrl = new URL(location.href);
  debugUrl.searchParams.set(PARAM, id);
  debugUrl.hash = '';
  page.open(debugUrl.href, `soop_all_record_debug_${id}`);
}

export async function beginFromUi() {
  if (!S.canStart) {
    return toast('아직 스트림을 준비하고 있습니다. 잠시 후 다시 시도하세요.', 'warn');
  }
  try {
    toast('저장 폴더를 준비하고 있습니다.', 'warn', 1800);
    const dir = await chooseDirectory();
    await start(dir);
    toast('● 원본 녹화를 시작했습니다.');
  } catch (error) {
    if (error?.name !== 'AbortError') {
      toast(friendlyError(error), 'error', 7000);
    }
  }
}

export function showPopover() {
  if (!popover) {
    popover = document.createElement('div');
    popover.id = 'soopAllRecordPopover';
    Object.assign(popover.style, {
      position: 'fixed',
      zIndex: '2147483646',
      width: '310px',
      padding: '16px 18px',
      border: '1px solid #e2e8f0',
      borderRadius: '14px',
      background: '#ffffff',
      color: '#1e293b',
      font: '13px/1.5 -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 16px 36px -4px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(0,0,0,0.06)'
    });
    document.documentElement.appendChild(popover);

    document.addEventListener(
      'click',
      e => {
        if (
          popover.style.display !== 'none' &&
          !popover.contains(e.target) &&
          e.target !== controlButton &&
          !controlButton?.contains(e.target)
        ) {
          hidePopover();
        }
      },
      true
    );
  }

  const rect = controlButton.getBoundingClientRect();
  const stateText = S.stopping
    ? '파일 마무리 중'
    : S.starting
      ? '파일 생성 중'
      : S.recording
        ? '녹화 중'
        : S.canStart
          ? '녹화 준비 완료'
          : '스트림 준비 중';

  const fs = S.fragmentStats;
  const missing = [...fs.missing].filter(([, m]) => m.confirmed).length;
  const summary = S.recording
    ? `● ${Math.round((Date.now() - S.startedAt) / 1000)}초 · ${mb(S.bytes)} MiB<br><span style="font-size:12px;color:#64748b">저장 ${fs.written}/${fs.queued} · 누락 ${missing} · Part ${S.parts.length} · 대기 ${mb(S.pendingBytes)} MiB</span>`
    : S.completedAt
      ? `저장 ${fs.written}/${fs.queued} · 누락 ${missing} · Part ${S.parts.length}<br><span style="font-size:12px;color:#64748b">${S.mergeScript || ''}</span>`
      : `영상/음성 초기화 ${[...S.activeByKind.values()].filter(r => r.init).length}/${S.activeByKind.size}`;

  const statusBg = S.recording ? '#fee2e2' : S.canStart ? '#d1fae5' : '#f1f5f9';
  const statusColor = S.recording ? '#dc2626' : S.canStart ? '#059669' : '#64748b';

  popover.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-weight:700;font-size:15px;color:#0f172a;display:flex;align-items:center;gap:6px">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${S.recording ? '#ef4444' : S.canStart ? '#10b981' : '#94a3b8'};"></span>
        SOOP 원본 녹화
      </div>
      <span style="font-size:11px;font-weight:600;padding:2px 7px;border-radius:999px;background:${statusBg};color:${statusColor}">${stateText}</span>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px;color:#334155">${summary}</div>
    <div style="color:#64748b;font-size:12px;margin-bottom:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">저장 폴더: <b>${S.directory?.name || '처음 시작할 때 선택'}</b></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button id="sarPrimary" style="flex:1;padding:8px 12px;border:0;border-radius:8px;background:${S.recording ? '#ef4444' : '#10b981'};color:#fff;font-weight:600;cursor:pointer;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.08)" ${(!S.recording && !S.canStart) || S.starting || S.stopping ? 'disabled' : ''}>${S.recording ? '녹화 중지' : '새 녹화 시작'}</button>
      <button id="sarFolder" style="padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;color:#334155;font-weight:500;cursor:pointer;font-size:12px" ${S.recording ? 'disabled' : ''}>폴더 변경</button>
      <button id="sarDebug" style="width:100%;margin-top:4px;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#475569;font-weight:500;cursor:pointer;font-size:12px">상세 모니터링 대시보드 열기</button>
    </div>`;

  popover.querySelector('#sarPrimary').onclick = async () => {
    hidePopover();
    if (S.recording) {
      await stop();
    } else {
      await beginFromUi();
    }
  };

  popover.querySelector('#sarFolder').onclick = async () => {
    try {
      const handle = await page.showDirectoryPicker({ mode: 'readwrite', id: 'soop-all-record' });
      await rememberDirectory(handle);
      S.directory = handle;
      toast(`저장 폴더: ${handle.name}`);
      showPopover();
    } catch (error) {
      if (error?.name !== 'AbortError') {
        toast(friendlyError(error), 'error');
      }
    }
  };

  popover.querySelector('#sarDebug').onclick = () => openDebug();
  popover.style.left = `${Math.max(8, Math.min(innerWidth - 320, rect.right - 310))}px`;
  popover.style.top = `${Math.max(8, rect.top - 230)}px`;
  popover.style.display = 'block';
}

export function updateControlButton() {
  if (!controlButton) return;

  const elapsed = S.startedAt ? Math.round((Date.now() - S.startedAt) / 1000) : 0;
  const mins = Math.floor(elapsed / 60);
  const secs = String(elapsed % 60).padStart(2, '0');

  if (S.stopping || S.starting) {
    controlButton.innerHTML = `<span style="display:inline-block;width:16px;height:16px;border:2.5px solid #94a3b8;border-top-color:#10b981;border-radius:50%;animation:soopAllRecordSpin .8s linear infinite;box-sizing:border-box;"></span>`;
    controlButton.title = S.starting ? '녹화 준비 중...' : '파일 저장 마무리 중...';
  } else if (S.recording) {
    controlButton.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:6px;padding:3px 8px;background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.4);border-radius:20px;">
        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#ef4444;box-shadow:0 0 10px #ef4444;animation:soopAllRecordPulse 1.2s ease-in-out infinite;"></span>
        <span style="font-size:12px;font-weight:700;color:#ff5a67;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;line-height:1;">${mins}:${secs}</span>
      </span>`;
    controlButton.title = `SOOP 원본 녹화 중 · ${mb(S.bytes)} MiB · 좌클릭: 중지 · 우클릭: 상세 정보`;
  } else if (S.canStart) {
    controlButton.innerHTML = `
      <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:rgba(16,185,129,0.15);transition:all .2s ease;">
        <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:#10b981;box-shadow:0 0 10px rgba(16,185,129,0.85);transition:transform .15s ease-out;"></span>
      </span>`;
    controlButton.title = 'SOOP 원본 녹화 준비 완료 · 좌클릭: 녹화 시작 · 우클릭: 상세 정보';
  } else {
    controlButton.innerHTML = `
      <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;">
        <span style="display:inline-block;width:16px;height:16px;border-radius:50%;border:2px solid #8e9bad;background:transparent;box-sizing:border-box;"></span>
      </span>`;
    controlButton.title = 'SOOP 원본 녹화 초기화 세그먼트 준비 중';
  }
}

export function installControlButton() {
  setControlButtonUpdater(updateControlButton);

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes soopAllRecordPulse { 0% { transform: scale(0.92); opacity: 0.8; } 50% { transform: scale(1.18); opacity: 1; box-shadow: 0 0 12px #ef4444; } 100% { transform: scale(0.92); opacity: 0.8; } }
    @keyframes soopAllRecordSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .btn_soop_all_record:hover { filter: brightness(1.2); }
    .btn_soop_all_record:active { transform: scale(0.94); }
  `;
  document.head.appendChild(styleEl);

  const attach = () => {
    if (controlButton?.isConnected) return true;
    const right = document.querySelector('div.right_ctrl');
    if (!right) return false;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn_soop_all_record';
    button.setAttribute('aria-label', 'SOOP 원본 녹화');
    Object.assign(button.style, {
      minWidth: '36px',
      height: '32px',
      padding: '0 4px',
      margin: '0 3px',
      border: '0',
      background: 'transparent',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      verticalAlign: 'middle',
      outline: 'none',
      transition: 'transform 0.15s ease'
    });

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (S.recording || S.starting || S.stopping || !S.canStart) {
        showPopover();
      } else {
        beginFromUi();
      }
    });

    button.addEventListener('contextmenu', event => {
      event.preventDefault();
      event.stopPropagation();
      openDebug();
    });

    right.prepend(button);
    controlButton = button;
    updateControlButton();

    setInterval(() => {
      updateControlButton();
      if (popover?.style.display === 'block') {
        showPopover();
      }
    }, 1000);

    return true;
  };

  if (attach()) return;
  const observer = new MutationObserver(() => {
    if (attach()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
