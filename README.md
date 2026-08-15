# SOOP(숲) 라이브 무손실 원본 녹화기

SOOP(아프리카TV) 라이브 스트림의 MSE(MediaSource Extension) 원본 데이터를 File System Access API를 통해 브라우저 메모리 누수 없이 실시간으로 디스크에 저장하는 템퍼몽키 유저스크립트입니다.

- **제작자**: Yayo
- **저장소**: [https://github.com/yayokorea/soop-all-record](https://github.com/yayokorea/soop-all-record)
- **라이선스**: MIT

---

## ✨ 주요 기능

1. **무손실 원본 스트림 캡처**: 재인코딩 없는 원본 비트레이트 그대로 실시간 저장
2. **File System Access API 직결**: 장시간 녹화 시 브라우저 탭 튕김(메모리 부족 현상) 완벽 해결
3. **화질 변경 및 재연결 자동 대응**: 방송 중 화질이 바뀌거나 버퍼링이 생겨도 Part별로 나누어 무결성 유지
4. **무손실 MP4 원클릭 병합 배치 자동 생성**: 녹화 완료 후 `.bat` 파일 실행 한 번으로 최종 MP4 파일 생성
5. **실시간 모니터링 대시보드**: 패킷 조각 누락 및 타임라인 불연속 실시간 감시

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
