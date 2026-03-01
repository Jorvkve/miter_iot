const express = require("express");
const router = express.Router();
const db = require("../db");

/* GET READINGS */
router.get("/", (req, res) => {

  const sql = `
    SELECT m.*, h.house_name
    FROM meter_readings m
    JOIN houses h ON h.id = m.house_id
    ORDER BY reading_time DESC
  `;

  db.query(sql, (err, result) => {
    res.json(result);
  });
});

/* GET MONTHLY READINGS */
router.get("/monthly", (req, res) => {

const sql = `
SELECT
  h.house_name,
  DATE_FORMAT(m.reading_time,'%m/%Y') AS month,
  MAX(m.reading_value) - MIN(m.reading_value) AS total_unit
FROM meter_readings m
JOIN houses h ON m.house_id = h.id
GROUP BY h.id, month
ORDER BY month
`;

db.query(sql,(err,result)=>{
    if(err) return res.status(500).json(err);
    res.json(result);
});

});

/* DELETE WRONG READING */
router.delete("/:id", (req, res) => {

  db.query(
    "DELETE FROM meter_readings WHERE id=?",
    [req.params.id]
  );

  res.json({ message: "Reading deleted" });
});

/*
==============================
TODAY READINGS (Daily Chart)
==============================
*/
router.get("/today", (req, res) => {

  const sql = `
    SELECT 
      h.house_name,
      DATE_FORMAT(m.reading_time,'%H:%i') AS time,
      m.reading_value
    FROM meter_readings m
    JOIN houses h ON h.id = m.house_id
    WHERE DATE(m.reading_time) = CURDATE()
    ORDER BY m.reading_time ASC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json(err);
    }

    res.json(result);
  });

});

/*
==============================
Monthly Usage By House
==============================
*/
router.get("/monthly-by-house", (req, res) => {

  const sql = `
    SELECT
      h.id AS house_id,
      h.house_name,
      DATE_FORMAT(m.reading_time,'%m/%Y') AS month,
      MAX(m.reading_value) AS total_unit
    FROM meter_readings m
    JOIN houses h ON h.id = m.house_id
    WHERE h.is_active = 1
    GROUP BY h.id, month
    ORDER BY STR_TO_DATE(CONCAT('01/',month),'%d/%m/%Y')
  `;

  db.query(sql, (err, rows) => {

    if (err) {
      console.log(err);
      return res.status(500).json(err);
    }

    // ✅ ส่งข้อมูลตรง ๆ ไม่ต้องคำนวณลบแล้ว
    res.json(rows);

  });

});

// ===== Latest Meter Reading Per House =====
router.get("/latest", (req, res) => {

  const sql = `
    SELECT 
      h.id,
      h.house_name,
      r.reading_value,
      r.image_filename,
      r.reading_time
    FROM houses h
    LEFT JOIN meter_readings r 
      ON r.id = (
        SELECT id 
        FROM meter_readings
        WHERE house_id = h.id
        ORDER BY reading_time DESC
        LIMIT 1
      )
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });

});

// ===== ALL READINGS (ADMIN) =====
router.get("/all", (req, res) => {

  const sql = `
    SELECT 
      m.id,
      h.house_name,
      m.reading_value,
      m.image_filename,
      m.reading_time
    FROM meter_readings m
    JOIN houses h ON h.id = m.house_id
    ORDER BY m.reading_time DESC
  `;

  db.query(sql,(err,result)=>{
    if(err) return res.status(500).json(err);
    res.json(result);
  });

});

module.exports = router;