import { MyContext } from "../context.js";
import { updateStatusBoards } from "../polling.js";

// Rate Limit: 1 refresh every 5 seconds globally per chat to avoid spam
const lastRefresh = new Map<number, number>();

export const refreshBoardHandler = async (ctx: MyContext) => {
    if (!ctx.chat) return;

    const chatId = ctx.chat.id;
    const now = Date.now();
    const last = lastRefresh.get(chatId) || 0;

    if (now - last < 5000) {
        return ctx.answerCallbackQuery({
            text: "⏳ Please wait a few seconds before refreshing.",
            show_alert: false
        });
    }

    try {
        await ctx.answerCallbackQuery({ text: "🔄 Refreshing..." });
        await updateStatusBoards(ctx.api);

        lastRefresh.set(chatId, now);
    } catch (error) {
        console.error("Refresh error:", error);
    }
};
