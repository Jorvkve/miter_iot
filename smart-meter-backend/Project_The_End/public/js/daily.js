// ===============================
// INIT DASHBOARD
// ===============================
window.addEventListener("load", initDashboard);

async function initDashboard() {
  console.log("Dashboard Started ✅");

  await loadHouses();
  await loadTotalUsageChart();
}


// ===============================
// LOAD HOUSES
// ===============================
async function loadHouses() {

  const res = await fetch("http://localhost:3000/api/houses");
  const houses = await res.json();

  const container =
    document.getElementById("houseCards");

  if (!container) return;

  container.innerHTML = "";

  houses.forEach(house => {

    container.innerHTML += `
      <div class="col-md-4 mb-3">
        <div class="card shadow-sm">

          <div class="card-header bg-success text-white">
            🏠 ${house.house_name}
          </div>

          <div class="card-body">

            <p><b>เจ้าของ:</b>
            ${house.owner_name ?? "-"}</p>

            <p><b>โทร:</b>
            ${house.phone ?? "-"}</p>

            <p class="text-muted">
            รอข้อมูลมิเตอร์...
            </p>

          </div>

        </div>
      </div>
    `;
  });
}


// ===============================
// TOTAL USAGE CHART
// ===============================
async function loadTotalUsageChart() {

  try {

    const res =
      await fetch("http://localhost:3000/api/readings/monthly-by-house");

    const data = await res.json();

    const canvas =
      document.getElementById("totalUsageChart");

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const months =
      [...new Set(data.map(d => d.month))];

    const houses =
      [...new Set(data.map(d => d.house_name))];

    const colors = [
      "#3498db",
      "#2ecc71",
      "#e74c3c",
      "#f39c12",
      "#9b59b6",
      "#1abc9c"
    ];

    const datasets = houses.map(
      (house, index) => {

        return {
          label: house,
          backgroundColor:
            colors[index % colors.length],

          data: months.map(month => {

            const found = data.find(
              d =>
                d.month === month &&
                d.house_name === house
            );

            return found
              ? Number(found.total_unit)
              : 0;
          })
        };
      }
    );

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

  } catch (err) {
    console.error("Chart Error:", err);
  }
}

async function loadLatestReadings() {

  const res = await fetch("/api/readings/latest");
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
      <p><b>หน่วยล่าสุด:</b> ${reading.reading_value} หน่วย</p>
      <p><b>เวลา:</b> ${new Date(reading.reading_time)
        .toLocaleString()}</p>

      <img 
        src="/uploads/${reading.image_filename}" 
        class="img-fluid rounded mt-2"
      />
    `;
  });

}

async function init() {
  await loadHouses();
  await loadLatestReadings();
}

init();