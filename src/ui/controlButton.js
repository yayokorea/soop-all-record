/**
 * SOOP 플레이어 제어 버튼 및 팝오버 메뉴 컴포넌트
 */

import { page, S, PARAM, id, mb } from '../config/state.js';
import { chooseDirectory, rememberDirectory, pickNewDirectory, recalledDirectory } from './storageHelper.js';
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

  const width = Math.min(1150, Math.max(800, Math.floor(window.screen.availWidth * 0.75)));
  const height = Math.min(850, Math.max(600, Math.floor(window.screen.availHeight * 0.8)));
  const left = Math.max(0, Math.floor((window.screen.availWidth - width) / 2));
  const top = Math.max(0, Math.floor((window.screen.availHeight - height) / 2));
  const features = `width=${width},height=${height},left=${left},top=${top},popup=yes,resizable=yes,scrollbars=yes`;

  const popup = page.open(debugUrl.href, `soop_all_record_debug_${id}`, features);
  if (popup && popup.focus) {
    popup.focus();
  }
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

export function updatePopoverContent() {
  if (!popover) return;

  const stateText = S.stopping
    ? '저장 마무리 중'
    : S.starting
      ? '녹화 준비 중'
      : S.recording
        ? '녹화 진행 중'
        : S.canStart
          ? '녹화 대기 중'
          : '스트림 감지 중';

  const fs = S.fragmentStats;
  const missing = [...fs.missing].filter(([, m]) => m.confirmed).length;
  
  const elapsed = S.startedAt ? Math.round((Date.now() - S.startedAt) / 1000) : 0;
  const elapsedMin = Math.floor(elapsed / 60);
  const elapsedSec = String(elapsed % 60).padStart(2, '0');

  const summaryHtml = S.recording
    ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
         <span style="font-weight:800;font-size:17px;color:#ff4d4f;font-variant-numeric:tabular-nums">${elapsedMin}:${elapsedSec}</span>
         <span style="font-weight:700;font-size:14px;color:#ffffff">${mb(S.bytes)} <span style="font-size:11px;color:#737373">MiB</span></span>
       </div>
       <div style="font-size:11px;color:#b3b3b3;display:grid;grid-template-columns:1fr 1fr;gap:5px;line-height:1.4">
         <div>저장: <span style="color:#ffffff;font-weight:700">${fs.written}/${fs.queued}</span></div>
         <div>누락: <span style="color:${missing > 0 ? '#ff4d4f' : '#00c471'};font-weight:700">${missing}</span></div>
         <div>세그먼트: <span style="color:#ffffff;font-weight:700">Part ${S.parts.length}</span></div>
         <div>대기 큐: <span style="color:#ffffff;font-weight:700">${mb(S.pendingBytes)} MiB</span></div>
       </div>`
    : S.completedAt
      ? `<div style="font-size:12px;color:#ffffff;margin-bottom:4px">저장 완료: <b>${fs.written}개 청크</b> (Part ${S.parts.length})</div>
         <div style="font-size:11px;color:#737373;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${S.mergeScript || '병합 스크립트 생성됨'}</div>`
      : `<div style="font-size:12px;color:#b3b3b3">미디어 트랙 초기화: <b style="color:#00c471">${[...S.activeByKind.values()].filter(r => r.init).length}/${S.activeByKind.size}</b></div>`;

  const statusBg = S.recording
    ? 'rgba(255, 77, 79, 0.18)'
    : S.canStart
      ? 'rgba(0, 196, 113, 0.18)'
      : 'rgba(255, 160, 0, 0.18)';
  const statusColor = S.recording
    ? '#ff4d4f'
    : S.canStart
      ? '#00c471'
      : '#ffa000';
  const dotColor = S.recording
    ? '#ff4d4f'
    : S.canStart
      ? '#00c471'
      : '#ffa000';

  const dotEl = popover.querySelector('#sarDot');
  if (dotEl) dotEl.style.background = dotColor;

  const stateBadge = popover.querySelector('#sarStateBadge');
  if (stateBadge) {
    stateBadge.textContent = stateText;
    stateBadge.style.background = statusBg;
    stateBadge.style.color = statusColor;
  }

  const summaryEl = popover.querySelector('#sarSummary');
  if (summaryEl) summaryEl.innerHTML = summaryHtml;

  const folderNameEl = popover.querySelector('#sarFolderName');
  if (folderNameEl) {
    const name = S.recording
      ? (S.directory?.name || '녹화 세션 폴더')
      : (S.rootDirectory?.name || S.directory?.name || '시작 시 지정');
    folderNameEl.textContent = name;
    folderNameEl.title = name;
  }

  const primaryBtn = popover.querySelector('#sarPrimary');
  const folderBtn = popover.querySelector('#sarFolder');

  if (primaryBtn) {
    primaryBtn.textContent = S.recording ? '녹화 중지' : '새 녹화 시작';
    primaryBtn.style.background = S.recording ? '#ff4d4f' : '#00c471';
    primaryBtn.style.color = S.recording ? '#ffffff' : '#141414';
    primaryBtn.disabled = (!S.recording && !S.canStart) || S.starting || S.stopping;
    if (S.recording) {
      primaryBtn.style.width = '100%';
    } else {
      primaryBtn.style.width = '';
      primaryBtn.style.flex = '1';
    }
  }

  if (folderBtn) {
    folderBtn.style.display = S.recording ? 'none' : 'inline-block';
    folderBtn.disabled = S.recording;
  }
}

