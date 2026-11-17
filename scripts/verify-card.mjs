import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m)[1].trim().replace(/^["']|["']$/g, "");
const sql = neon(url);
const tag = Math.random().toString(36).slice(2, 8);
const slug = "cardco-" + tag;

const u = await sql.query(`INSERT INTO users (name, email, role) VALUES ('C Dealer', $1, 'dealer') RETURNING id`, [`c+${tag}@x.com`]);
const userId = u[0].id;
const d = await sql.query(
  `INSERT INTO dealers (user_id, business_name, business_reg, kra_pin, director_name, director_id_url, business_cert_url, phone, location, status, slug, score)
   VALUES ($1,'CardCo Motors','BRN','A0','Dir','x','y','+254','Nairobi','approved',$2,88) RETURNING id`, [userId, slug]);
const dealerId = d[0].id;
// Compliant car: 10 photos + a 17-char VIN so it passes public visibility.
const imgs = Array.from({ length: 10 }, () => `/placeholder-car.jpg`);
const c = await sql.query(
  `INSERT INTO cars (dealer_id, slug, year, make, model, price, mileage, fuel, transmission, body_type, condition, location, status, images, vin)
   VALUES ($1,$2,2022,'Toyota','CardViz',3000000,40000,'petrol','auto','suv','foreign_used','Nairobi','active',$3,'JT1234567890ABCDE') RETURNING id`,
  [dealerId, "zzz-card-" + tag, imgs]);
const carId = c[0].id;
for (let i = 0; i < 3; i++)
  await sql.query(`INSERT INTO reviews (dealer_id, car_id, author_name, rating, would_recommend) VALUES ($1,$2,'R',5,true)`, [dealerId, carId]);

try {
  const cars = await fetch("http://localhost:3000/cars?sort=trust");
  const html = await cars.text();
  const hasCar = html.includes("CardViz");
  const hasTrustChip = html.includes("Trusted ·") || html.includes("Trusted");
  const hasVerified = html.includes(">Verified<");
  console.log("/cars?sort=trust:", cars.status, "| car shown:", hasCar, "| Trusted chip:", hasTrustChip, "| Verified signal:", hasVerified);
  console.log(cars.status === 200 && hasCar ? "✓ CARD VISIBLE WITH TRUST" : "✗ FAILED");
} finally {
  await sql.query(`DELETE FROM users WHERE id=$1`, [userId]);
  console.log("cleaned up");
}
