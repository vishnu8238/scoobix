import { getDisplayName } from "./src/lib/identity-utils";

function runTests() {
  const tests = [
    {
      name: "Google OAuth Metadata Full Name",
      user: {
        user_metadata: { full_name: "Vishnu Prasad" }
      },
      expected: "Vishnu Prasad"
    },
    {
      name: "InsForge Profile Name",
      user: {
        profile: { name: "Vishnu Manager" }
      },
      expected: "Vishnu Manager"
    },
    {
      name: "Google Identity Data (Nested Claims)",
      user: {
        identities: [{
          identity_data: { custom_claims: { name: "Vishnu Claim" } }
        }]
      },
      expected: "Vishnu Claim"
    },
    {
      name: "Authoritative Table Name beats session metadata",
      user: {
        name: "Vishnu Authoritative",
        user_metadata: { full_name: "Vishnu Session" }
      },
      expected: "Vishnu Authoritative"
    },
    {
      name: "Generic Filter (scoobix.info@gmail.com -> User)",
      user: {
        name: "scoobix.info",
        email: "scoobix.info@gmail.com"
      },
      expected: "User"
    },
    {
      name: "Generic Filter (Prefix scoobix. -> User)",
      user: {
        name: "scoobix.v",
        email: "scoobix.v@gmail.com"
      },
      expected: "User"
    }
  ];

  console.log("--- IDENTITY RESOLVER REGRESSION TESTS (v3) ---");
  let passed = 0;
  for (const t of tests) {
    const result = getDisplayName(t.user);
    if (result === t.expected) {
      console.log(`✅ PASS: ${t.name} -> "${result}"`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${t.name} | Expected: "${t.expected}" | Got: "${result}"`);
    }
  }
  
  if (passed !== tests.length) process.exit(1);
}

runTests();
