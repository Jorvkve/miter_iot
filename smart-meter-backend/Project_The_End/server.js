const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

/* ===== MIDDLEWARE ===== */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===== STATIC FILES ===== */
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

app.use(
  express.static(path.join(__dirname, "public"))
);

app.use("/html", express.static(path.join(__dirname, "public/html")));

/* ===== API ROUTES ===== */
app.use("/api/houses", require("./routes/houses"));
app.use("/api/readings", require("./routes/readings"));
app.use("/api/upload", require("./routes/upload"));

/* ===== WEB PAGES ===== */

// หน้าแรก (menu หลัก)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/html/index.html"));
});

// Daily Dashboard
app.get("/daily", (req, res) => {
  res.sendFile(path.join(__dirname, "public/html/daily.html"));
});

// Monthly Dashboard
app.get("/monthly", (req, res) => {
  res.sendFile(path.join(__dirname, "public/html/monthly.html"));
});

// Admin Page
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public/html/admin.html"));
});

/* ===== SERVER ===== */
const PORT = 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running http://localhost:${PORT}`);
});