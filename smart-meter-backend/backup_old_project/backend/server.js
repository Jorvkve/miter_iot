// ==================== Import Modules ====================
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mysql = require("mysql2");
const Tesseract = require("tesseract.js");
const sharp = require("sharp");

// ==================== Initialize App ====================
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// ==================== Database Connection ====================
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "smart_meter_db",
});

db.connect((err) => {
  if (err) {
    console.error("เชื่อมต่อ Database ไม่สำเร็จ:", err);
    return;
  }
  console.log("เชื่อมต่อ MySQL Database สำเร็จแล้ว! 🗄️");
});

// ==================== Multer Setup (File Upload) ====================
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});
const upload = multer({ storage: storage });

// ==================== Utility Functions ====================
function extractNumberFromText(text) {
  if (!text) return null;
  let clean = text.toUpperCase().trim();
  const replacements = {
    E: "3", F: "3", Z: "3", R: "3", S: "5", $: "5", O: "0", D: "0", Q: "0",
    U: "0", I: "1", L: "1", "|": "1", A: "4", X: "4", G: "6", C: "6", b: "6",
    T: "7", Y: "7", J: "7", "?": "7", B: "8", "&": "8",
  };
  for (const [key, value] of Object.entries(replacements)) {
    clean = clean.split(key).join(value);
  }
  clean = clean.replace(/[^0-9]/g, "");
  console.log(`🧹 แปลงข้อความ: "${text.trim()}" -> "${clean}"`);
  return clean === "" ? null : clean;
}

async function cropImage(inputPath, outputPath, cropOptions) {
  try {
    console.log("--- เริ่มต้นกระบวนการตัดภาพ ---");
    console.log(`📂 ไฟล์ต้นฉบับ: ${inputPath}`);
    console.log(`✂️ ค่าที่จะตัด (Crop Options):`, cropOptions);
    const metadata = await sharp(inputPath).metadata();
    console.log(
      `📏 ขนาดภาพเดิม: กว้าง ${metadata.width} x สูง ${metadata.height}`,
    );
    if (
      cropOptions.left + cropOptions.width > metadata.width ||
      cropOptions.top + cropOptions.height > metadata.height
    ) {
      console.error(
        "❌ Error: ค่า Crop เกินขนาดภาพจริง! โปรแกรมอาจจะไม่ตัดภาพให้",
      );
    }
    await sharp(inputPath)
      .extract(cropOptions)
      .resize({
        width: cropOptions.width * 3,
        kernel: sharp.kernel.lanczos3,
      })
      .grayscale()
      .normalise()
      .gamma(1.1)
      .linear(1.9, -30)
      .sharpen({ sigma: 1.5 })
      .toFile(outputPath);
    console.log(`✅ ตัดภาพสำเร็จ! บันทึกไว้ที่: ${outputPath}`);
    console.log("-----------------------------------");
  } catch (error) {
    console.error("🔥 เกิดข้อผิดพลาดรุนแรงในการตัดภาพ:", error);
    throw error;
  }
}

// ==================== Routes ====================

// --- Root Route ---
app.get("/", (req, res) => res.send("Smart Meter Backend พร้อมใช้งาน 🚀"));

// --- Upload & OCR Route ---
app.post("/api/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "กรุณาอัปโหลดไฟล์ภาพ" });

    const houseId = req.body.house_id || 1;
    const originalFilename = req.file.filename;
    const originalImagePath = path.join(__dirname, "uploads", originalFilename);

    console.log(`📥 ได้รับภาพ: ${originalFilename}`);

    const metadata = await sharp(originalImagePath).metadata();
    console.log(`📏 ขนาดภาพจริง: ${metadata.width} x ${metadata.height}`);

    const targetCrop = { left: 178, top: 248, width: 145, height: 52 };
    let finalImagePath = originalImagePath;
    let isCropped = false;

    const croppedFilename = `cropped-${originalFilename}`;
    const croppedImagePath = path.join(__dirname, "uploads", croppedFilename);

    await cropImage(originalImagePath, croppedImagePath, targetCrop);
    finalImagePath = croppedImagePath;
    isCropped = true;

    console.log(
      `📖 กำลังอ่านค่า OCR จากไฟล์: ${isCropped ? "ภาพที่ตัดแล้ว" : "ภาพต้นฉบับ"} ...`,
    );

    const {
      data: { text },
    } = await Tesseract.recognize(finalImagePath, "eng", {
      tessedit_char_whitelist: "0123456789",
      tessedit_pageseg_mode: 7,
      preserve_interword_spaces: 0,
    });

    console.log(`📝 ข้อความดิบ: ${text.trim()}`);
    let readingValue = extractNumberFromText(text);

    if (readingValue) {
      const match = readingValue.match(/\d{5}/);
      if (match) {
        readingValue = match[0];
      }
    }

    if (!readingValue || readingValue.length !== 5) {
      console.warn("❌ อ่านค่าไม่ครบ 5 หลัก — ข้ามการบันทึก");
      return res.status(400).json({ error: "OCR ไม่สมบูรณ์" });
    }

    const sql =
      "INSERT INTO meter_readings (house_id, reading_value, image_filename) VALUES (?, ?, ?)";
    db.query(sql, [houseId, readingValue, originalFilename], (err, result) => {
      if (err) {
        console.error("Database Error:", err);
        return res.status(500).json({ error: "Database Insert Failed" });
      }
      console.log(`✅ บันทึกสำเร็จ! ID: ${result.insertId}`);
      res.json({
        message: "บันทึกข้อมูลสำเร็จ",
        data: {
          id: result.insertId,
          value: readingValue,
          original_size: `${metadata.width}x${metadata.height}`,
          cropped: isCropped,
        },
      });
    });
  } catch (error) {
    console.error("🔥 Server Error:", error);
    res
      .status(500)
      .json({ error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์: " + error.message });
  }
});

