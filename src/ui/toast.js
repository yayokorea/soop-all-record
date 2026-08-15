/**
 * [3] 토스트 알림 및 사용자 친화적 에러 메시지
 */

let toastTimer = 0;

export function friendlyError(error) {
  const name = error?.name || '';
  const text = String(error?.message || error || '오류');

  if (name === 'AbortError') return '취소되었습니다.';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return '저장 폴더 권한이 없습니다.';
  }
  if (name === 'QuotaExceededError') {
    return '저장 공간이 부족합니다.';
  }
  return `저장 오류: ${text}`;
}

export function toast(message, level = 'ok', duration = 4500) {
  let el = document.getElementById('soopAllRecordToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'soopAllRecordToast';
    Object.assign(el.style, {
      position: 'fixed',
      right: '24px',
      bottom: '72px',
      zIndex: '2147483647',
      maxWidth: '440px',
      padding: '13px 18px',
      borderRadius: '12px',
      color: '#fff',
      font: '13px/1.5 -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
      transition: 'all .25s ease',
      transform: 'translateY(0)',
      backdropFilter: 'blur(8px)'
    });
    document.documentElement.appendChild(el);
  }

  el.style.background =
    level === 'error'
      ? 'rgba(220, 38, 38, 0.95)'
      : level === 'warn'
        ? 'rgba(217, 119, 6, 0.95)'
        : 'rgba(16, 185, 129, 0.95)';
  el.textContent = message;
  el.style.opacity = '1';
  el.style.pointerEvents = 'auto';

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
  }, duration);
}
