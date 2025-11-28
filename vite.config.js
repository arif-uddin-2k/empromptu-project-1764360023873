import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import eslint from 'vite-plugin-eslint2';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    eslint({
      cache: false,
      include: ['src/**/*.{js,jsx,ts,tsx}', 'app/**/*.{js,jsx,ts,tsx}'],
      exclude: ['node_modules']
    })
  ],
  optimizeDeps: {
    include: ['react', 'react-dom'],
    esbuildOptions: {
      target: 'es2020'
    }
  },
  esbuild: {
    target: 'es2020',
    keepNames: true,
    drop: ['debugger'],
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      maxParallelFileOps: 2,
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        }
      },
      input: {
        main: resolve(__dirname, 'index.html')
      },
      onwarn(warning, warn) {
        const warningMsg = warning.message || warning.toString();
        
        if (warningMsg.includes('Use of eval') && 
            warningMsg.includes('strongly discouraged') && 
            warningMsg.includes('node_modules')) {
          console.warn('Build warning (ignored):', warningMsg);
          return;
        }
        
        const errorsToThrow = [
          'UNRESOLVED_IMPORT',
          'MISSING_EXPORT',
          'PARSE_ERROR'
        ];
        
        if (errorsToThrow.includes(warning.code)) {
          const errorMsg = warning.message || warning.toString();
          const error = new Error(errorMsg);
          error.name = 'BuildWarning';
          throw error;
        }
        
        warn(warning);
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  }
});