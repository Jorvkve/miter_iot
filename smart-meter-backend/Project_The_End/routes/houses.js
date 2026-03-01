const express = require("express");
const router = express.Router();
const db = require("../db");

/* ===== Add House ===== */
router.post("/", (req, res) => {

  const { house_name, owner_name, address, phone } = req.body;

  if (!house_name) {
    return res.status(400).json({
      error: "house_name required"
    });
  }

  const sql = `
    INSERT INTO houses
    (house_name, owner_name, address, phone)
    VALUES (?, ?, ?, ?)
  `;

  db.query(
    sql,
    [house_name, owner_name, address, phone],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          error: "Insert failed"
        });
      }

      res.json({
        message: "House added successfully",
        house_id: result.insertId
      });
    }
  );
});



/* ===== GET ALL HOUSES ===== */
router.get("/", (req, res) => {

  const sql = "SELECT * FROM houses";

  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        error: "Database error"
      });
    }

    res.json(result);
  });

});



/* ===== Delete House ===== */
router.delete("/:id", (req, res) => {

  const sql =
    "UPDATE houses SET is_active = 0 WHERE id=?";

  db.query(sql, [req.params.id], err => {

    if (err)
      return res.status(500).json(err);

    res.json({ message: "House disabled" });

  });
});

/* ===============================
   TOGGLE HOUSE ACTIVE
=============================== */
router.put("/toggle/:id", (req, res) => {

  const id = req.params.id;

  const sql = `
    UPDATE houses
    SET is_active =
      CASE
        WHEN is_active = 1 THEN 0
        ELSE 1
      END
    WHERE id = ?
  `;

  db.query(sql, [id], (err) => {

    if (err) {
      console.error(err);
      return res.status(500).json({
        error: "Toggle failed"
      });
    }

    res.json({
      message: "House status updated"
    });

  });

});

/* ===============================
   UPDATE HOUSE
=============================== */
router.put("/:id", (req, res) => {

  const { house_name, owner_name, address, phone } = req.body;

  const sql = `
    UPDATE houses
    SET
      house_name=?,
      owner_name=?,
      address=?,
      phone=?
    WHERE id=?
  `;

  db.query(
    sql,
    [
      house_name,
      owner_name,
      address,
      phone,
      req.params.id
    ],
    (err, result) => {

      if (err) {
        console.error(err);
        return res.status(500).json(err);
      }

      res.json({
        message: "House updated ✅"
      });
    }
  );

});

module.exports = router;