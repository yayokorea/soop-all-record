/**
 * SOOP MSE Direct-to-Disk Capture - 메인 엔트리포인트
 */

import { page, PARAM, debugId, id, bus, S, log, snap } from './config/state.js';
import { setupMseHooks, send } from './core/mseHook.js';
import { start, stop } from './core/diskWriter.js';
import { installControlButton } from './ui/controlButton.js';
import { dashboard } from './ui/dashboard.js';
import { toast } from './ui/toast.js';

// 디버그 모드 대시보드 라우팅
if (debugId) {
  dashboard(debugId);
} else {
  // MSE 프로토타입 후킹 엔진 초기화
  setupMseHooks();

  // BroadcastChannel 메시지 리스너
  bus.addEventListener('message', e => {
    const m = e.data;
    if (m?.type !== 'command') return;

    if (m.command === 'snapshot') {
      send();
    }
    if (m.command === 'start') {
      start(m.directoryHandle).catch(err =>
        bus.postMessage({ type: 'result', ok: false, error: String(err?.message || err) })
      );
    }
    if (m.command === 'stop') {
      stop();
    }
  });

  page.__SOOP_ALL_RECORD__ = { state: S, snapshot: snap, start, stop };
  log('info', 'installed', '후킹 완료: init만 RAM 보관, 미디어는 디스크 직결', { limit: 'none', channelId: id });

  // 플레이어 버튼 및 팝오버 등록
  installControlButton();

  // 방송 변경 감지
  setInterval(() => {
    const current = location.pathname.split('/').filter(Boolean).pop();
    if (current !== S.broadcastId) {
      const previous = S.broadcastId;
      S.broadcastId = current;
      log('warn', 'broadcast-changed', '방송 ID 변경 감지', { previous, current });
      if (S.recording) {
        toast('방송 이동 감지 · 녹화를 종료합니다.', 'warn', 5000);
        stop();
      }
    }
  }, 1000);

  // 창 닫기 방지 경고
  page.addEventListener('beforeunload', event => {
    if (S.recording || S.stopping || S.rotating) {
      event.preventDefault();
      event.returnValue = '녹화 중입니다.';
    }
  });

  setTimeout(send, 500);
  setTimeout(send, 1500);
  setTimeout(send, 3000);
}
