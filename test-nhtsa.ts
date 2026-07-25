import { decodeVin } from "./src/lib/vinApi.js";
async function run() {
  const vehicle = await decodeVin("VF3LRHNYWFS343639");
  console.log(vehicle);
}
run();
