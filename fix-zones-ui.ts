import fs from 'fs';

const liveFile = 'src/routes/admin.live.tsx';
let content = fs.readFileSync(liveFile, 'utf8');

// Ensure stats are not undefined
content = content.replace(
  'const refresh = useCallback(async () => {',
  'const refresh = useCallback(async () => {\n    if (loading) return;'
);

// Fix refresh data handling
content = content.replace(
  'const [{ zones: z, subzones: sz }, st] = await Promise.all([',
  'const data = await getZonesWithSubzones();\n      const z = data?.zones || [];\n      const sz = data?.subzones || [];\n      const st = await getZoneStats();'
);

fs.writeFileSync(liveFile, content);

const opsFile = 'src/routes/admin.operations.tsx';
let opsContent = fs.readFileSync(opsFile, 'utf8');

// Fix refresh data handling in operations
opsContent = opsContent.replace(
  'const [z, sz, st, live] = await Promise.all([',
  'const [z, sz, st, live] = await Promise.all([\n      fetchZones({ city: "eq.Vadodara" }).catch(() => []),\n      fetchSubzones(selectedZoneId || undefined).catch(() => []),\n      getZoneStats(selectedZoneId || undefined).catch(() => ({})),\n      fetchLiveShipmentOrders().catch(() => [])\n    ]);'
);

fs.writeFileSync(opsFile, opsContent);
