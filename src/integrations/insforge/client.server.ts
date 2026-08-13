import { createClient } from '@insforge/sdk';

export const INSFORGE_URL = process.env['VITE_INSFORGE_URL'] || process.env['INSFORGE_URL'] || "https://awvs3seh.us-east.insforge.app";
export const INSFORGE_API_KEY = process.env['INSFORGE_API_KEY'];

if (!INSFORGE_URL || !INSFORGE_API_KEY) {
  const missing = [
    ...(!INSFORGE_URL ? ['INSFORGE_URL'] : []),
    ...(!INSFORGE_API_KEY ? ['INSFORGE_API_KEY'] : []),
  ];
  console.error(`[InsForge] Missing environment variable(s): ${missing.join(', ')}.`);
}

export const insforgeAdmin = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_API_KEY || "", // Using API key as anonKey for admin operations if that's how SDK expects it, or use a dedicated admin method if available
});
