import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";


import fs from "fs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    {
      name: 'serve-excel-files',
      configureServer(server) {
        server.middlewares.use("/files", (req, res, next) => {
          if (!req.url) return next();

          // Parse URL and remove query string
          const urlPath = req.url.split('?')[0];
          const cleanPath = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath;
          const filePath = path.join(__dirname, "File di origine", cleanPath);

          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            // Set proper content type for Excel files
            const ext = path.extname(filePath).toLowerCase();
            if (ext === '.xlsx') {
              res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            } else if (ext === '.xls') {
              res.setHeader("Content-Type", "application/vnd.ms-excel");
            } else {
              res.setHeader("Content-Type", "application/octet-stream");
            }
            res.setHeader("Cache-Control", "no-cache");
            fs.createReadStream(filePath).pipe(res);
          } else {
            // Return 404 instead of passing to next middleware
            res.statusCode = 404;
            res.end('File not found');
          }
        });
      }
    }
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
