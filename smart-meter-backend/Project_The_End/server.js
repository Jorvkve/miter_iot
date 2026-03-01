const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

/* ===============================
   MIDDLEWARE
=============================== */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


/* ===============================
   STATIC FILES
=============================== */

// รูปมิเตอร์
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// public folder
app.use(
  express.static(path.join(__dirname, "public"))
);


/* ===============================
   API ROUTES
=============================== */
app.use("/api/houses", require("./routes/houses"));
app.use("/api/readings", require("./routes/readings"));
app.use("/api/upload", require("./routes/upload"));


/* ===============================
   WEB ROUTES (สำคัญมาก)
=============================== */

// Home
app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public/html/index.html")
  );
});

// Daily
app.get("/daily", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public/html/daily.html")
  );
});

// Monthly
app.get("/monthly", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public/html/monthly.html")
  );
});

// Admin
app.get("/admin", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public/html/admin.html")
  );
});


/* ===============================
   รองรับ .html (กันพัง)
=============================== */

app.get("/index.html", (req, res) =>
  res.redirect("/")
);

app.get("/daily.html", (req, res) =>
  res.redirect("/daily")
);

app.get("/monthly.html", (req, res) =>
  res.redirect("/monthly")
);

app.get("/admin.html", (req, res) =>
  res.redirect("/admin")
);


/* ===============================
   SERVER START
=============================== */
const PORT = 3000;

app.listen(PORT, () => {
  console.log("=================================");
  console.log(`✅ Server running`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log("=================================");
});