// --- Add House Route ---
app.post("/api/houses", (req, res) => {
  const { house_name, owner_name, address, phone } = req.body;
  const sql =
    "INSERT INTO houses (house_name, owner_name, address, phone) VALUES (?, ?, ?, ?)";
  db.query(
    sql,
    [house_name, owner_name, address, phone],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Insert failed" });
      }
      res.json({
        message: "เพิ่มบ้านสำเร็จ",
        id: result.insertId,
      });
    }
  );
});


// --- Get Houses Route ---
app.get("/api/houses", (req, res) => {
  const sql = "SELECT * FROM houses ORDER BY id ASC";
  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "โหลดบ้านไม่สำเร็จ" });
    }
    res.json(results);
  });
});

// ===== Get Meter Readings =====
app.get("/api/readings", (req, res) => {
  const sql = `
    SELECT
      m.id,
      h.house_name,
      m.reading_value,
      m.reading_time
    FROM meter_readings m
    JOIN houses h ON m.house_id = h.id
    ORDER BY m.reading_time DESC
  `;
  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        error: "โหลดข้อมูลมิเตอร์ไม่สำเร็จ"
      });
    }
    res.json(result);
  });
});

// --- Get Meter Readings By House Route ---
app.get("/api/readings/:houseId", (req, res) => {
  const houseId = req.params.houseId;
  const sql = `
    SELECT meter_readings.*, houses.house_name
    FROM meter_readings
    JOIN houses ON meter_readings.house_id = houses.id
    WHERE meter_readings.house_id = ?
    ORDER BY meter_readings.reading_time DESC
    LIMIT 50
  `;
  db.query(sql, [houseId], (err, results) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ error: "ดึงข้อมูลไม่สำเร็จ" });
    }
    res.json(results);
  });
});

// --- Get Monthly Readings (All Houses) Route ---
app.get("/api/monthly-readings", (req, res) => {
  const sql = `
    SELECT 
      DATE_FORMAT(reading_time, '%Y-%m') as month,
      house_id,
      houses.house_name,
      COUNT(*) as count,
      AVG(CAST(reading_value AS DECIMAL)) as avg_value,
      MAX(CAST(reading_value AS DECIMAL)) as max_value,
      MIN(CAST(reading_value AS DECIMAL)) as min_value
    FROM meter_readings
    JOIN houses ON meter_readings.house_id = houses.id
    GROUP BY DATE_FORMAT(reading_time, '%Y-%m'), house_id, houses.house_name
    ORDER BY month DESC
    LIMIT 36
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ error: "ดึงข้อมูลรายเดือนไม่สำเร็จ" });
    }
    res.json(results);
  });
});


// --- Get Monthly Readings By House Route ---
app.get("/api/monthly-readings/:houseId", (req, res) => {
  const houseId = req.params.houseId;
  const sql = `
    SELECT 
      DATE_FORMAT(reading_time, '%Y-%m') as month,
      house_id,
      houses.house_name,
      COUNT(*) as count,
      AVG(CAST(reading_value AS DECIMAL)) as avg_value,
      MAX(CAST(reading_value AS DECIMAL)) as max_value,
      MIN(CAST(reading_value AS DECIMAL)) as min_value
    FROM meter_readings
    JOIN houses ON meter_readings.house_id = houses.id
    WHERE meter_readings.house_id = ?
    GROUP BY DATE_FORMAT(reading_time, '%Y-%m'), house_id, houses.house_name
    ORDER BY month DESC
    LIMIT 24
  `;
  db.query(sql, [houseId], (err, results) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ error: "ดึงข้อมูลรายเดือนไม่สำเร็จ" });
    }
    res.json(results);
  });
});

// ===== Monthly Usage By House =====
app.get("/api/monthly-by-house", (req, res) => {
  const sql = `
    SELECT 
      DATE_FORMAT(r.reading_time,'%Y-%m') AS month,
      h.house_name,
      MAX(r.reading_value) - MIN(r.reading_value) AS total_unit
    FROM meter_readings r
    JOIN houses h ON r.house_id = h.id
    GROUP BY month, h.house_name
    ORDER BY month ASC
  `;
  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json(err);
    }
    res.json(result);
  });
});

// ===== Monthly Summary API =====
app.get("/api/monthly-summary", (req, res) => {

  const sql = `
  SELECT
      DATE_FORMAT(reading_time, '%m/%Y') AS month,
      SUM(CAST(reading_value AS UNSIGNED)) AS total_unit
  FROM meter_readings
  GROUP BY month
  ORDER BY reading_time DESC
  LIMIT 6
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        error: "โหลดข้อมูลรายเดือนไม่สำเร็จ"
      });
    }

    res.json(result);
  });

});

// --- Delete Meter Reading Route ---
app.delete("/api/readings/:id", (req, res) => {
  const id = req.params.id;

  db.query(
    "DELETE FROM meter_readings WHERE id = ?",
    [id],
    (err) => {
      if (err)
        return res.status(500).json({ error: "ลบไม่สำเร็จ" });

      res.json({ message: "ลบข้อมูลแล้ว" });
    }
  );
});

// ================= DELETE HOUSE =================
app.delete("/api/houses/:id", (req, res) => {

  const houseId = req.params.id;

  const sql = "DELETE FROM houses WHERE id = ?";

  db.query(sql, [houseId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        error: "ลบบ้านไม่สำเร็จ",
      });
    }

    res.json({
      message: "ลบบ้านสำเร็จ",
    });
  });
});

// --- Serve Uploaded Images ---
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ==================== Start Server ====================
app.listen(port, () =>
  console.log(`Backend รันอยู่ที่ http://localhost:${port}`),
);