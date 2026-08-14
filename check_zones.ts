import { fetchZones } from './src/lib/zones-api';
async function run() {
  try {
    const zones = await fetchZones();
    console.log('ZONES_FOUND:' + JSON.stringify(zones));
  } catch (e) {
    console.error('ERROR:' + e.message);
  }
}
run();
