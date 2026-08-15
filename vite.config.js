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
        name: 'SOOP(숲) 라이브 무손실 원본 녹화기',
        namespace: 'https://github.com/yayokorea/soop-all-record',
        version: pkg.version,
        description: 'SOOP 라이브 원본 스트림을 File System Access API로 브라우저 메모리 누수 없이 실시간 디스크에 무손실로 저장하고 병합 배치를 생성합니다.',
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
