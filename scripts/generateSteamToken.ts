import SteamUser from "steam-user";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

const client = new SteamUser();
const rl = readline.createInterface({ input, output });

async function main() {
    console.log("🔐 Steam Refresh Token Generator\n");

    const accountName = await rl.question("Enter Steam Username: ");
    const password = await rl.question("Enter Steam Password: ");

    console.log("\nLogging in...");

    client.logOn({
        accountName,
        password,
    });

    client.on("steamGuard", async (domain, callback) => {
        if (domain) {
            console.log(`\n🔑 Steam Guard Code sent to email ending in ${domain}`);
        } else {
            console.log("\n📱 Steam Guard Mobile Authenticator code required");
            console.log("(Open your Steam Mobile App -> Steam Guard tab -> Enter the generated code)");
        }

        const code = await rl.question("Enter Code: ");
        callback(code);
    });

    client.on("loggedOn", () => {
        console.log("\n✅ Logged in successfully!");
    });

    client.on("refreshToken", (token) => {
        console.log("\n🎉 Authorization Successful!");
        console.log("---------------------------------------------------");
        console.log("STEAM_REFRESH_TOKEN=" + token);
        console.log("---------------------------------------------------");
        console.log("\n1. Copy the line above.");
        console.log("2. Paste it into your .env file.");
        console.log("3. You can now REMOVE your Steam Password from .env!");

        client.logOff();
        process.exit(0);
    });

    client.on("error", (err) => {
        console.error("\n❌ Error:", err.message);
        process.exit(1);
    });
}

main();
