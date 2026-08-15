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
        description: 'SOOP 라이브 원본 스트림을 디스크에 무손실로 저장합니다.',
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
