# Strava MCP Server

A Model Context Protocol (MCP) server for accessing Strava data. This single-user server provides tools to fetch activities, analyze performance trends, and get athlete statistics with real-time webhook support.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/Baum78?referralCode=7zdyjn&utm_medium=integration&utm_source=template&utm_campaign=generic)

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

#### Troubleshooting Poke.com Connection

- **"Invalid MCP server URL"**: Ensure your URL ends with `/sse` and the server is deployed and running
- **Connection timeout**: Check Railway logs to see if the server is starting correctly
- **Server not responding**: Verify the environment variables are set correctly in Railway
- **Test the endpoint**: Visit `https://your-app.up.railway.app/health` - you should see `{"status":"ok",...}`

### 5. Local Development

For local testing without Railway:

```bash
# Build the project
npm run build

# Run in development mode (stdio transport)
npm run dev

# Or run the compiled version
npm start
```

### 6. Enable Real-Time Webhooks (Optional)

Get instant notifications when activities are created, updated, or deleted on Strava.

#### Setup Webhooks

1. **Add environment variable to Railway:**
   ```
   WEBHOOK_VERIFY_TOKEN=your_random_secure_string_here
   ```
   Generate a random string (e.g., `openssl rand -hex 32`)

2. **Subscribe to Strava webhooks** (run once after deployment):
   ```bash
   curl -X POST https://www.strava.com/api/v3/push_subscriptions \
     -F client_id=YOUR_STRAVA_CLIENT_ID \
     -F client_secret=YOUR_STRAVA_CLIENT_SECRET \
     -F callback_url=https://your-app.up.railway.app/webhook/strava \
     -F verify_token=your_random_secure_string_here
   ```

   Response will include your subscription ID:
   ```json
   { "id": 120475 }
   ```

3. **Test it:** Do a workout, let it sync to Strava, then check Railway logs for:
   ```
   Received Strava webhook event: { aspect_type: 'create', object_id: 12345678, ... }
   ```

#### Using Webhooks

Once webhooks are set up, you can use the new tool:

```typescript
// Query recent webhook events
strava_get_recent_events({ limit: 10 })
```

This returns recent activity creates, updates, and deletes, allowing Claude to:
- Know when you've just finished a workout
- Detect edited or deleted activities
- Provide faster responses by knowing which activities changed

#### Managing Webhooks

```bash
# View your subscription
curl -G https://www.strava.com/api/v3/push_subscriptions \
  -d client_id=YOUR_CLIENT_ID \
  -d client_secret=YOUR_CLIENT_SECRET

# Delete subscription (if needed)
curl -X DELETE https://www.strava.com/api/v3/push_subscriptions/SUBSCRIPTION_ID \
  -d client_id=YOUR_CLIENT_ID \
  -d client_secret=YOUR_CLIENT_SECRET
```

**Note:** Events are stored in memory (last 100 events). They're cleared on server restart but this rarely happens with Railway.

## MCP Tools

### `strava_get_activities`

List recent Strava activities.

**Parameters:**
- `days_back` (number, optional): Days to look back (default: 90)
- `sport_type` (string, optional): Filter by sport type (e.g., "Run", "Ride", "WeightTraining")
- `limit` (number, optional): Maximum activities to return (default: 30)

**Example:**
```json
{
  "days_back": 14,
  "sport_type": "Run",
  "limit": 10
}
```

### `strava_get_activity_details`

Get detailed information for a specific activity.

**Parameters:**
- `activity_id` (string, required): Strava activity ID

**Example:**
```json
{
  "activity_id": "12345678"
}
```

### `strava_get_athlete_stats`

Get all-time athlete statistics.

**Parameters:** None

### `strava_search_activities`

Search for activities matching specific criteria.

**Parameters:**
- `sport_type` (string, optional): Filter by sport type
- `min_distance` (number, optional): Minimum distance in meters
- `min_time` (number, optional): Minimum moving time in seconds
- `start_date` (string, optional): Start date in ISO format (YYYY-MM-DD)
- `end_date` (string, optional): End date in ISO format (YYYY-MM-DD)

**Example:**
```json
{
  "sport_type": "Run",
  "min_distance": 5000,
  "start_date": "2024-01-01",
  "end_date": "2024-03-31"
}
```

### `strava_analyze_trends`

Analyze performance trends over time.

**Parameters:**
- `metric` (string, required): One of "pace", "distance", "elevation", "heart_rate"
- `sport_type` (string, required): Activity type to analyze
- `weeks` (number, optional): Number of weeks to analyze (default: 8)

**Example:**
```json
{
  "metric": "pace",
  "sport_type": "Run",
  "weeks": 12
}
```

### `strava_get_recent_events`

Get recent webhook events from Strava (requires webhook setup).

**Parameters:**
- `limit` (number, optional): Number of recent events to return (default: 10, max: 100)

**Example:**
```json
{
  "limit": 20
}
```

**Returns:**
- Activity creates, updates, and deletes
- Event timestamps
- Activity IDs for fetching details

## Rate Limiting

Strava API limits:
- 100 requests per 15 minutes
- 1000 requests per day

The server implements a 5-minute cache to reduce API calls and stay within limits.

## Token Refresh

Access tokens automatically refresh when they expire. The server checks token expiration before each request and refreshes if needed. New tokens are logged to the console for manual Railway update if necessary.

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode
npm run dev

# Run OAuth setup
npm run setup-auth
```

## Project Structure

```
strava-mcp-server/
├── src/
│   ├── index.ts                 # MCP server entry + SSE/stdio setup
│   ├── strava-client.ts         # Strava API wrapper with caching
│   ├── token-manager.ts         # OAuth token auto-refresh
│   └── tools/
│       ├── get-activities.ts
│       ├── get-activity-details.ts
│       ├── get-athlete-stats.ts
│       ├── search-activities.ts
│       └── analyze-trends.ts
├── setup-auth.ts                # OAuth setup helper script
├── package.json
├── tsconfig.json
├── railway.json
└── README.md
```

## Troubleshooting

### "STRAVA_ACCESS_TOKEN must be set"

Run the `setup-auth.ts` script to obtain initial tokens, then add them to your Railway environment variables.

### "Failed to refresh token"

Check that your `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` are correct in Railway environment variables.

### Rate limit errors

The server caches responses for 5 minutes. If you're still hitting rate limits, reduce the number of requests or increase the cache duration in `strava-client.ts`.

## License

MIT

## Contributing

This is a personal single-user MCP server. Feel free to fork and customize for your needs.
