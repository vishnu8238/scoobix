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
      name: "Google Identity Data",
      user: {
        identities: [{
          identity_data: { full_name: "Vishnu Google" }
        }]
      },
      expected: "Vishnu Google"
    },
    {
      name: "Generic Filter (scoobix.info)",
      user: {
        name: "scoobix.info",
        email: "scoobix.info@gmail.com"
      },
      expected: "User"
    },
    {
      name: "Email Prefix Fallback",
      user: {
        email: "vishnu.p@example.com"
      },
      expected: "vishnu.p"
    }
  ];

  console.log("--- IDENTITY RESOLVER REGRESSION TESTS ---");
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
