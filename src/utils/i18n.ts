import { MyContext } from "../context.js";

// Translation dictionaries
export const translations = {
    en: {
        // Start command
        "start.welcome": "Welcome to Gamer Bridge! 🎮",
        "start.instructions": "Use /link_steam [steam_id64] or /link_ts [nickname] to get started.",

        // Status command
        "status.title": "Your Status",
        "status.not_registered": "❌ You are not registered yet. Use /start to register.",
        "status.display_name": "Display Name:",
        "status.telegram_id": "Telegram ID:",
        "status.steam_account": "Steam Account",
        "status.steam_id": "Steam ID:",
        "status.steam_name": "Name:",
        "status.steam_status": "Status:",
        "status.steam_offline": "Offline/Not playing",
        "status.steam_details": "Details:",
        "status.steam_rp_unavailable": "Rich Presence: Not available",
        "status.steam_fetch_error": "Unable to fetch live data",
        "status.steam_not_linked": "Not linked. Use /link_steam [steam_id64]",
        "status.ts_account": "TeamSpeak Account",
        "status.ts_nickname": "Nickname:",
        "status.ts_online": "✅ Online (Channel {channel})",
        "status.ts_offline": "⚫ Offline",
        "status.ts_fetch_error": "Error fetching TS data",
        "status.ts_not_linked": "Not linked. Use /link_ts [nickname]",

        // Link Steam command
        "link_steam.usage": "Usage: /link_steam [steam_id64]",
        "link_steam.invalid_format": "Invalid Steam ID format. Please use a SteamID64 (17 digits).",
        "link_steam.not_found": "Could not find a Steam profile with that ID. Please check and try again.",
        "link_steam.success": "Successfully linked Steam account: <b>{name}</b>",
        "link_steam.error": "An error occurred while linking your account.",

        // Link TS command
        "link_ts.usage": "Usage: /link_ts [ts_nickname]\n\nThis maps your Telegram account to a specific TeamSpeak nickname.",
        "link_ts.success": "Successfully linked TeamSpeak alias: **{alias}**\n\nThe status board will now show your activities under one name if this alias matches your TS nickname.",
        "link_ts.error": "An error occurred while linking your TeamSpeak alias.",

        // Init board command
        "init_board.group_only": "This command can only be used in groups.",
        "init_board.initializing": "🚀 **Gamer Bridge Status Board**\n\nInitializing...",
        "init_board.pin_warning": "Warning: I could not pin the message. Make sure I have admin rights to pin messages.",
        "init_board.error": "Failed to initialize status board. Please try again.",

        // Admin commands
        "admin.map_steam.usage": "Please reply to a user's message to link their Steam ID.\nUsage: Reply with `/map_steam [steam_id64]`",
        "admin.map_steam.invalid_user": "Cannot link a bot or unknown user.",
        "admin.map_steam.invalid_format": "Invalid Steam ID format. Please use a SteamID64 (17 digits).",
        "admin.map_steam.not_found": "Could not find a Steam profile with that ID.",
        "admin.map_steam.success": "✅ Linked <b>{telegram_name}</b> (Telegram) with <b>{steam_name}</b> (Steam).",
        "admin.map_steam.error": "Failed to link account. Check logs.",
        "admin.map_ts.usage": "Please reply to a user's message to link their TeamSpeak Alias.\nUsage: Reply with <code>/map_ts [nickname]</code>",
        "admin.map_ts.success": "✅ Linked <b>{telegram_name}</b> (Telegram) with TeamSpeak nickname <b>{ts_alias}</b>.",

        // Status board
        "board.title": "🎮 Live Status Board",
        "board.just_online": "Just Online:",
        "board.last_updated": "Last updated: {time}",
        "board.nobody_online": "Nobody is currently online.",

        // Grok AI
        "grok.enabled": "✅ Grok AI enabled. I'll respond when mentioned or gaming topics are discussed.",
        "grok.disabled": "❌ Grok AI disabled for this chat.",
        "grok.error": "⚠️ Grok AI error. Please try again later.",
        "grok.admin_only": "❌ Only admins can manage Grok settings.",
        "grok.group_only": "❌ This command only works in groups.",
        "grok.on_cooldown": "⏰ Grok is on cooldown ({minutes}m remaining).",
        "grok.status_title": "Grok AI Status",
        "grok.status_enabled": "Enabled",
        "grok.status_cooldown": "Cooldown",
        "grok.status_not_configured": "Grok AI is not configured for this chat. Use /enable_grok to activate.",
        "grok.minutes": "minutes",
        "grok.ready": "Ready to respond"
    },
    uk: {
        // Start command
        "start.welcome": "Ласкаво просимо до Gamer Bridge! 🎮",
        "start.instructions": "Використовуйте /link_steam [steam_id64] або /link_ts [нікнейм] для початку.",

        // Status command
        "status.title": "Ваш Статус",
        "status.not_registered": "❌ Ви ще не зареєстровані. Використайте /start для реєстрації.",
        "status.display_name": "Ім'я:",
        "status.telegram_id": "Telegram ID:",
        "status.steam_account": "Steam Акаунт",
        "status.steam_id": "Steam ID:",
        "status.steam_name": "Ім'я:",
        "status.steam_status": "Статус:",
        "status.steam_offline": "Офлайн/Не грає",
        "status.steam_details": "Деталі:",
        "status.steam_rp_unavailable": "Rich Presence: Недоступно",
        "status.steam_fetch_error": "Не вдалося отримати дані",
        "status.steam_not_linked": "Не прив'язано. Використайте /link_steam [steam_id64]",
        "status.ts_account": "TeamSpeak Акаунт",
        "status.ts_nickname": "Нікнейм:",
        "status.ts_online": "✅ Онлайн (Канал {channel})",
        "status.ts_offline": "⚫ Офлайн",
        "status.ts_fetch_error": "Помилка отримання даних TS",
        "status.ts_not_linked": "Не прив'язано. Використайте /link_ts [нікнейм]",

        // Link Steam command
        "link_steam.usage": "Використання: /link_steam [steam_id64]",
        "link_steam.invalid_format": "Невірний формат Steam ID. Будь ласка, використайте SteamID64 (17 цифр).",
        "link_steam.not_found": "Не вдалося знайти профіль Steam з таким ID. Будь ласка, перевірте та спробуйте ще раз.",
        "link_steam.success": "Успішно прив'язано Steam акаунт: <b>{name}</b>",
        "link_steam.error": "Сталася помилка під час прив'язки вашого акаунта.",

        // Link TS command
        "link_ts.usage": "Використання: /link_ts [ts_нікнейм]\n\nЦе прив'язує ваш Telegram акаунт до конкретного нікнейму TeamSpeak.",
        "link_ts.success": "Успішно прив'язано TeamSpeak псевдонім: **{alias}**\n\nТабло статусу тепер показуватиме вашу активність під одним ім'ям, якщо цей псевдонім збігається з вашим TS нікнеймом.",
        "link_ts.error": "Сталася помилка під час прив'язки вашого TeamSpeak псевдоніму.",

        // Init board command
        "init_board.group_only": "Цю команду можна використовувати тільки в групах.",
        "init_board.initializing": "🚀 **Табло Статусу Gamer Bridge**\n\nІніціалізація...",
        "init_board.pin_warning": "Увага: Я не зміг закріпити повідомлення. Переконайтеся, що у мене є права адміністратора для закріплення повідомлень.",
        "init_board.error": "Не вдалося ініціалізувати табло статусу. Будь ласка, спробуйте ще раз.",

        // Admin commands
        "admin.map_steam.usage": "Будь ласка, відповідайте на повідомлення користувача, щоб прив'язати його Steam ID.\nВикористання: Відповідайте з `/map_steam [steam_id64]`",
        "admin.map_steam.invalid_user": "Неможливо прив'язати бота або невідомого користувача.",
        "admin.map_steam.invalid_format": "Невірний формат Steam ID. Будь ласка, використайте SteamID64 (17 цифр).",
        "admin.map_steam.not_found": "Не вдалося знайти профіль Steam з таким ID.",
        "admin.map_steam.success": "✅ Прив'язано <b>{telegram_name}</b> (Telegram) з <b>{steam_name}</b> (Steam).",
        "admin.map_steam.error": "Не вдалося прив'язати акаунт. Перевірте логи.",
        "admin.map_ts.usage": "Будь ласка, відповідайте на повідомлення користувача, щоб прив'язати його TeamSpeak Псевдонім.\nВикористання: Відповідайте з <code>/map_ts [нікнейм]</code>",
        "admin.map_ts.success": "✅ Прив'язано <b>{telegram_name}</b> (Telegram) з TeamSpeak нікнеймом <b>{ts_alias}</b>.",

        // Status board
        "board.title": "🎮 Табло Статусу",
        "board.just_online": "Просто Онлайн:",
        "board.last_updated": "Останнє оновлення: {time}",
        "board.nobody_online": "Зараз нікого немає онлайн.",

        // Grok AI
        "grok.enabled": "✅ Grok AI увімкнено. Відповідатиму на згадки та ігрові теми.",
        "grok.disabled": "❌ Grok AI вимкнено для цього чату.",
        "grok.error": "⚠️ Помилка Grok AI. Спробуйте пізніше.",
        "grok.admin_only": "❌ Тільки адміни можуть керувати налаштуваннями Grok.",
        "grok.group_only": "❌ Ця команда працює тільки в групах.",
        "grok.on_cooldown": "⏰ Grok на затримці ({minutes}хв залишилось).",
        "grok.status_title": "Статус Grok AI",
        "grok.status_enabled": "Увімкнено",
        "grok.status_cooldown": "Затримка",
        "grok.status_not_configured": "Grok AI не налаштовано для цього чату. Використайте /enable_grok для активації.",
        "grok.minutes": "хвилин",
        "grok.ready": "Готовий відповідати"
    }
};

type Language = keyof typeof translations;
type TranslationKey = keyof typeof translations.en;

// Helper function to replace placeholders like {name} with values
function replacePlaceholders(text: string, params?: Record<string, string | number>): string {
    if (!params) return text;

    return Object.entries(params).reduce((result, [key, value]) => {
        return result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }, text);
}

// Main translation function
export function t(ctx: MyContext, key: TranslationKey, params?: Record<string, string | number>): string {
    // Get user's language from Telegram (falls back to 'en')
    const userLang = ctx.from?.language_code?.split('-')[0] as Language || 'en';

    // Use Ukrainian for 'uk', fallback to English for any other language
    const lang: Language = userLang === 'uk' ? 'uk' : 'en';

    // Get translation, fallback to English if key doesn't exist
    const translation = translations[lang][key] || translations.en[key] || key;

    return replacePlaceholders(translation, params);
}
