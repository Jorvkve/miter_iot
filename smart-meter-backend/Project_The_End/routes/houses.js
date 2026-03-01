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

  const id = req.params.id;

  db.query(
    "DELETE FROM houses WHERE id = ?",
    [id],
    (err) => {
      if (err) return res.status(500).json(err);

      res.json({
        message: "House deleted"
      });
    }
  );

});

module.exports = router;