const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2'); // --- ใหม่: เรียกใช้ mysql2 ---
const Tesseract = require('tesseract.js'); // --- ใหม่: เรียกใช้ tesseract.js ---
const sharp = require('sharp'); // --- ใหม่: เรียกใช้ sharp ---

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// --- ใหม่: ตั้งค่าการเชื่อมต่อฐานข้อมูล ---
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // Username ปกติของ XAMPP คือ root
    password: '',      // Password ปกติของ XAMPP คือว่างไว้
    database: 'smart_meter_db' // ชื่อ Database ที่เราเพิ่งสร้าง
});

// --- ใหม่: เชื่อมต่อฐานข้อมูล ---
db.connect((err) => {
    if (err) {
        console.error('เชื่อมต่อ Database ไม่สำเร็จ:', err);
        return;
    }
    console.log('เชื่อมต่อ MySQL Database สำเร็จแล้ว! 🗄️');
});

// ... (ส่วนตั้งค่า multer เหมือนเดิม) ...
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.get('/', (req, res) => res.send('Smart Meter Backend พร้อมใช้งาน 🚀'));

// --- ฟังก์ชันช่วยกรองและแก้ไขตัวเลข (เวอร์ชันเก็บเป็น String) ---
function extractNumberFromText(text) {
    if (!text) return null;

    // 1. แปลงตัวอักษรที่คล้ายเลข 0 ให้เป็นเลข 0
    let cleanedText = text.replace(/o/gi, '0')
                          .replace(/a/gi, '0')
                          .replace(/l/gi, '1')
                          .replace(/i/gi, '1');

    // 2. ลบทุกอย่างที่ไม่ใช่ตัวเลขและจุดทศนิยมออก
    cleanedText = cleanedText.replace(/[^0-9\.]/g, '');

    // 3. ส่งค่ากลับเป็น String เลย (ไม่ต้อง parseFloat)
    // ถ้า cleanedText ว่างเปล่า ให้ส่ง null กลับไป
    return cleanedText === '' ? null : cleanedText;
}

// --- ฟังก์ชันสำหรับตัดภาพ (เวอร์ชัน Debug) ---
async function cropImage(inputPath, outputPath, cropOptions) {
    try {
        console.log('--- เริ่มต้นกระบวนการตัดภาพ ---');
        console.log(`📂 ไฟล์ต้นฉบับ: ${inputPath}`);
        console.log(`✂️ ค่าที่จะตัด (Crop Options):`, cropOptions);

        // 1. ตรวจสอบขนาดภาพต้นฉบับก่อน
        const metadata = await sharp(inputPath).metadata();
        console.log(`📏 ขนาดภาพเดิม: กว้าง ${metadata.width} x สูง ${metadata.height}`);

        // 2. เช็กว่าค่าที่จะตัด มันเกินขนาดภาพจริงไหม
        if (cropOptions.left + cropOptions.width > metadata.width ||
            cropOptions.top + cropOptions.height > metadata.height) {
            console.error('❌ Error: ค่า Crop เกินขนาดภาพจริง! โปรแกรมอาจจะไม่ตัดภาพให้');
        }

        // 3. ทำการตัดภาพ
        await sharp(inputPath)
            .extract(cropOptions)
            .toFile(outputPath);
        
        console.log(`✅ ตัดภาพสำเร็จ! บันทึกไว้ที่: ${outputPath}`);
        console.log('-----------------------------------');

    } catch (error) {
        console.error('🔥 เกิดข้อผิดพลาดรุนแรงในการตัดภาพ:', error);
        throw error; // ส่ง error กลับไปให้ฟังก์ชันหลักรับรู้
    }
}

// --- แก้ไขเฉพาะส่วน app.post('/api/upload', ...) ---

