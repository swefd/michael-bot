import axios from "axios";

const STEAM_API_BASE = "http://api.steampowered.com";
export interface SteamPlayerSummary {
    steamid: string;
    personaname: string;
    profileurl: string;
    avatar: string;
    personastate: number; // 0 - Offline, 1 - Online, 2 - Busy, 3 - Away, 4 - Snooze, 5 - looking to trade, 6 - looking to play
    gameextrainfo?: string;
    gameid?: string;
}

export const getPlayerSummaries = async (steamIds: string[]): Promise<SteamPlayerSummary[]> => {
    const key = process.env.STEAM_API_KEY;
    if (!key) throw new Error("STEAM_API_KEY is not set. Please add it to your .env file.");

    if (steamIds.length === 0) return [];

    const response = await axios.get(`${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v0002/`, {
        params: {
            key: key,
            steamids: steamIds.join(","),
        },
    });

    return response.data.response.players || [];
};
