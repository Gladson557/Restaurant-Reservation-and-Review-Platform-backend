import multer from "multer";
import path from "path";

// Storage config
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, "uploads/reviews/"); // save to uploads/reviews
  },
  filename(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// Filter only images
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") {
    return cb(new Error("Only images allowed"), false);
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter });
export default upload;
