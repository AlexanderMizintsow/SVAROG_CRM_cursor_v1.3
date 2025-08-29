// vite.config.js
import { defineConfig } from "file:///C:/Users/%D0%90%D0%BB%D0%B5%D0%BA%D1%81%D0%B0%D0%BD%D0%B4%D1%80/Desktop/Project/svarog/client/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/%D0%90%D0%BB%D0%B5%D0%BA%D1%81%D0%B0%D0%BD%D0%B4%D1%80/Desktop/Project/svarog/client/node_modules/@vitejs/plugin-react/dist/index.mjs";
import { terser } from "file:///C:/Users/%D0%90%D0%BB%D0%B5%D0%BA%D1%81%D0%B0%D0%BD%D0%B4%D1%80/Desktop/Project/svarog/client/node_modules/rollup-plugin-terser/rollup-plugin-terser.mjs";
var vite_config_default = defineConfig({
  plugins: [react()],
  build: {
    minify: "terser",
    rollupOptions: {
      plugins: [terser()],
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return id.toString().split("node_modules/")[1].split("/")[0].toString();
          }
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxcdTA0MTBcdTA0M0JcdTA0MzVcdTA0M0FcdTA0NDFcdTA0MzBcdTA0M0RcdTA0MzRcdTA0NDBcXFxcRGVza3RvcFxcXFxQcm9qZWN0XFxcXHN2YXJvZ1xcXFxjbGllbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXFx1MDQxMFx1MDQzQlx1MDQzNVx1MDQzQVx1MDQ0MVx1MDQzMFx1MDQzRFx1MDQzNFx1MDQ0MFxcXFxEZXNrdG9wXFxcXFByb2plY3RcXFxcc3Zhcm9nXFxcXGNsaWVudFxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvJUQwJTkwJUQwJUJCJUQwJUI1JUQwJUJBJUQxJTgxJUQwJUIwJUQwJUJEJUQwJUI0JUQxJTgwL0Rlc2t0b3AvUHJvamVjdC9zdmFyb2cvY2xpZW50L3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCB7IHRlcnNlciB9IGZyb20gJ3JvbGx1cC1wbHVnaW4tdGVyc2VyJ1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIGJ1aWxkOiB7XG4gICAgbWluaWZ5OiAndGVyc2VyJyxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBwbHVnaW5zOiBbdGVyc2VyKCldLFxuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rcyhpZCkge1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzJykpIHtcbiAgICAgICAgICAgIHJldHVybiBpZFxuICAgICAgICAgICAgICAudG9TdHJpbmcoKVxuICAgICAgICAgICAgICAuc3BsaXQoJ25vZGVfbW9kdWxlcy8nKVsxXVxuICAgICAgICAgICAgICAuc3BsaXQoJy8nKVswXVxuICAgICAgICAgICAgICAudG9TdHJpbmcoKVxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTZYLFNBQVMsb0JBQW9CO0FBQzFaLE9BQU8sV0FBVztBQUNsQixTQUFTLGNBQWM7QUFFdkIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLGVBQWU7QUFBQSxNQUNiLFNBQVMsQ0FBQyxPQUFPLENBQUM7QUFBQSxNQUNsQixRQUFRO0FBQUEsUUFDTixhQUFhLElBQUk7QUFDZixjQUFJLEdBQUcsU0FBUyxjQUFjLEdBQUc7QUFDL0IsbUJBQU8sR0FDSixTQUFTLEVBQ1QsTUFBTSxlQUFlLEVBQUUsQ0FBQyxFQUN4QixNQUFNLEdBQUcsRUFBRSxDQUFDLEVBQ1osU0FBUztBQUFBLFVBQ2Q7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
