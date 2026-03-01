async function loadMonthlyChart() {

  const res = await fetch("/api/readings/monthly");
  const data = await res.json();

  const months = [...new Set(data.map(d => d.month))];
  const houses = [...new Set(data.map(d => d.house_name))];

  const colors = [
    "#3498db",
    "#2ecc71",
    "#e74c3c",
    "#f39c12"
  ];

  const datasets = houses.map((house, i) => ({
    label: house,
    backgroundColor: colors[i % colors.length],
    data: months.map(month => {
      const found = data.find(
        d => d.month === month && d.house_name === house
      );
      return found ? Number(found.total_unit) : 0;
    })
  }));

  new Chart(
    document.getElementById("monthlyChart"),
    {
      type: "bar",
      data: {
        labels: months,
        datasets
      }
    }
  );
}

loadMonthlyChart();