import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import cesium from 'vite-plugin-cesium';
import { resolve } from 'path';
var rootDir = resolve(__dirname, '../..');
export default defineConfig({
    base: '/front/',
    plugins: [
        vue(),
        cesium({
            cesiumBuildRootPath: resolve(rootDir, 'node_modules/cesium/Build'),
            cesiumBuildPath: resolve(rootDir, 'node_modules/cesium/Build/Cesium/'),
        }),
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    server: {
        host: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
            output: {
                manualChunks: {
                    cesium: ['cesium'],
                    vue: ['vue', 'vue-router', 'pinia'],
                },
            },
        },
    },
});
