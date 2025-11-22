const express = require('express');
const multer = require('multer');
const tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// ตั้งค่า Express
const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('image'), (req, res) => {
  const imagePath = req.file.path;

  // ใช้ sharp ในการประมวลผลภาพก่อนส่งให้ OCR
  sharp(imagePath)
    .grayscale()
    .normalize()
    .threshold(150)
    .toFile('processed/' + req.file.filename, (err, info) => {
      if (err) {
        return res.status(500).send('Error processing image');
      }

      // ใช้ Tesseract.js เพื่อแปลงภาพเป็นข้อความ
      tesseract.recognize(
        'processed/' + req.file.filename,
        'eng',
        { logger: (m) => console.log(m) }
      ).then(({ data: { text } }) => {
        console.log('Recognized text:', text);
        // ส่งกลับข้อความที่ได้จาก OCR
        res.send({ text: text });
      });
    });
});

// เริ่มต้น Server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
