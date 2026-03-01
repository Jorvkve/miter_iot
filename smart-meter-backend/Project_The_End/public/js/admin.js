/* ===============================
   API
=============================== */
const API = "http://localhost:3000/api";

let allReadings = [];


/* ===============================
   INIT
=============================== */
window.addEventListener("load", () => {
  loadHouses();
  loadMeterReadings();
});


/* ===============================
   LOAD HOUSES (ฉบับแก้ไขปุ่ม Toggle)
=============================== */
async function loadHouses() {
  // ดึงข้อมูลจาก API
  const res = await fetch(`${API}/houses`);
  const houses = await res.json();

  const container = document.getElementById("houseList");
  const total = document.getElementById("totalHouses");
  const template = document.getElementById("houseTemplate");

  if (!container || !template) return;

  /* ✅ แสดงจำนวนบ้านทั้งหมด */
  if (total) {
    total.innerHTML = `🏠 จำนวนบ้านทั้งหมด: ${houses.length} หลัง`;
  }

  // ล้างข้อมูลเก่าใน Container
  container.innerHTML = "";

  houses.forEach(house => {
    // คัดลอก Template
    const clone = template.content.cloneNode(true);

    // แสดงข้อมูลบ้าน
    clone.querySelector(".house-name").innerText = "🏠 " + house.house_name;
    clone.querySelector(".owner").innerText = "เจ้าของ: " + (house.owner_name || "-");
    clone.querySelector(".address").innerText = "ที่อยู่: " + (house.address || "-");
    clone.querySelector(".phone").innerText = "โทร: " + (house.phone || "-");

    /* =====================
       ปุ่มแก้ไข (EDIT)
    ===================== */
    clone.querySelector(".editBtn").onclick = () => editHouse(
      house.id,
      house.house_name,
      house.owner_name,
      house.address,
      house.phone
    );

    /* =====================
       ปุ่มสลับสถานะ (TOGGLE ACTIVE)
    ===================== */
    const toggleBtn = clone.querySelector(".deleteBtn"); // อ้างอิงปุ่มเดิมจาก Template

    // ตรวจสอบสถานะ: 1 คือเปิดใช้งาน, 0 คือปิดใช้งาน
    if (house.is_active == 1) {
      toggleBtn.innerText = "🚫 ปิดใช้งาน";
      toggleBtn.className = "btn btn-danger btn-sm deleteBtn";
    } else {
      toggleBtn.innerText = "✅ เปิดใช้งาน";
      toggleBtn.className = "btn btn-success btn-sm deleteBtn";
    }

    // เมื่อกดปุ่ม ให้เรียกฟังก์ชัน toggleHouse
    toggleBtn.onclick = () => toggleHouse(house.id);

    // นำข้อมูลไปแสดงผลบนหน้าเว็บ
    container.appendChild(clone);
  });
}

async function toggleHouse(id){

  if(!confirm("ต้องการเปลี่ยนสถานะบ้านนี้ ?"))
    return;

  await fetch(
    `${API}/houses/toggle/${id}`,
    {
      method:"PUT"
    }
  );

  loadHouses();
}

/* ===============================
   ADD HOUSE
=============================== */
async function addHouse() {

  const house_name =
    document.getElementById("house_name").value;

  const owner_name =
    document.getElementById("owner_name").value;

  const address =
    document.getElementById("address").value;

  const phone =
    document.getElementById("phone").value;

  if (!house_name)
    return alert("กรอกชื่อบ้าน");

  await fetch(`${API}/houses`, {
    method: "POST",
    headers:{
      "Content-Type":"application/json"
    },
    body: JSON.stringify({
      house_name,
      owner_name,
      address,
      phone
    })
  });

  document.getElementById("house_name").value="";
  document.getElementById("owner_name").value="";
  document.getElementById("address").value="";
  document.getElementById("phone").value="";

  loadHouses();
}


/* ===============================
   DELETE HOUSE
=============================== */
async function deleteHouse(id){

  if(!confirm("ต้องการปิดใช้งานบ้านนี้ ?"))
    return;

  await fetch(`${API}/houses/toggle/${id}`,{
    method:"PUT"
  });

  loadHouses();
}


/* ===============================
   LOAD READINGS
=============================== */
async function loadMeterReadings(){

  const res =
    await fetch(`${API}/readings`);

  allReadings =
    await res.json();

  renderReadings();
}


/* ===============================
   SEARCH + SORT
=============================== */
function renderReadings(){

  const table =
    document.getElementById("readingTable");

  const keyword =
    document.getElementById("searchHouse")
    ?.value.toLowerCase() || "";

  const sort =
    document.getElementById("sortType")
    ?.value || "latest";

  let data =
    allReadings.filter(r =>
      r.house_name
      .toLowerCase()
      .includes(keyword)
    );

  switch(sort){

    case "latest":
      data.sort((a,b)=>
        new Date(b.reading_time)
        - new Date(a.reading_time));
      break;

    case "oldest":
      data.sort((a,b)=>
        new Date(a.reading_time)
        - new Date(b.reading_time));
      break;

    case "house":
      data.sort((a,b)=>
        a.house_name.localeCompare(b.house_name,'th'));
      break;

    case "unit_high":
      data.sort((a,b)=>
        b.reading_value-a.reading_value);
      break;

    case "unit_low":
      data.sort((a,b)=>
        a.reading_value-b.reading_value);
      break;
  }

  table.innerHTML="";

  data.forEach(r=>{

    table.innerHTML+=`
      <tr>
        <td>${r.house_name}</td>

        <td><b>${r.reading_value}</b></td>

        <td>
        ${new Date(r.reading_time)
        .toLocaleString()}
        </td>

        <td>
        ${
            r.image_filename
            ? `<img
            src="http://localhost:3000/uploads/${r.image_filename}"
            width="80"
            class="rounded"
            onerror="this.style.display='none'"
            />`
            : "-"
        }
        </td>

        <td>
        <button
        class="btn btn-danger btn-sm"
        onclick="deleteReading(${r.id})">
        ลบ
        </button>
        </td>
      </tr>
    `;
  });
}


/* ===============================
   DELETE READING
=============================== */
async function deleteReading(id){

  if(!confirm("ลบข้อมูลมิเตอร์นี้ ?"))
    return;

  await fetch(`${API}/readings/${id}`,{
    method:"DELETE"
  });

  loadMeterReadings();
}

/* ===============================
   EDIT HOUSE
=============================== */
async function editHouse(id, name, owner, address, phone){

  const house_name = prompt("ชื่อบ้าน", name);
  if(!house_name) return;

  const owner_name = prompt("เจ้าของ", owner || "");
  const addr = prompt("ที่อยู่", address || "");
  const phone_no = prompt("เบอร์โทร", phone || "");

  const res = await fetch(`${API}/houses/${id}`,{
    method:"PUT",
    headers:{
      "Content-Type":"application/json"
    },
    body: JSON.stringify({
      house_name,
      owner_name,
      address: addr,
      phone: phone_no
    })
  });

  const result = await res.json();
  console.log(result);

  loadHouses();
}