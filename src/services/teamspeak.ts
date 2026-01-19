import { TeamSpeak } from "ts3-nodejs-library";

// "One-Shot" Helper: Connects, runs a task, and then disconnects.
// This prevents "prematurely closed connection" errors caused by server timeouts during idle periods.
const withTeamSpeak = async <T>(task: (ts: TeamSpeak) => Promise<T>): Promise<T | null> => {
    let ts3: TeamSpeak | null = null;
    try {
        ts3 = await TeamSpeak.connect({
            host: process.env.TS3_HOST || "localhost",
            queryport: Number(process.env.TS3_QUERY_PORT) || 10011,
            serverport: Number(process.env.TS3_SERVER_PORT) || 9987,
            username: process.env.TS3_USERNAME || "serveradmin",
            password: process.env.TS3_PASSWORD || "",
            nickname: "GamerBridgeBot",
            // No keepAlive needed for one-shot
            readyTimeout: 10000 // 10s timeout for connection
        });

        return await task(ts3);

    } catch (error) {
        console.error("TeamSpeak Interaction Error:", error);
        return null;
    } finally {
        if (ts3) {
            try {
                await ts3.quit();
            } catch (e) {
                // Ignore errors during quit
            }
        }
    }
};

export const getOnlineClients = async () => {
    return await withTeamSpeak(async (ts) => {
        const clients = await ts.clientList({ clientType: 0 });
        return clients.map(c => ({
            nickname: c.nickname,
            clid: c.clid,
            cid: c.cid
        }));
    }) || [];
};
