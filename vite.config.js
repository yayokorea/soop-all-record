import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    monkey({
      entry: 'src/main.js',
      userscript: {
        name: {
          '': 'SOOP(숲) 라이브 무손실 원본 녹화기',
          en: 'SOOP Live Lossless Original Stream Recorder',
          ja: 'SOOP（スプ）ライブ無劣化オリジナル録画ツール',
          'zh-TW': 'SOOP 直播無損原始串流錄製器',
          'zh-CN': 'SOOP 直播无损原始流录制器',
          th: 'เครื่องบันทึกไลฟ์ SOOP แบบต้นฉบับไม่สูญเสียคุณภาพ',
          vi: 'Trình ghi livestream SOOP nguyên bản không mất chất lượng',
          id: 'Perekam Live SOOP Lossless dari Stream Asli',
        },
        namespace: 'https://github.com/yayokorea/soop-all-record',
        version: pkg.version,
        description: {
          '': 'SOOP 라이브 스트림을 재인코딩 없이 원본 그대로 디스크에 저장하는 녹화기',
          en: 'Records SOOP live streams directly to disk without re-encoding, preserving the original stream quality.',
          ja: 'SOOPのライブストリームを再エンコードせず、元の品質のままディスクへ直接保存します。',
          'zh-TW': '將 SOOP 直播串流直接儲存到磁碟，不重新編碼並保留原始畫質。',
          'zh-CN': '将 SOOP 直播流直接保存到磁盘，无需重新编码并保留原始画质。',
          th: 'บันทึกไลฟ์สตรีม SOOP ลงดิสก์โดยตรงโดยไม่เข้ารหัสใหม่ และคงคุณภาพของสตรีมต้นฉบับไว้',
          vi: 'Ghi trực tiếp livestream SOOP vào ổ đĩa mà không mã hóa lại, giữ nguyên chất lượng luồng gốc.',
          id: 'Merekam live stream SOOP langsung ke disk tanpa re-encoding dan mempertahankan kualitas stream asli.',
        },
        author: 'Yayo',
        match: ['https://play.sooplive.com/*'],
        icon: 'https://res.sooplive.com/afreeca.ico',
        homepageURL: 'https://github.com/yayokorea/soop-all-record',
        supportURL: 'https://github.com/yayokorea/soop-all-record/issues',
        license: 'MIT',
        'run-at': 'document-start',
        grant: ['unsafeWindow'],
        noframes: true,
      },
      build: {
        fileName: 'soop-all-record.user.js',
      },
    }),
  ],
});
