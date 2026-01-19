import { MyContext } from "../context.js";
import { isSquadAlertEnabled, setSquadAlertEnabled } from "../polling.js";
import { registerCommand } from "../utils/commandRegistry.js";

export const toggleSquadAlertHandler = async (ctx: MyContext) => {
    const currentState = isSquadAlertEnabled();
    const newState = !currentState;

    setSquadAlertEnabled(newState);

    const status = newState ? "enabled ✅" : "disabled ❌";
    const emoji = newState ? "🔔" : "🔕";

    await ctx.reply(
        `${emoji} <b>Squad Alert ${status}</b>\n\n` +
        `Squad Alerts will ${newState ? "now" : "no longer"} be sent when multiple friends are playing the same game.`,
        { parse_mode: "HTML" }
    );
};

export const squadAlertStatusHandler = async (ctx: MyContext) => {
    const isEnabled = isSquadAlertEnabled();
    const status = isEnabled ? "enabled ✅" : "disabled ❌";
    const emoji = isEnabled ? "🔔" : "🔕";

    await ctx.reply(
        `${emoji} <b>Squad Alert Status</b>\n\n` +
        `Squad Alerts are currently <b>${status}</b>`,
        { parse_mode: "HTML" }
    );
};

registerCommand({
    name: "toggle_squad_alert",
    description: "[Admin] Toggle Squad Alert notifications on/off",
    handler: toggleSquadAlertHandler,
    adminOnly: true
});

registerCommand({
    name: "squad_alert_status",
    description: "Check if Squad Alert is enabled or disabled",
    handler: squadAlertStatusHandler,
    adminOnly: false
});
