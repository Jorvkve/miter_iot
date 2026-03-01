async function loadHouses() {

const res = await fetch("/api/houses");
const houses = await res.json();

const div = document.getElementById("houseList");
div.innerHTML = "";

houses.forEach(h => {

div.innerHTML += `
<div class="card mb-2">
<div class="card-body">
${h.house_name}
<button class="btn btn-danger btn-sm float-end"
onclick="deleteHouse(${h.id})">
ลบ
</button>
</div>
</div>
`;

});
}

async function addHouse(){

await fetch("/api/houses",{
method:"POST",
headers:{ "Content-Type":"application/json"},
body:JSON.stringify({
house_name:document.getElementById("houseName").value,
owner_name:document.getElementById("owner").value,
phone:document.getElementById("phone").value
})
});

loadHouses();
}

async function deleteHouse(id){
await fetch("/api/houses/"+id,{
method:"DELETE"
});
loadHouses();
}

loadHouses();