import { MyContext } from "../context.js";
import { prisma } from "../db.js";
import { registerCommand } from "../utils/commandRegistry.js";

export const linkTsHandler = async (ctx: MyContext) => {
    const args = ctx.match;
    if (typeof args !== "string" || !args) {
        return ctx.reply("Usage: /link_ts <ts_nickname>\n\nThis maps your Telegram account to a specific TeamSpeak nickname.");
    }

    const tsAlias = args.trim();

    try {
        const telegramId = BigInt(ctx.from!.id);
        const displayName = ctx.from!.first_name;

        // Update or create user with new TS alias
        await prisma.user.upsert({
            where: { telegramId },
            update: { tsAlias: tsAlias, displayName },
            create: {
                telegramId,
                displayName,
                steamId: null,
                tsAlias: tsAlias
            }
        });

        // React to the message with a thumbs up
        await ctx.react("👍");

    } catch (error) {
        console.error("Error linking TS alias:", error);
        await ctx.reply("An error occurred while linking your TeamSpeak alias.");
    }
};

registerCommand({
    name: "link_ts",
    description: "Link your TeamSpeak nickname",
    handler: linkTsHandler
});
