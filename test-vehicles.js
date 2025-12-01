#!/usr/bin/env node
// Quick test of the vehicle endpoints

const token = "stub." + Buffer.from("w.belaidi").toString("base64");

async function test() {
  const base = "http://localhost:3001";
  const headers = { 
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  try {
    console.log("1. Testing GET /vehicles...");
    let res = await fetch(`${base}/vehicles`, { headers });
    console.log(`   Status: ${res.status}`);
    let data = await res.json();
    console.log(`   Found ${data.vehicles?.length || 0} vehicles`);

    console.log("\n2. Testing POST /vehicles (create)...");
    res = await fetch(`${base}/vehicles`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        parc: "TEST-001",
        marque: "Toyota",
        modele: "Hiace",
        etat: "disponible"
      })
    });
    console.log(`   Status: ${res.status}`);
    data = await res.json();
    console.log(`   Created vehicle: ${data.parc}`);

    console.log("\n3. Testing GET /vehicles/:parc (fetch single)...");
    res = await fetch(`${base}/vehicles/TEST-001`, { headers });
    console.log(`   Status: ${res.status}`);
    data = await res.json();
    console.log(`   Vehicle: ${data.parc} - ${data.marque} ${data.modele}`);

    console.log("\n✅ All endpoints working!");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

test();
