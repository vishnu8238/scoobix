import { getDisplayName } from "./src/lib/identity-utils";

function runTests() {
  const tests = [
    {
      name: "Ignore DB 'User' and use Google metadata",
      user: {
        name: "User",
        user_metadata: { full_name: "Vishnu Prasad" }
      },
      expected: "Vishnu Prasad"
    },
    {
      name: "Authoritative Table Name beats session metadata if not generic",
      user: {
        name: "Vishnu Authoritative",
        user_metadata: { full_name: "Vishnu Session" }
      },
      expected: "Vishnu Authoritative"
    },
    {
      name: "Use identities array if top level is generic",
      user: {
        name: "User",
        identities: [{
          identity_data: { full_name: "Vishnu Identity" }
        }]
      },
      expected: "Vishnu Identity"
    },
    {
      name: "Fallback to email prefix if all else generic",
      user: {
        name: "User",
        email: "vishnu.dev@gmail.com"
      },
      expected: "vishnu.dev"
    },
    {
      name: "Generic Filter (scoobix.info@gmail.com -> User)",
      user: {
        name: "scoobix.info",
        email: "scoobix.info@gmail.com"
      },
      expected: "User"
    }
  ];

  console.log("--- IDENTITY RESOLVER REGRESSION TESTS (v4) ---");
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
  
  if (passed !== tests.length) {
    console.error(`Result: ${passed}/${tests.length} passed`);
    process.exit(1);
  }
  console.log("All tests passed!");
}

runTests();
