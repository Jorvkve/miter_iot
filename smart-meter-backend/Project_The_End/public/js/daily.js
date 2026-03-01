// ===============================
// INIT DASHBOARD
// ===============================
window.addEventListener("load", initDashboard);

async function initDashboard() {
  console.log("Dashboard Started ✅");

  await loadHouses();
  await loadLatestReadings();
  await loadTotalUsageChart();
}

// ===============================
// LOAD HOUSES
// ===============================
async function loadHouses() {
  const res = await fetch("http://localhost:3000/api/houses");

  const houses = await res.json();

  const container = document.getElementById("houseCards");

  if (!container) return;

  container.innerHTML = "";

  houses.forEach((house) => {

    const statusBadge =
      house.is_active == 1
        ? `<span class="badge bg-success">เปิดใช้งาน</span>`
        : `<span class="badge bg-secondary">ปิดใช้งาน</span>`;
    container.innerHTML += `
      <div class="col-md-4 mb-3">
        <div class="card shadow-sm">

        <div class="card-header"
        ${house.is_active ? "bg-success": "bg-secondary"}
        text-white>

        🏠 ${house.house_name}
        ${statusBadge}
        </div>

          <div class="card-body">
            <p><b>เจ้าของ:</b> ${house.owner_name ?? "-"}</p>
            <p><b>โทร:</b> ${house.phone ?? "-"}</p>
            <p class="text-muted">
              กำลังโหลดข้อมูลมิเตอร์...
            </p>
          </div>

        </div>
      </div>
    `;
  });
}

// ===============================
// TODAY CHART
// ===============================
async function loadTotalUsageChart() {
  try {
    const res = await fetch("http://localhost:3000/api/readings/latest");

    const data = await res.json();

    const canvas = document.getElementById("totalUsageChart");

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // ✅ ชื่อบ้าน
    const labels = data.map((d) => d.house_name);

    // ✅ หน่วยล่าสุด
    const values = data.map((d) => Number(d.reading_value) || 0);

    const colors = [
      "#3498db",
      "#2ecc71",
      "#e74c3c",
      "#f39c12",
      "#9b59b6",
      "#1abc9c",
    ];

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "หน่วยไฟล่าสุด (kWh)",
            data: values,
            backgroundColor: colors,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
          },
        },
      },
    });
  } catch (err) {
    console.error("Chart Error:", err);
  }
}

// ===============================
// LATEST READINGS
// ===============================
async function loadLatestReadings() {
  const res = await fetch("http://localhost:3000/api/readings/latest");

  const data = await res.json();

  const cards = document.querySelectorAll("#houseCards .card");

  data.forEach((reading, index) => {
    if (!cards[index]) return;

    const body = cards[index].querySelector(".card-body");

    if (!reading.reading_value) {
      body.innerHTML = "ยังไม่มีข้อมูลมิเตอร์";
      return;
    }

    body.innerHTML = `
      <p><b>หน่วยล่าสุด:</b>
      ${reading.reading_value} หน่วย</p>

      <p><b>เวลา:</b>
      ${new Date(reading.reading_time).toLocaleString()}</p>

      <img 
        src="/uploads/${reading.image_filename}" 
        class="img-fluid rounded mt-2"
      />
    `;
  });
}
