// public/script.js

export let allReadingsData = [];
let monthlyData = [];

// === Fetch Readings From API ===
async function fetchReadings() {
  const res = await fetch("http://localhost:3000/api/readings");
  allReadingsData = await res.json();
}

async function initDashboard() {

  await fetchReadings();
  await fetchMonthlyData();

  updateStats();

  loadMonthlyChart();      // ✅ กราฟรายเดือน
  loadTotalUsageChart();   // ✅ กราฟรวมทุกบ้าน
}

// === ดึงข้อมูลรายเดือน ===
async function fetchMonthlyData() {
  try {
    const response = await fetch("http://localhost:3000/api/monthly-readings");
    monthlyData = await response.json();
  } catch (error) {
    console.error("Error fetching monthly data:", error);
  }
}

// === อัปเดตสถิติการใช้ไฟฟ้า ===
function updateStats() {
  for (let houseId = 1; houseId <= 3; houseId++) {
    const houseData = allReadingsData.filter(
      (item) => item.house_id == houseId,
    );
    if (houseData.length === 0) continue;

    // เรียงข้อมูลตามเวลา (เก่า -> ใหม่)
    houseData.sort(
      (a, b) => new Date(a.reading_time) - new Date(b.reading_time),
    );

    const oldest = parseFloat(houseData[0].reading_value) || 0;
    const latest =
      parseFloat(houseData[houseData.length - 1].reading_value) || 0;
    const usage = latest - oldest;

    // อัปเดต DOM
    document.getElementById(`house${houseId}_latest`).textContent =
      latest.toLocaleString("th-TH");
    document.getElementById(`house${houseId}_oldest`).textContent =
      oldest.toLocaleString("th-TH");
    document.getElementById(`house${houseId}_usage`).textContent =
      Math.max(0, usage).toLocaleString("th-TH") + " หน่วย";
  }
}


// ฟังก์ชันแปลงรูปแบบเดือน เช่น "2026-01" -> "มกราคม 2026"
function formatMonthLabel(monthStr) {
  const months = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  if (!monthStr) return monthStr;
  const [year, month] = monthStr.split("-");
  const monthIndex = parseInt(month) - 1;
  return `${months[monthIndex]} ${parseInt(year)}`;
}


// === อัปเดตตาราง ===
async function updateTable(readings) {
  const tableBody = document.querySelector("#readingsTable tbody");
  tableBody.innerHTML = "";

  if (readings.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="4" class="text-center py-4 text-muted">ยังไม่มีข้อมูล</td></tr>';
    return;
  }

  readings.forEach((reading) => {
    const row = document.createElement("tr");
    const date = new Date(reading.reading_time).toLocaleString("th-TH");

    let badgeColor = "bg-secondary";
    if (reading.house_id == 1) badgeColor = "bg-primary";
    else if (reading.house_id == 2) badgeColor = "bg-success";
    else if (reading.house_id == 3) badgeColor = "bg-danger";

    row.innerHTML = `
            <td class="ps-4 text-secondary fw-bold">${date}</td>
            <td><span class="badge ${badgeColor} badge-house">${reading.house_name || "House " + reading.house_id}</span></td>
            <td><span class="meter-value">${reading.reading_value || "-"}</span></td>
            <td>
                <a href="http://localhost:3000/uploads/${reading.image_filename}" target="_blank">
                    <img src="http://localhost:3000/uploads/cropped-${reading.image_filename}" 
                         class="meter-img" alt="Meter Image"
                         onerror="this.onerror=null;this.src='https://via.placeholder.com/100x60?text=No+Image';">
                </a>
            </td>
        `;
    tableBody.appendChild(row);
  });
}


// ===== Monthly Summary Chart =====
async function loadMonthlyChart() {
  try {
    const res = await fetch("http://localhost:3000/api/monthly-summary");
    const data = await res.json();
    if (!data.length) return;
    const labels = data.map(i => i.month);
    const units = data.map(i => Number(i.total_unit));
    const canvas = document.getElementById("monthlyChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "หน่วยไฟฟ้า",
          data: units,
          backgroundColor: "#5DADE2"
        }]
      }
    });
  } catch (err) {
    console.error("Monthly Chart Error:", err);
  }
}

