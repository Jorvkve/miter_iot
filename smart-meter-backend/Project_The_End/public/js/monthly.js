// ===============================
// 1. LOAD MONTHLY TOTAL CHART (กราฟรวมทุกบ้าน)
// ===============================
async function loadMonthlyChart() {
  try {
    const res = await fetch("http://localhost:3000/api/readings/monthly-by-house");
    const data = await res.json();

    if (!data || data.length === 0) return;

    const canvas = document.getElementById("monthlyChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // เรียงลำดับเดือน (Month Sorting)
    const months = [...new Set(data.map(d => d.month))].sort((a, b) => {
      const [mA, yA] = a.split("/");
      const [mB, yB] = b.split("/");
      return new Date(yA, mA - 1) - new Date(yB, mB - 1);
    });

    // เรียงลำดับชื่อบ้าน (House Sorting)
    const houses = [...new Set(data.map(d => d.house_name))].sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 999;
      const numB = parseInt(b.replace(/\D/g, '')) || 999;
      return numA - numB;
    });

    const colors = ["#3498db", "#2ecc71", "#e74c3c", "#f39c12", "#9b59b6", "#1abc9c"];

    const datasets = houses.map((house, i) => ({
      label: house,
      backgroundColor: colors[i % colors.length],
      data: months.map(month => {
        const found = data.find(d => d.month === month && d.house_name === house);
        return found ? Number(found.total_unit) : 0;
      })
    }));

    new Chart(ctx, {
      type: "bar",
      data: { labels: months, datasets },
      options: { responsive: true }
    });
  } catch (err) {
    console.error("Error loading monthly chart:", err);
  }
}

// ===============================
// 2. LOAD HOUSE MONTHLY CHARTS (กราฟแยกรายบ้าน)
// ===============================
async function loadHouseMonthlyCharts() {
  try {
    const res = await fetch("http://localhost:3000/api/readings/monthly-by-house");
    const data = await res.json();
    const container = document.getElementById("houseMonthlyCharts");

    if (!container || !data) return;
    container.innerHTML = ""; // ล้างค่าว่าง

    const houses = [...new Set(data.map(d => d.house_name))].sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 999;
      const numB = parseInt(b.replace(/\D/g, '')) || 999;
      return numA - numB;
    });

    const allMonths = [...new Set(data.map(d => d.month))].sort((a, b) => {
      const [mA, yA] = a.split("/");
      const [mB, yB] = b.split("/");
      return new Date(yA, mA - 1) - new Date(yB, mB - 1);
    });

    houses.forEach((house, index) => {
      const canvasId = "chart_" + index;

      // สร้าง Element ด้วย createElement เพื่อป้องกันกราฟหาย (Fix innerHTML bug)
      const col = document.createElement("div");
      col.className = "col-md-6 mb-4";
      col.innerHTML = `
        <div class="card shadow-sm">
          <div class="card-header bg-success text-white">🏠 ${house}</div>
          <div class="card-body"><canvas id="${canvasId}"></canvas></div>
        </div>
      `;
      container.appendChild(col);

      const houseData = data.filter(d => d.house_name === house);
      const values = allMonths.map(month => {
        const found = houseData.find(d => d.month === month);
        return found ? Number(found.total_unit) : 0;
      });

      const ctx = document.getElementById(canvasId).getContext("2d");
      new Chart(ctx, {
        type: "line",
        data: {
          labels: allMonths,
          datasets: [{
            label: "หน่วยไฟ",
            data: values,
            borderColor: "#3498db",
            backgroundColor: "rgba(52,152,219,0.2)",
            tension: 0.3,
            fill: true
          }]
        },
        options: { responsive: true }
      });
    });
  } catch (err) {
    console.error("Error loading individual charts:", err);
  }
}

// ===============================
// 3. INITIALIZE
// ===============================
loadMonthlyChart();
loadHouseMonthlyCharts();