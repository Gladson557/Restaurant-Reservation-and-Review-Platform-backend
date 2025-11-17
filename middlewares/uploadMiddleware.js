// middlewares/uploadMiddleware.js
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadsRoot = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsRoot)) fs.mkdirSync(uploadsRoot, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    // Create context-specific folders (restaurants, reviews, general)
    let dest = path.join(uploadsRoot, "general");
    try {
      const baseUrl = req.baseUrl || "";
      if (baseUrl.includes("/restaurants")) dest = path.join(uploadsRoot, "restaurants");
      else if (baseUrl.includes("/reviews")) dest = path.join(uploadsRoot, "reviews");
    } catch {}
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) {
    return cb(new Error("Only image files are allowed"), false);
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