// ===== Total Usage By House Chart =====
async function loadTotalUsageChart() {
  const res = await fetch("http://localhost:3000/api/monthly-by-house");
  const data = await res.json();
  const months = [...new Set(data.map(d => d.month))];
  const houses = [...new Set(data.map(d => d.house_name))];
  const colors = [
    "#3498db",
    "#2ecc71",
    "#e74c3c",
    "#f39c12",
    "#9b59b6"
  ];
  const datasets = houses.map((house, index) => {
    return {
      label: house,
      backgroundColor: colors[index % colors.length],
      data: months.map(month => {
        const found = data.find(
          d => d.month === month && d.house_name === house
        );
        return found ? Number(found.total_unit) : 0;
      })
    };
  });
  const ctx = document
    .getElementById("totalUsageChart")
    .getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: months,
      datasets
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "top"
        }
      }
    }
  });
}

// --- Load Meter Readings ---
async function loadMeterReadings() {
  const res = await fetch("http://localhost:3000/api/readings");
  const data = await res.json();

  const table = document.querySelector("#deleteDataTable tbody");
  table.innerHTML = "";

  data.forEach((item) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${item.house_name}</td>
      <td>${item.reading_value}</td>
      <td>${new Date(item.reading_time).toLocaleString()}</td>
      <td>
        <button class="btn btn-danger btn-sm"
          onclick="deleteReading(${item.id})">
          🗑
        </button>
      </td>
    `;

    table.appendChild(row);
  });
}

// --- Delete Meter Reading Function ---
async function deleteReading(id) {
  if (!confirm("ลบข้อมูลนี้?")) return;

  await fetch(`http://localhost:3000/api/readings/${id}`, {
    method: "DELETE",
  });

}

// ================= LOAD HOUSES =================
window.LoadHouses = async function () {

  const res = await fetch("http://localhost:3000/api/houses");
  const houses = await res.json();

  const container = document.getElementById("housesContainer");
  container.innerHTML = "";

  houses.forEach((house) => {

    const card = document.createElement("div");
    card.className = "col-md-4 mb-4";

    card.innerHTML = `
      <div class="card shadow-sm position-relative">

        <button 
          class="btn btn-danger btn-sm position-absolute top-0 end-0 m-2"
          onclick="deleteHouse(${house.id})">
          🗑
        </button>

        <div class="card-body">
          <h5>🏠 บ้าน ${house.house_name}</h5>

          <p><strong>เจ้าของ:</strong> ${house.owner_name || "-"}</p>
          <p><strong>โทร:</strong> ${house.owner_phone || "-"}</p>
          <p class="text-muted">
            <strong>ที่อยู่:</strong>
            ${house.owner_address || "-"}
          </p>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
};

// === รีเฟรชข้อมูลทุก 60 วินาที ===
setInterval(initDashboard, 60000);

// ================= ADD HOUSE FROM ADMIN =================

document
  .getElementById("addHouseForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const house_name = document.getElementById("houseName").value;
    const owner_name = document.getElementById("ownerName").value;
    const address = document.getElementById("ownerAddress").value;
    const phone = document.getElementById("ownerPhone").value;

    try {
      const response = await fetch("http://localhost:3000/api/houses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          house_name,
          owner_name,
          address,
          phone,
        }),
      });

      const data = await response.json();

      document.getElementById("addHouseMsg").innerHTML = "✅ เพิ่มบ้านสำเร็จ";

      document.getElementById("addHouseForm").reset();

      loadHouses(); // reload รายการบ้าน
    } catch (error) {
      console.error(error);
    }
  });

// ================= DELETE HOUSE =================
window.deleteHouse = async function(id) {

  if (!confirm("ต้องการลบบ้านนี้ไหม ?")) return;

  await fetch(`http://localhost:3000/api/houses/${id}`, {
    method: "DELETE",
  });

  LoadHouses();
};

initDashboard();

loadMeterReadings();

if (document.getElementById("monthlyChart")) {
  loadMonthlyChart();
}

if (document.getElementById("housesContainer")) {
  LoadHouses();
}

if (document.getElementById("totalUsageChart")) {
  loadTotalUsageChart();
}