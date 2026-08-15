# SOOP(숲) 라이브 무손실 원본 녹화기

SOOP 라이브 원본 스트림을 디스크에 무손실로 저장하는 유저스크립트입니다.

- **제작자**: Yayo
- **저장소**: [https://github.com/yayokorea/soop-all-record](https://github.com/yayokorea/soop-all-record)
- **라이선스**: MIT

---

## ✨ 주요 기능

1. **무손실 원본 저장**: 재인코딩 없이 원본 그대로 저장
2. **실시간 디스크 기록**: 메모리 누수 없이 안정적인 녹화
3. **화질 변경/재연결 대응**: 방송 환경 변화 시 파트별 자동 분할 저장
4. **병합 스크립트 생성**: 배치(.bat) 파일로 손쉬운 무손실 MP4 병합
5. **모니터링 대시보드**: 녹화 상태 및 청크 현황 실시간 확인

---

## 🚀 개발 및 빌드

```bash
# 의존성 설치
npm install

# 개발 모드 (Live Reload)
npm run dev

# 배포용 번들 빌드
npm run build
```

빌드가 완료되면 `dist/soop-all-record.user.js` 파일이 생성됩니다.
