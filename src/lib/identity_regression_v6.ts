
import { getDisplayName } from "./identity-utils";

async function runTests() {
  console.log("Starting Production Runtime Identity Regression Tests...");

  const testCases = [
    {
      name: "Authoritative Google Full Name from user_metadata",
      user: {
        user_metadata: { full_name: "Vishnu Prasad" },
        profile: { full_name: "Ignored" },
        name: "User"
      },
      expected: "Vishnu Prasad"
    },
    {
      name: "Table Profile Name (Non-Generic) override",
      user: {
        name: "Vishnu DB",
        user_metadata: { full_name: "User" }
      },
      expected: "Vishnu DB"
    },
    {
      name: "Rejection of 'User' and fallback to email prefix",
      user: {
        name: "User",
        user_metadata: { name: "User" },
        profile: { full_name: "User" },
        email: "vishnu.test@gmail.com"
      },
      expected: "vishnu.test"
    },
    {
      name: "Rejection of 'scoobix.info' as a real name",
      user: {
        name: "scoobix.info",
        email: "scoobix.info@gmail.com"
      },
      expected: "User"
    },
    {
        name: "Rejection of role labels 'Merchant Manager'",
        user: {
            name: "Merchant Manager",
            email: "vishnu@example.com"
        },
        expected: "vishnu"
    },
    {
        name: "Deep Nested Identity Data (Google Identities)",
        user: {
            identities: [{
                identity_data: {
                    full_name: "Vishnu Real Identity"
                }
            }]
        },
        expected: "Vishnu Real Identity"
    },
    {
        name: "Production 'scoobix.v' rejection",
        user: {
            name: "scoobix.v",
            email: "scoobix.v@gmail.com"
        },
        expected: "User"
    }
  ];

  let passed = 0;
  for (const tc of testCases) {
    const result = getDisplayName(tc.user);
    if (result === tc.expected) {
      console.log(`✅ PASS: ${tc.name} -> "${result}"`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${tc.name}. Expected "${tc.expected}", got "${result}"`);
    }
  }

  console.log(`\nFinal Score: ${passed}/${testCases.length}`);
  process.exit(passed === testCases.length ? 0 : 1);
}

runTests().catch(console.error);