app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'กรุณาอัปโหลดไฟล์ภาพ' });

        const houseId = req.body.house_id || 1;
        const originalFilename = req.file.filename;
        const originalImagePath = path.join(__dirname, 'uploads', originalFilename);

        console.log(`📥 ได้รับภาพ: ${originalFilename}`);

        // --- 1. เช็กขนาดภาพก่อนตัด ---
        const metadata = await sharp(originalImagePath).metadata();
        console.log(`📏 ขนาดภาพจริง: ${metadata.width} x ${metadata.height}`);

        // กำหนดพิกัด Crop ที่ต้องการ (ค่าเดิมของเรา)
        const targetCrop = {
            left: 650,
            top: 400,
            width: 500,
            height: 150
        };

        let finalImagePath = originalImagePath; // เริ่มต้นใช้ภาพเดิม
        let isCropped = false;

        // เช็กว่าตัดได้ไหม? (ภาพต้องใหญ่กว่าพื้นที่ที่จะตัด)
        if (metadata.width >= (targetCrop.left + targetCrop.width) && 
            metadata.height >= (targetCrop.top + targetCrop.height)) {
            
            // ถ้าภาพใหญ่พอ -> ให้ทำการ Crop
            const croppedFilename = `cropped-${originalFilename}`;
            const croppedImagePath = path.join(__dirname, 'uploads', croppedFilename);
            
            await cropImage(originalImagePath, croppedImagePath, targetCrop);
            finalImagePath = croppedImagePath; // เปลี่ยนไปใช้ภาพที่ตัดแล้ว
            isCropped = true;
            console.log("✂️ ตัดภาพสำเร็จ!");

        } else {
            // ถ้าภาพเล็กเกินไป -> ข้ามการ Crop
            console.warn("⚠️ ภาพเล็กเกินไปสำหรับการ Crop (ข้ามขั้นตอนการตัดภาพ)");
            // หมายเหตุ: ถ้าไม่ Crop เราอาจจะอ่าน OCR ไม่ได้แม่นยำ แต่ระบบจะไม่พัง
        }

        // --- 2. ทำ OCR (กับภาพ Final) ---
        console.log(`📖 กำลังอ่านค่า OCR จากไฟล์: ${isCropped ? 'ภาพที่ตัดแล้ว' : 'ภาพต้นฉบับ'} ...`);
        
        const { data: { text } } = await Tesseract.recognize(
            finalImagePath,
            'eng',
            { logger: m => {} } // ปิด log รกๆ
        );

        console.log(`📝 ข้อความดิบ: ${text.trim()}`);
        let readingValue = extractNumberFromText(text); // แปลงเป็น "00066" หรือ null

        // --- 3. บันทึกลง Database ---
        const sql = 'INSERT INTO meter_readings (house_id, reading_value, image_filename) VALUES (?, ?, ?)';
        db.query(sql, [houseId, readingValue, originalFilename], (err, result) => {
            if (err) {
                console.error('Database Error:', err);
                return res.status(500).json({ error: 'Database Insert Failed' });
            }

            console.log(`✅ บันทึกสำเร็จ! ID: ${result.insertId}`);
            res.json({
                message: 'บันทึกข้อมูลสำเร็จ',
                data: {
                    id: result.insertId,
                    value: readingValue,
                    original_size: `${metadata.width}x${metadata.height}`,
                    cropped: isCropped
                }
            });
        });

    } catch (error) {
        console.error('🔥 Server Error:', error); // ดู Error เต็มๆ ที่นี่
        res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์: ' + error.message });
    }
});

// --- API สำหรับดึงข้อมูลการอ่านค่ามิเตอร์ทั้งหมด ---
app.get('/api/readings', (req, res) => {
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
            console.error('Database Error:', err);
            return res.status(500).json({ error: 'ดึงข้อมูลไม่สำเร็จ' });
        }
        res.json(results); // ส่งผลลัพธ์กลับไปเป็น JSON
    });
});

// --- (Optional) API สำหรับเสิร์ฟไฟล์รูปภาพให้หน้าเว็บ ---
// ทำให้หน้าเว็บสามารถเข้าถึงรูปในโฟลเดอร์ 'uploads' ได้ผ่าน URL เช่น http://localhost:3000/uploads/ชื่อไฟล์.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(port, () => console.log(`Backend รันอยู่ที่ http://localhost:${port}`));