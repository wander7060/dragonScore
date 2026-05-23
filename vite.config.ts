import { defineConfig } from 'vite';
import plugin from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    base: "/dragonScore/",
    plugins: [plugin()],
    server: {
        port: 11039,
    }
})
