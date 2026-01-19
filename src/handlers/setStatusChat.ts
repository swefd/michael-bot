import { MyContext } from "../context.js";
import { prisma } from "../db.js";
import { registerCommand } from "../utils/commandRegistry.js";

export const setStatusChatHandler = async (ctx: MyContext) => {
    if (ctx.chat?.type !== "group" && ctx.chat?.type !== "supergroup") {
        return ctx.reply("This command can only be used in groups.");
    }

    try {
        const statusMsg = await ctx.reply("🚀 **Gamer Bridge Status Board**\n\nInitializing...", { parse_mode: "Markdown" });

        // Pin the message
        try {
            await ctx.api.pinChatMessage(ctx.chat.id, statusMsg.message_id);
        } catch (e) {
            console.warn("Failed to pin message (permissions?)", e);
            await ctx.reply("Warning: I could not pin the message. Make sure I have admin rights to pin messages.");
        }

        const chatId = BigInt(ctx.chat.id);

        await prisma.group.upsert({
            where: { telegramChatId: chatId },
            update: { pinnedMessageId: statusMsg.message_id },
            create: {
                telegramChatId: chatId,
                pinnedMessageId: statusMsg.message_id
            }
        });

        // Clean up command message if possible to keep chat clean
        try {
            if (ctx.message) await ctx.deleteMessage();
        } catch { }

    } catch (error) {
        console.error("Error setting status chat:", error);
        await ctx.reply("Failed to initialize status board. Please try again.");
    }
};

registerCommand({
    name: "init_board",
    description: "Initialize the Live Status Board in this chat",
    handler: setStatusChatHandler
});