export function showPopover(reposition = true) {
  if (!popover) {
    popover = document.createElement('div');
    popover.id = 'soopAllRecordPopover';
    Object.assign(popover.style, {
      position: 'fixed',
      zIndex: '2147483646',
      width: '320px',
      padding: '18px',
      borderRadius: '14px',
      background: 'rgba(20, 20, 20, 0.96)',
      backdropFilter: 'blur(20px)',
      webkitBackdropFilter: 'blur(20px)',
      border: '1px solid #2e2e2e',
      color: '#ffffff',
      font: '13px/1.5 -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.7), 0 0 1px 1px rgba(255, 255, 255, 0.06)',
      boxSizing: 'border-box',
      userSelect: 'none'
    });

    popover.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div style="font-weight:700;font-size:14px;color:#ffffff;display:flex;align-items:center;gap:8px">
          <span id="sarDot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ffa000;"></span>
          SOOP 원본 녹화
        </div>
        <span id="sarStateBadge" style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;background:rgba(255,160,0,0.18);color:#ffa000">스트림 감지 중</span>
      </div>
      <div id="sarSummary" style="background:#1e1e1e;border:1px solid #282828;border-radius:10px;padding:12px 14px;margin-bottom:12px"></div>
      <div style="color:#737373;font-size:11.5px;margin-bottom:14px;display:flex;align-items:center;gap:4px;overflow:hidden">
        <span style="flex-shrink:0;color:#737373">폴더:</span>
        <span id="sarFolderName" style="font-weight:600;color:#b3b3b3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">시작 시 지정</span>
      </div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button id="sarPrimary" style="flex:1;min-width:120px;padding:9px 14px;border:0;border-radius:8px;background:#00c471;color:#141414;font-weight:700;cursor:pointer;font-size:12.5px;transition:opacity .15s">새 녹화 시작</button>
        <button id="sarFolder" style="padding:9px 12px;border:1px solid #2e2e2e;border-radius:8px;background:#1e1e1e;color:#b3b3b3;font-weight:600;cursor:pointer;font-size:12px">폴더 변경</button>
        <button id="sarDebug" style="width:100%;margin-top:2px;padding:8px 10px;border:1px solid #282828;border-radius:8px;background:transparent;color:#737373;font-weight:600;cursor:pointer;font-size:11.5px">상세 모니터링 대시보드</button>
      </div>`;

    document.documentElement.appendChild(popover);

    // 이벤트 1회 바인딩
    const primaryBtn = popover.querySelector('#sarPrimary');
    if (primaryBtn) {
      primaryBtn.onclick = async () => {
        hidePopover();
        if (S.recording) {
          await stop();
        } else {
          await beginFromUi();
        }
      };
    }

    const folderBtn = popover.querySelector('#sarFolder');
    if (folderBtn) {
      folderBtn.onclick = async () => {
        try {
          const handle = await pickNewDirectory();
          S.directory = handle;
          toast(`저장 폴더가 [${handle.name}] 폴더로 변경되었습니다.`);
          updatePopoverContent();
        } catch (error) {
          if (error?.name !== 'AbortError') {
            toast(friendlyError(error), 'error');
          }
        }
      };
    }

    const debugBtn = popover.querySelector('#sarDebug');
    if (debugBtn) {
      debugBtn.onclick = () => openDebug();
    }

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

  updatePopoverContent();

  // 위치 재계산은 사용자가 직접 열었거나(reposition = true), 아직 화면에 표시되지 않은 경우에만 수행
  if (reposition || popover.style.display !== 'block') {
    const rect = controlButton?.getBoundingClientRect();
    if (rect) {
      const popoverWidth = 320;
      const left = Math.max(12, Math.min(window.innerWidth - popoverWidth - 12, rect.right - popoverWidth));
      const bottomDistance = Math.max(48, window.innerHeight - rect.top + 8);
      popover.style.left = `${left}px`;
      popover.style.bottom = `${bottomDistance}px`;
      popover.style.top = 'auto';
    }
  }

  popover.style.display = 'block';
}

export function updateControlButton() {
  if (!controlButton) return;

  const elapsed = S.startedAt ? Math.round((Date.now() - S.startedAt) / 1000) : 0;
  const mins = Math.floor(elapsed / 60);
  const secs = String(elapsed % 60).padStart(2, '0');

  if (S.stopping || S.starting) {
    controlButton.innerHTML = `<span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#00c471;border-radius:50%;animation:soopAllRecordSpin .8s linear infinite;box-sizing:border-box;"></span>`;
    controlButton.title = S.starting ? '녹화 시작 준비 중...' : '파일 저장 마무리 중...';
  } else if (S.recording) {
    controlButton.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;background:rgba(255,77,79,0.2);border:1px solid rgba(255,77,79,0.5);border-radius:14px;">
        <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#ff4d4f;animation:soopAllRecordPulse 1.2s ease-in-out infinite;"></span>
        <span style="font-size:11.5px;font-weight:700;color:#ff7875;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;line-height:1;font-variant-numeric:tabular-nums;">${mins}:${secs}</span>
      </span>`;
    controlButton.title = `SOOP 원본 녹화 중 · ${mb(S.bytes)} MiB · 좌클릭: 중지 · 우클릭: 상세 정보`;
  } else if (S.canStart) {
    controlButton.innerHTML = `
      <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;">
        <span style="display:inline-block;width:13px;height:13px;border-radius:50%;background:#00c471;transition:transform .15s ease;"></span>
      </span>`;
    controlButton.title = 'SOOP 원본 녹화 준비 완료 · 좌클릭: 녹화 시작 · 우클릭: 상세 정보';
  } else {
    controlButton.innerHTML = `
      <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;">
        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid #666666;background:transparent;box-sizing:border-box;"></span>
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
      if (popover && popover.style.display === 'block') {
        hidePopover();
      } else {
        showPopover(true);
      }
    });

    button.addEventListener('contextmenu', event => {
      event.preventDefault();
      event.stopPropagation();
      openDebug();
    });

    const ensureFirst = () => {
      if (right.firstElementChild !== button) {
        right.prepend(button);
      }
    };

    ensureFirst();
    controlButton = button;
    updateControlButton();

    // SOOP 플레이어가 나중에 다른 버튼들을 추가하더라도 항상 맨 앞(왼쪽) 유지
    const ctrlObserver = new MutationObserver(() => {
      ensureFirst();
    });
    ctrlObserver.observe(right, { childList: true });

    recalledDirectory().then(dir => {
      if (dir && !S.rootDirectory) {
        S.rootDirectory = dir;
        updatePopoverContent();
      }
    }).catch(() => {});

    setInterval(() => {
      ensureFirst();
      updateControlButton();
      if (popover?.style.display === 'block') {
        showPopover(false);
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
