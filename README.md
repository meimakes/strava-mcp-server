# Strava MCP Server

A Model Context Protocol (MCP) server for accessing Strava data. This single-user server provides tools to fetch activities, analyze performance trends, and get athlete statistics with real-time webhook support.

Built by [@meimakes](https://x.com/meimakes)


[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template?template=https://github.com/meimakes/strava-mcp-server&referralCode=a6V1Do)

## Features

- **Get Activities**: List recent activities with filters for date range and sport type
- **Activity Details**: Get detailed information including splits, segments, and map data
- **Athlete Stats**: View all-time statistics (recent, year-to-date, and all-time totals)
- **Search Activities**: Find activities matching specific criteria
- **Analyze Trends**: Analyze performance trends over time for various metrics
- **Real-Time Webhooks**: Get instant notifications when activities are created, updated, or deleted

## Architecture

- **Runtime**: Node.js/TypeScript
- **Framework**: MCP SDK (@modelcontextprotocol/sdk v1.12+)
- **Transport**: StreamableHTTP (SSE) for Railway deployment, stdio for local development
- **API Client**: node-fetch
- **Token Storage**: Environment variables (auto-refresh)
- **Auth**: OAuth 2.0
- **Session Management**: UUID-based session IDs with `mcp-session-id` header

## Setup

### Prerequisites

- Node.js >= 20.0.0
- A Strava account
- Strava API application credentials

### 1. Create Strava Application

1. Go to https://www.strava.com/settings/api
2. Create a new application:
   - **Application Name**: Your choice (e.g., "Personal MCP Server")
   - **Category**: Fitness App
   - **Authorization Callback Domain**: `localhost` (for initial setup)
3. Note your **Client ID** and **Client Secret**

### 2. Get OAuth Tokens (Local Setup)

```bash
# Install dependencies
npm install

# Set your Strava credentials
export STRAVA_CLIENT_ID=your_client_id
export STRAVA_CLIENT_SECRET=your_client_secret

# Run the OAuth setup script
npm run setup-auth
```

This will:
1. Open a browser window for Strava authorization
2. Start a local server to capture the OAuth callback
3. Display your tokens to copy to Railway

### 3. Deploy to Railway

1. Create a new project on [Railway](https://railway.app)
2. Connect your GitHub repository
3. Add the following environment variables in Railway:

```
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_ACCESS_TOKEN=from_setup_script
STRAVA_REFRESH_TOKEN=from_setup_script
STRAVA_EXPIRES_AT=from_setup_script
USE_SSE=true
PORT=3000
WEBHOOK_VERIFY_TOKEN=your_random_secure_string  # Optional, only if using webhooks
```

4. Deploy the application
5. Once deployed, Railway will provide you with a URL (e.g., `https://your-app.up.railway.app`)

### 4. Connect to Poke.com

After deploying to Railway, you can connect your Strava MCP server to Poke.com:

1. Go to [Poke.com](https://poke.com)
2. Navigate to Connections → Add Integration → Custom Integration
3. Click "Add Server" or "Add MCP Server"
4. Enter your Railway SSE endpoint URL:
   ```
   https://your-app.up.railway.app/sse
   ```
   Replace `your-app.up.railway.app` with your actual Railway domain

5. Give it a name like "Strava" and save
6. The server should now be connected and available in Poke.com

**Note:** The server URL must end with `/sse` - this is the Server-Sent Events endpoint that maintains the connection.

### Claude Desktop (stdio mode)

1. Complete the [Setup](#setup) steps above to get your OAuth tokens
2. Build the project: `npm run build`
3. Edit your Claude Desktop config:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude
