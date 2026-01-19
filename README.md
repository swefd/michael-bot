# Gamer Bridge

A multi-platform integration bot that bridges Telegram, Steam, TeamSpeak 3, and AI-powered chat using Grok. Monitor your gaming presence, interact with friends, and get AI assistance - all through Telegram.

## Features

- 🤖 **Telegram Bot Interface** - Control everything through Telegram commands
- 🎮 **Steam Integration** - Track gaming activity, friends status, and more
- 🎤 **TeamSpeak 3 Integration** - Monitor voice server status and user activity
- 🧠 **Grok AI Chat** - AI-powered conversational assistant with context awareness
- 📊 **Real-time Polling** - Automatic status updates and notifications
- 💾 **Persistent Storage** - SQLite database with Prisma ORM

## Prerequisites

- Node.js 18.x or higher
- npm or yarn package manager
- A Telegram bot token from [@BotFather](https://t.me/botfather)
- Steam API key from [Steam Web API](https://steamcommunity.com/dev/apikey)
- TeamSpeak 3 server with query access
- Grok AI API key from [x.ai](https://x.ai)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/gamer-bridge.git
   cd gamer-bridge
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your credentials (see Configuration section below)

4. **Initialize the database**
   ```bash
   npm run db:push
   ```

5. **Build the project**
   ```bash
   npm run build
   ```

6. **Start the bot**
   ```bash
   npm start
   ```

## Configuration

All configuration is done through environment variables in the `.env` file. Copy `.env.example` to `.env` and configure the following:

### Telegram Bot
- `BOT_TOKEN` - Your Telegram bot token from BotFather

### Steam API
- `STEAM_API_KEY` - Your Steam Web API key
- `STEAM_REFRESH_TOKEN` - Steam account refresh token (recommended)
- `STEAM_PASSWORD` - Alternative to refresh token (less secure)

### TeamSpeak 3
- `TS3_HOST` - TeamSpeak server hostname/IP
- `TS3_QUERY_PORT` - ServerQuery port (default: 10011)
- `TS3_SERVER_PORT` - Virtual server port (default: 9987)
- `TS3_USERNAME` - ServerQuery username
- `TS3_PASSWORD` - ServerQuery password

### Grok AI
- `GROK_API_KEY` - Your Grok API key
- `GROK_MODEL` - AI model to use (default: grok-3-mini)
- `GROK_BASE_URL` - API endpoint (default: https://api.x.ai/v1)
- `GROK_MAX_TOKENS` - Maximum response tokens (default: 200)
- `GROK_TEMPERATURE` - Response creativity (default: 0.95)
- `GROK_MESSAGE_HISTORY_LIMIT` - Chat history messages to keep (default: 25)
- `GROK_DEFAULT_COOLDOWN_MINUTES` - Cooldown between AI requests (default: 7)

### General
- `DATABASE_URL` - Database connection string (default: file:./dev.db)
- `UPDATE_RATE_SECONDS` - Polling interval for status updates (default: 30)
- `LOG_LEVEL` - Logging level: debug, info, warn, error (default: warn)

## Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled bot (requires build first)
- `npm run dev` - Build and run in one command
- `npm run db:push` - Push Prisma schema changes to database
- `npm run db:edit` - Open Prisma Studio to view/edit database
- `npm run generate-token` - Generate Steam refresh token

## Usage

Once the bot is running, interact with it through Telegram:

1. Start a chat with your bot on Telegram
2. Send `/start` to initialize
3. Use `/status` to check current gaming activity
4. Chat naturally for AI-powered responses via Grok

## Docker Support

A `docker-compose.yml` is included for containerized deployment:

```bash
docker-compose up -d
```

## Project Structure

```
gamer-bridge/
├── src/
│   ├── handlers/      # Telegram command handlers
│   ├── services/      # External service integrations (Steam, TS3, Grok)
│   ├── utils/         # Utility functions and helpers
│   ├── context.ts     # Bot context type definitions
│   ├── db.ts          # Database client initialization
│   ├── index.ts       # Main application entry point
│   └── polling.ts     # Status polling and monitoring
├── prisma/
│   └── schema.prisma  # Database schema
├── scripts/
│   └── generateSteamToken.ts  # Steam token generation utility
└── dist/              # Compiled JavaScript output
```

## Development

For development with auto-reload:

```bash
npm run dev
```

To view and edit the database:

```bash
npm run db:edit
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on GitHub.
