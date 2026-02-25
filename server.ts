
import express from "express";
import { createServer as createViteServer } from "vite";
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase limit for base64 images
  app.use(express.json({ limit: '50mb' }));

  // Image saving endpoint
  app.post("/api/save-image", async (req, res) => {
    const { filename, base64Data } = req.body;
    if (!filename || !base64Data) {
      return res.status(400).json({ error: "Missing filename or base64Data" });
    }

    try {
      const buffer = Buffer.from(base64Data, 'base64');
      const dir = path.join(process.cwd(), 'public', 'images');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const filePath = path.join(dir, filename);
      
      // Optimize image if it's a webp file
      if (filename.endsWith('.webp')) {
        await sharp(buffer)
          .webp({ quality: 80 })
          .toFile(filePath);
      } else {
        // Fallback for other formats (though we should use webp)
        fs.writeFileSync(filePath, buffer);
      }
      
      console.log(`Saved optimized image ${filename}`);
      res.json({ success: true });
    } catch (error) {
      console.error(`Error saving ${filename}:`, error);
      res.status(500).json({ error: "Failed to save image" });
    }
  });

  // Convert existing image to WebP
  app.post("/api/convert-to-webp", async (req, res) => {
    const { sourceFilename, targetFilename } = req.body;
    if (!sourceFilename || !targetFilename) {
      return res.status(400).json({ error: "Missing filenames" });
    }

    try {
      const dir = path.join(process.cwd(), 'public', 'images');
      const sourcePath = path.join(dir, sourceFilename);
      const targetPath = path.join(dir, targetFilename);

      if (!fs.existsSync(sourcePath)) {
        return res.status(404).json({ error: "Source file not found" });
      }

      await sharp(sourcePath)
        .webp({ quality: 80 })
        .toFile(targetPath);
      
      console.log(`Converted ${sourceFilename} to ${targetFilename}`);
      res.json({ success: true });
    } catch (error) {
      console.error(`Error converting ${sourceFilename}:`, error);
      res.status(500).json({ error: "Failed to convert image" });
    }
  });

  // Check if image exists and has content
  app.get("/api/check-image/:filename", (req, res) => {
    const filePath = path.join(process.cwd(), 'public', 'images', req.params.filename);
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        res.json({ exists: stats.isFile() && stats.size > 0 });
      } else {
        res.json({ exists: false });
      }
    } catch (e) {
      res.json({ exists: false });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving would go here
    app.use(express.static('dist'));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
