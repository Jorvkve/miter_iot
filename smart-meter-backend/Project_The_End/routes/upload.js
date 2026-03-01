const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

// ===== Storage =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName =
      "meter_" + Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// ===== Upload Image Only =====
router.post("/", upload.single("image"), (req, res) => {

  if (!req.file) {
    return res.status(400).json({
      error: "No image uploaded"
    });
  }

  const house_id = req.body.house_id || null;

  res.json({
    message: "Upload success",
    filename: req.file.filename,
    house_id
  });
});

module.exports = router;