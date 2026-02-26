const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mysql = require("mysql2"); // --- ใหม่: เรียกใช้ mysql2 ---
const Tesseract = require("tesseract.js"); // --- ใหม่: เรียกใช้ tesseract.js ---
const sharp = require("sharp"); // --- ใหม่: เรียกใช้ sharp ---

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// --- ใหม่: ตั้งค่าการเชื่อมต่อฐานข้อมูล ---
const db = mysql.createConnection({
  host: "localhost",
  user: "root", // Username ปกติของ XAMPP คือ root
  password: "", // Password ปกติของ XAMPP คือว่างไว้
  database: "smart_meter_db", // ชื่อ Database ที่เราเพิ่งสร้าง
});

// --- ใหม่: เชื่อมต่อฐานข้อมูล ---
db.connect((err) => {
  if (err) {
    console.error("เชื่อมต่อ Database ไม่สำเร็จ:", err);
    return;
  }
  console.log("เชื่อมต่อ MySQL Database สำเร็จแล้ว! 🗄️");
});

// ... (ส่วนตั้งค่า multer เหมือนเดิม) ...
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

app.get("/", (req, res) => res.send("Smart Meter Backend พร้อมใช้งาน 🚀"));

// --- ฟังก์ชันช่วยกรองและแก้ไขตัวเลข (ฉบับอัปเกรด: แก้คำผิด OCR) ---
function extractNumberFromText(text) {
  if (!text) return null;

  let clean = text.toUpperCase().trim();

  // 1. 🗺️ Dictionary แก้คำผิด (จูนมาเพื่อมิเตอร์ของคุณโดยเฉพาะ)
  const replacements = {
    E: "3",
    F: "3",
    Z: "3",
    R: "3", // 🔥 เพิ่ม R เป็น 3
    S: "5",
    $: "5",
    O: "0",
    D: "0",
    Q: "0",
    U: "0",
    I: "1",
    L: "1",
    "|": "1",
    A: "4",
    X: "4",
    G: "6",
    C: "6",
    b: "6",
    T: "7",
    Y: "7",
    J: "7",
    "?": "7",
    B: "8",
    "&": "8",
  };

  // 2. วนลูปแทนที่
  for (const [key, value] of Object.entries(replacements)) {
    clean = clean.split(key).join(value);
  }

  // 3. ลบทุกอย่างที่ไม่ใช่ตัวเลข
  clean = clean.replace(/[^0-9]/g, "");

  // 🔥 บรรทัดนี้สำคัญมาก! ถ้าไม่ขึ้นใน Log แสดงว่าโค้ดยังไม่อัปเดต
  console.log(`🧹 แปลงข้อความ: "${text.trim()}" -> "${clean}"`);

  return clean === "" ? null : clean;
}

// --- ฟังก์ชันสำหรับตัดภาพ (เวอร์ชัน Debug) ---
async function cropImage(inputPath, outputPath, cropOptions) {
  try {
    console.log("--- เริ่มต้นกระบวนการตัดภาพ ---");
    console.log(`📂 ไฟล์ต้นฉบับ: ${inputPath}`);
    console.log(`✂️ ค่าที่จะตัด (Crop Options):`, cropOptions);

    // 1. ตรวจสอบขนาดภาพต้นฉบับก่อน
    const metadata = await sharp(inputPath).metadata();
    console.log(
      `📏 ขนาดภาพเดิม: กว้าง ${metadata.width} x สูง ${metadata.height}`,
    );

    // 2. เช็กว่าค่าที่จะตัด มันเกินขนาดภาพจริงไหม
    if (
      cropOptions.left + cropOptions.width > metadata.width ||
      cropOptions.top + cropOptions.height > metadata.height
    ) {
      console.error(
        "❌ Error: ค่า Crop เกินขนาดภาพจริง! โปรแกรมอาจจะไม่ตัดภาพให้",
      );
    }

    // 3. ปรับแต่งภาพ (สูตร: Zoom 2x + เติมขอบขาวกันตก)
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
    throw error; // ส่ง error กลับไปให้ฟังก์ชันหลักรับรู้
  }
}

// --- แก้ไขเฉพาะส่วน app.post('/api/upload', ...) ---

