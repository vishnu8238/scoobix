import { getDisplayName } from "./identity-utils";
async function runTests() {
    console.log("Starting Identity Resolution Regression Tests...");
    const testCases = [
        {
            name: "Authoritative Google Full Name",
            user: {
                user_metadata: { full_name: "Vishnu Prasad" },
                profile: { full_name: "Ignored" },
                name: "Ignored"
            },
            expected: "Vishnu Prasad"
        },
        {
            name: "Table Profile Name (Non-Generic)",
            user: {
                name: "Vishnu DB",
                user_metadata: { full_name: "User" }
            },
            expected: "Vishnu DB"
        },
        {
            name: "Generic 'User' Rejection",
            user: {
                name: "User",
                user_metadata: { name: "User" },
                profile: { full_name: "User" },
                email: "vishnu@gmail.com"
            },
            expected: "vishnu"
        },
        {
            name: "Generic 'scoobix.info' Rejection",
            user: {
                name: "scoobix.info",
                email: "scoobix.info@gmail.com"
            },
            expected: "User"
        },
        {
            name: "Role Label Rejection",
            user: {
                name: "Merchant Manager",
                user_metadata: { full_name: "Administrator" },
                email: "vishnu.prasad@example.com"
            },
            expected: "vishnu.prasad"
        },
        {
            name: "Deep Nested Identities (Google)",
            user: {
                identities: [{
                        identity_data: {
                            full_name: "Vishnu Identity"
                        }
                    }]
            },
            expected: "Vishnu Identity"
        }
    ];
    let passed = 0;
    for (const tc of testCases) {
        const result = getDisplayName(tc.user);
        if (result === tc.expected) {
            console.log(`✅ PASS: ${tc.name} -> "${result}"`);
            passed++;
        }
        else {
            console.error(`❌ FAIL: ${tc.name}. Expected "${tc.expected}", got "${result}"`);
        }
    }
    console.log(`\nTests finished: ${passed}/${testCases.length} passed.`);
    process.exit(passed === testCases.length ? 0 : 1);
}
runTests().catch(console.error);
