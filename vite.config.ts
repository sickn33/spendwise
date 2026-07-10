import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  "script-src-attr 'none'",
  "style-src 'self' https://accounts.google.com/gsi/style",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://accounts.google.com/gsi/ https://gmail.googleapis.com",
  "frame-src https://accounts.google.com/gsi/",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self'",
].join("; ");

// https://vite.dev/config/
export default defineConfig({
  base: "/spendwise/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("chart.js") || id.includes("react-chartjs-2")) return "charts";
          if (id.includes("jspdf")) return "pdf-export";
          if (id.includes("html2canvas") || id.includes("canvg")) return "pdf-render";
          if (id.includes("dompurify")) return "sanitizer";
          if (id.includes("read-excel-file") || id.includes("write-excel-file")) return "spreadsheet";
          if (id.includes("dexie")) return "storage";
          if (id.includes("date-fns")) return "dates";
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react-vendor";
          return undefined;
        },
      },
    },
  },
  plugins: [
    {
      name: "spendwise-production-csp",
      apply: "build",
      transformIndexHtml: {
        order: "pre",
        handler() {
          return [{
            tag: "meta",
            attrs: { "http-equiv": "Content-Security-Policy", content: CONTENT_SECURITY_POLICY },
            injectTo: "head-prepend",
          }];
        },
      },
    },
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "SpendWise - Expense Tracker",
        short_name: "SpendWise",
        description:
          "Personal expense tracking app with automatic categorization",
        lang: "en",
        theme_color: "#0a0a0f",
        background_color: "#0a0a0f",
        display: "standalone",
        orientation: "portrait",
        scope: "/spendwise/",
        start_url: "/spendwise/",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
      },
    }),
  ],
});
