import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    fs: {
      allow: [
        '/Users/naymyo/Documents/ChatGPT/Nesting',
        '/Users/naymyo/Downloads',
      ],
    },
  },
});
