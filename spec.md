# Strava MCP Server - Simplified Single-User Version

## Overview

Single-user MCP server for Strava data, matching your existing Hevy/Oura/Amazon architecture.

## Core Architecture

### Tech Stack

- **Runtime**: Node.js/TypeScript
- **Framework**: MCP SDK (@modelcontextprotocol/sdk)
- **Transport**: SSE (Server-Sent Events)
- **API Client**: node-fetch
- **Deployment**: Railway
- **Token Storage**: Environment variables (no database!)
- **Auth**: OAuth 2.0 (one-time setup)

### Repository Structure

```
strava-mcp/
├── src/
│   ├── index.ts                 # MCP server entry + SSE setup
│   ├── strava-client.ts         # Strava API wrapper
│   ├── token-manager.ts         # Auto-refresh from env vars
│   └── tools/
│       ├── get-activities.ts
│       ├── get-activity-details.ts
│       ├── get-athlete-stats.ts
│       └── analyze-performance.ts
├── railway.json
├── package.json
├── tsconfig.json
└── README.md
```

## MCP Tools

### 1. `strava_get_activities`

**Description**: List your recent activities
**Parameters**:

- `days_back` (number): Activities from last N days (default: 30)
- `sport_type` (optional): “Run”, “Ride”, “WeightTraining”, etc.
- `limit` (number): Max activities (default: 30)

**Returns**: Activity summaries with distance, time, pace, elevation, heart rate

### 2. `strava_get_activity_details`

**Description**: Get detailed info for a specific activity
**Parameters**:

- `activity_id` (string): Strava activity ID

**Returns**: Full details including splits, laps, segment efforts, map

### 3. `strava_get_athlete_stats`

**Description**: Your all-time stats
**Returns**:

- Recent totals (last 4 weeks)
- Year-to-date totals
- All-time totals
- Breakdown by sport type

### 4. `strava_search_activities`

**Description**: Find activities matching criteria
**Parameters**:

- `sport_type` (string): Filter by activity type
- `min_distance` (meters): Minimum distance
- `min_time` (seconds): Minimum moving time
- `start_date` (ISO date): Activities after this date
- `end_date` (ISO date): Activities before this date

**Returns**: Filtered activities

### 5. `strava_analyze_trends`

**Description**: Analyze performance over time
**Parameters**:

- `metric`: “pace” | “distance” | “elevation” | “heart_rate”
- `sport_type`: Activity type to analyze
- `weeks`: Number of weeks to analyze (default: 8)

**Returns**:

- Weekly averages
- Trend direction (improving/stable/declining)
- Best/worst weeks
- Percent change

## OAuth Setup (One-Time)

### 1. Create Strava App

1. Go to <https://www.strava.com/settings/api>
2. Create new app:

- **App Name**: “Mei’s Personal MCP”
- **Category**: Fitness App
- **Authorization Callback**: `http://localhost:3000/auth/callback` (for initial setup)

1. Note your **Client ID** and **Client Secret**

### 2. Get Initial Tokens (Run Locally Once)

```typescript
// setup-auth.ts - run this once locally
const CLIENT_ID = 'your_client_id';
const CLIENT_SECRET = 'your_client_secret';
const REDIRECT_URI = 'http://localhost:3000/auth/callback';

// 1. Visit this URL in browser:
console.log(`https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&approval_prompt=force&scope=activity:read_all`);

// 2. After authorizing, you'll be redirected to:
// http://localhost:3000/auth/callback?code=XXXXX

// 3. Exchange code for tokens:
const response = await fetch('https://www.strava.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code: 'XXXXX', // from URL
    grant_type: 'authorization_code'
  })
});

const data = await response.json();
console.log('Access Token:', data.access_token);
console.log('Refresh Token:', data.refresh_token);
console.log('Expires At:', data.expires_at);
```

### 3. Add Tokens to Railway

Set these environment variables in Railway:

```bash
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_ACCESS_TOKEN=your_access_token
STRAVA_REFRESH_TOKEN=your_refresh_token
STRAVA_EXPIRES_AT=1234567890
```

## Token Auto-Refresh

```typescript
// token-manager.ts
export class TokenManager {
  private accessToken: string;
  private refreshToken: string;
  private expiresAt: number;

  constructor() {
    this.accessToken = process.env.STRAVA_ACCESS_TOKEN!;
    this.refreshToken = process.env.STRAVA_REFRESH_TOKEN!;
    this.expiresAt = parseInt(process.env.STRAVA_EXPIRES_AT!);
  }

  async getValidToken(): Promise<string> {
    // If token expires within 1 hour, refresh it
    const oneHour = 60 * 60;
    if (Date.now() / 1000 > this.expiresAt - oneHour) {
      await this.refresh();
    }
    return this.accessToken;
  }

  private async refresh() {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token'
      })
    });

    const data = await response.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token; // Strava returns new refresh token
    this.expiresAt = data.expires_at;

    // Log new tokens (you'll manually update Railway env vars if needed)
    console.log('Token refreshed:', {
      access_token: this.accessToken,
      refresh_token: this.refreshToken,
      expires_at: this.expiresAt
    });
  }
}
```

## SSE Implementation

```typescript
// index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";

const app = express();
app.use(express.json());

const server = new Server(
  {
    name: "strava-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "strava_get_activities",
      description: "List your recent Strava activities",
      inputSchema: {
        type: "object",
        properties: {
          days_back: { type: "number", description: "Days to look back" },
          sport_type: { type: "string", description: "Filter by sport type" },
          limit: { type: "number", description: "Max activities" }
        }
      }
    },
    // ... other tools
  ]
}));

// SSE endpoint
app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/message", res);
  await server.connect(transport);
});

app.post("/message", async (req, res) => {
  // Handle incoming MCP messages
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Strava MCP server running on port ${PORT}`);
});
```

## Railway Deployment

### railway.json

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### package.json

```json
{
  "name": "strava-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "express": "^4.18.2",
    "node-fetch": "^3.3.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### Environment Variables (Railway)

```bash
# Strava OAuth
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_ACCESS_TOKEN=initial_access_token
STRAVA_REFRESH_TOKEN=initial_refresh_token
STRAVA_EXPIRES_AT=1234567890

# Server
PORT=3000
NODE_ENV=production
```

## Rate Limiting Strategy

Strava limits: 100 req/15min, 1000 req/day

```typescript
// Simple in-memory cache
const cache = new Map();

async function getCachedActivities(days: number) {
  const key = `activities_${days}`;
  const cached = cache.get(key);
  
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 min cache
    return cached.data;
  }
  
  const data = await fetchFromStrava();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```
