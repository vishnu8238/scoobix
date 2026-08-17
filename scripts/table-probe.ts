import { listTable } from "./src/lib/insforge-crud";

async function main() {
  const tables = ["gigs", "delivery_gigs", "logistics_gigs", "public.gigs", "public.delivery_gigs"];
  for (const table of tables) {
    try {
      console.log(`Probing ${table}...`);
      const data = await listTable(table, { limit: 1 }, { fresh: true });
      console.log(`SUCCESS ${table}: ${data.length} rows`);
    } catch (err: any) {
      console.log(`FAILED ${table}: ${err.message}`);
    }
  }
}

main();
