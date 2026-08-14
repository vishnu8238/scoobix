import { getDisplayName } from "./identity-utils";

/**
 * PRODUCTION-SHAPE REGRESSION TEST V7
 * Simulates exact InsForge session + Profile table responses to verify name prioritization.
 */
export function runIdentityTests() {
  console.log("--- STARTING IDENTITY REGRESSION V7 ---");

  const results = [
    // 1. Production Failure Case: Google user with "User" in fallback fields
    {
      name: "Google OAuth Priority",
      input: {
        id: "usr_123",
        provider_metadata: { name: "Vishnu Prasad" },
        user_metadata: { name: "User" },
        full_name: "User",
        display_name: "Merchant Manager"
      },
      expected: "Vishnu Prasad"
    },
    // 2. Profile Table Priority: No social name, but profile table has one
    {
      name: "DB Profile Priority",
      input: {
        id: "usr_456",
        user_metadata: { name: "scoobix.v" },
        full_name: "Vishnu Prasad DB"
      },
      expected: "Vishnu Prasad DB"
    },
    // 3. Nested Identity Case
    {
      name: "Social Identity Priority",
      input: {
        id: "usr_789",
        identities: [
          { identity_data: { full_name: "Vishnu Social" } }
        ],
        user_metadata: { name: "User" }
      },
      expected: "Vishnu Social"
    },
    // 4. Generic Blocking: Ensure "User" or email prefix never wins if ANY valid name exists
    {
      name: "Generic Blocking",
      input: {
        id: "usr_abc",
        email: "scoobix.info@gmail.com",
        user_metadata: { name: "User" },
        provider_metadata: { name: "Actual Name" }
      },
      expected: "Actual Name"
    },
    // 5. Email Prefix Fallback: Last resort (but not scoobix.info)
    {
      name: "Email Prefix Fallback",
      input: {
        email: "john.doe@example.com",
        user_metadata: { name: "User" }
      },
      expected: "john.doe"
    }
  ];

  let failed = 0;
  results.forEach(test => {
    const actual = getDisplayName(test.input);
    const ok = actual === test.expected;
    console.log(`${ok ? "✅" : "❌"} ${test.name}: Expected "${test.expected}", got "${actual}"`);
    if (!ok) failed++;
  });

  console.log(`--- FINISHED: ${results.length - failed}/${results.length} PASSED ---`);
  if (failed > 0) process.exit(1);
}

if (import.meta.url.endsWith('identity_regression_v7.ts')) {
  runIdentityTests();
}