app.post("/api/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "กรุณาอัปโหลดไฟล์ภาพ" });

    const houseId = req.body.house_id || 1;
    const originalFilename = req.file.filename;
    const originalImagePath = path.join(__dirname, "uploads", originalFilename);

    console.log(`📥 ได้รับภาพ: ${originalFilename}`);

<<<<<<< HEAD
    // --- 1. เช็กขนาดภาพก่อนตัด ---
    const metadata = await sharp(originalImagePath).metadata();
    console.log(`📏 ขนาดภาพจริง: ${metadata.width} x ${metadata.height}`);

    // กำหนดพิกัด Crop ที่ต้องการ (ค่าเดิมของเรา)
    const targetCrop = {
      left: 178,
      top: 248,
      width: 145,
      height: 52,
    };

    let finalImagePath = originalImagePath; // เริ่มต้นใช้ภาพเดิม
    let isCropped = false;

    // ทำการ Crop ทันที
    const croppedFilename = `cropped-${originalFilename}`;
    const croppedImagePath = path.join(__dirname, "uploads", croppedFilename);

    await cropImage(originalImagePath, croppedImagePath, targetCrop);
    finalImagePath = croppedImagePath;
    isCropped = true;

    // --- 2. ทำ OCR (กับภาพ Final) ---
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

    // 🔥 หาเลข 5 หลักที่ติดกันจริง ๆ
    if (readingValue) {
      const match = readingValue.match(/\d{5}/);
      if (match) {
        readingValue = match[0];
      }
=======
        // --- 1. เช็กขนาดภาพ ---
        const metadata = await sharp(originalImagePath).metadata();
        console.log(`📏 ขนาดภาพจริง: ${metadata.width} x ${metadata.height}`);

        // 🔥 ใช้ค่าพิกัดที่คุณหามา (Fixed Crop) แม่นยำที่สุดสำหรับ Demo
        const targetCrop = {
            left: 177,  // Position X
            top: 337,   // Position Y
            width: 436, // Width
            height: 122 // Height
        };

        let finalImagePath = originalImagePath;
        let isCropped = false;

        // เช็กว่าตัดได้ไหม (กัน Error กรณีภาพมาเล็กกว่าที่ตั้งไว้)
        if (metadata.width >= (targetCrop.left + targetCrop.width) && 
            metadata.height >= (targetCrop.top + targetCrop.height)) {
            
            const croppedFilename = `cropped-${originalFilename}`;
            const croppedImagePath = path.join(__dirname, 'uploads', croppedFilename);
            
            // เรียกฟังก์ชันตัดภาพ
            await cropImage(originalImagePath, croppedImagePath, targetCrop);
            finalImagePath = croppedImagePath;
            isCropped = true;
            console.log("✂️ ตัดภาพสำเร็จ! (Manual Coordinates)");

        } else {
            console.warn("⚠️ ภาพเล็กเกินไปสำหรับการ Crop (ข้ามขั้นตอนการตัดภาพ)");
        }

        // --- 2. ทำ OCR ---
        console.log(`📖 กำลังอ่านค่า OCR...`);
        
        const { data: { text } } = await Tesseract.recognize(
            finalImagePath,
            'eng',
            { 
                logger: m => {},
                tessedit_char_whitelist: '0123456789', // อ่านเฉพาะตัวเลข
                tessedit_pageseg_mode: '7' // โหมดบรรทัดเดียว
            }
        )

        console.log(`📝 ข้อความดิบ: ${text.trim()}`);
        let readingValue = extractNumberFromText(text); 

        // --- 3. ดักจับค่าขยะ (Validation) ---
        // ถ้าค่าว่าง หรือ ยาวเกิน 7 หลัก หรือ สั้นกว่า 3 หลัก -> ไม่บันทึก
        if (!readingValue || readingValue.length > 7 || readingValue.length < 3) {
            console.log(`❌ ค่าผิดปกติ: "${readingValue}" (Noise/ขยะ) -> ไม่บันทึก`);
            return res.status(400).json({ 
                error: 'Bad Reading', 
                reason: 'ค่าที่อ่านได้ผิดปกติ (Noise)' 
            });
        }

        // --- 4. บันทึกลง Database (ถ้าผ่าน) ---
        const sql = 'INSERT INTO meter_readings (house_id, reading_value, image_filename) VALUES (?, ?, ?)';
        db.query(sql, [houseId, readingValue, originalFilename], (err, result) => {
            if (err) {
                console.error('Database Error:', err);
                return res.status(500).json({ error: 'Database Insert Failed' });
            }

            console.log(`✅ บันทึกสำเร็จ! ID: ${result.insertId} | ค่าที่ได้: ${readingValue}`);
            res.json({
                message: 'บันทึกข้อมูลสำเร็จ',
                data: {
                    id: result.insertId,
                    value: readingValue,
                    cropped: isCropped
                }
            });
        });

    } catch (error) {
        console.error('🔥 Server Error:', error);
        res.status(500).json({ error: error.message });
>>>>>>> 1f1165aee9f4fbc92c6f24c16a98c684f0edd2c7
    }

    // ถ้ายังไม่ได้ 5 หลัก → ไม่บันทึก
    if (!readingValue || readingValue.length !== 5) {
      console.warn("❌ อ่านค่าไม่ครบ 5 หลัก — ข้ามการบันทึก");
      return res.status(400).json({ error: "OCR ไม่สมบูรณ์" });
    }

    // --- 3. บันทึกลง Database ---
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
    console.error("🔥 Server Error:", error); // ดู Error เต็มๆ ที่นี่
    res
      .status(500)
      .json({ error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์: " + error.message });
  }
});

// --- API สำหรับดึงข้อมูลการอ่านค่ามิเตอร์ทั้งหมด ---
app.get("/api/readings", (req, res) => {
  // ดึงข้อมูลล่าสุด 50 รายการ โดยเรียงจากใหม่ไปเก่า
  // JOIN ตาราง houses เพื่อเอาชื่อบ้านมาด้วย
  const sql = `
        SELECT meter_readings.*, houses.house_name
        FROM meter_readings
        JOIN houses ON meter_readings.house_id = houses.id
        ORDER BY meter_readings.reading_time DESC
        LIMIT 50
    `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ error: "ดึงข้อมูลไม่สำเร็จ" });
    }
    res.json(results); // ส่งผลลัพธ์กลับไปเป็น JSON
  });
});

// --- (Optional) API สำหรับเสิร์ฟไฟล์รูปภาพให้หน้าเว็บ ---
// ทำให้หน้าเว็บสามารถเข้าถึงรูปในโฟลเดอร์ 'uploads' ได้ผ่าน URL เช่น http://localhost:3000/uploads/ชื่อไฟล์.jpg
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.listen(port, () =>
  console.log(`Backend รันอยู่ที่ http://localhost:${port}`),
);
