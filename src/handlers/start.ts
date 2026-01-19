import { MyContext } from "../context.js";
import { prisma } from "../db.js";
import { registerCommand } from "../utils/commandRegistry.js";
import { t } from "../utils/i18n.js";

export const startHandler = async (ctx: MyContext) => {
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);
    const displayName = ctx.from.first_name;

    await prisma.user.upsert({
        where: { telegramId },
        update: { displayName },
        create: {
            telegramId,
            displayName
        }
    });

    await ctx.reply(
        `${t(ctx, "start.welcome")}\n\n${t(ctx, "start.instructions")}`,
        { parse_mode: "HTML" }
    );
};

registerCommand({
    name: "start",
    description: "Start the bot and register your account",
    handler: startHandler
});
