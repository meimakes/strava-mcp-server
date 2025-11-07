#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import { randomUUID } from 'crypto';
import { TokenManager } from './token-manager.js';
import { StravaClient } from './strava-client.js';
import { getActivities, GetActivitiesParams } from './tools/get-activities.js';
import { getActivityDetails, GetActivityDetailsParams } from './tools/get-activity-details.js';
import { getAthleteStats } from './tools/get-athlete-stats.js';
import { searchActivities, SearchActivitiesParams } from './tools/search-activities.js';
import { analyzeTrends, AnalyzeTrendsParams } from './tools/analyze-trends.js';

// Initialize token manager and Strava client
let tokenManager: TokenManager;
let stravaClient: StravaClient;

try {
  tokenManager = new TokenManager();
  stravaClient = new StravaClient(tokenManager);
  console.log('Strava MCP server initialized');
} catch (error) {
  console.error('Failed to initialize:', error);
  process.exit(1);
}

// Store recent webhook events in memory (last 100 events)
interface WebhookEvent {
  type: string;
  activityId: number;
  athleteId: number;
  timestamp: number;
  eventTime: number;
}

const recentEvents: WebhookEvent[] = [];

function addWebhookEvent(type: string, activityId: number, athleteId: number, eventTime: number) {
  recentEvents.unshift({
    type,
    activityId,
    athleteId,
    timestamp: Date.now(),
    eventTime: eventTime * 1000, // Convert to milliseconds
  });
  if (recentEvents.length > 100) {
    recentEvents.pop();
  }
  console.log(`Added webhook event: ${type} for activity ${activityId}`);
}

// Create MCP server
const server = new Server(
  {
    name: 'strava-mcp',
    version: '1.0.0',
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
      name: 'strava_get_activities',
      description: 'List your recent Strava activities with filters for date range and sport type',
      inputSchema: {
        type: 'object',
        properties: {
          days_back: {
            type: 'number',
            description: 'Number of days to look back (default: 30)',
          },
          sport_type: {
            type: 'string',
            description: 'Filter by sport type (e.g., "Run", "Ride", "WeightTraining")',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of activities to return (default: 30)',
          },
        },
      },
    },
    {
      name: 'strava_get_activity_details',
      description: 'Get detailed information for a specific activity including splits, segments, and map data',
      inputSchema: {
        type: 'object',
        properties: {
          activity_id: {
            type: 'string',
            description: 'The Strava activity ID',
          },
        },
        required: ['activity_id'],
      },
    },
    {
      name: 'strava_get_athlete_stats',
      description: 'Get your all-time Strava statistics including recent, year-to-date, and all-time totals',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'strava_search_activities',
      description: 'Search for activities matching specific criteria like distance, time, or date range',
      inputSchema: {
        type: 'object',
        properties: {
          sport_type: {
            type: 'string',
            description: 'Filter by sport type (e.g., "Run", "Ride")',
          },
          min_distance: {
            type: 'number',
            description: 'Minimum distance in meters',
          },
          min_time: {
            type: 'number',
            description: 'Minimum moving time in seconds',
          },
          start_date: {
            type: 'string',
            description: 'Start date in ISO format (YYYY-MM-DD)',
          },
          end_date: {
            type: 'string',
            description: 'End date in ISO format (YYYY-MM-DD)',
          },
        },
      },
    },
    {
      name: 'strava_analyze_trends',
      description: 'Analyze performance trends over time for specific metrics',
      inputSchema: {
        type: 'object',
        properties: {
          metric: {
            type: 'string',
            enum: ['pace', 'distance', 'elevation', 'heart_rate'],
            description: 'The metric to analyze',
          },
          sport_type: {
            type: 'string',
            description: 'Activity type to analyze (e.g., "Run", "Ride")',
          },
          weeks: {
            type: 'number',
            description: 'Number of weeks to analyze (default: 8)',
          },
        },
        required: ['metric', 'sport_type'],
      },
    },
    {
      name: 'strava_get_recent_events',
      description: 'Get recent webhook events from Strava (activity creates, updates, deletes)',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of recent events to return (default: 10, max: 100)',
          },
        },
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'strava_get_activities': {
        const params = (args || {}) as unknown as GetActivitiesParams;
        const result = await getActivities(stravaClient, params);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'strava_get_activity_details': {
        const params = (args || {}) as unknown as GetActivityDetailsParams;
        const result = await getActivityDetails(stravaClient, params);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'strava_get_athlete_stats': {
        const result = await getAthleteStats(stravaClient);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'strava_search_activities': {
        const params = (args || {}) as unknown as SearchActivitiesParams;
        const result = await searchActivities(stravaClient, params);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'strava_analyze_trends': {
        const params = (args || {}) as unknown as AnalyzeTrendsParams;
        const result = await analyzeTrends(stravaClient, params);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'strava_get_recent_events': {
        const limit = (args as any)?.limit || 10;
        const events = recentEvents.slice(0, Math.min(limit, 100));

        const formattedEvents = events.map((event) => ({
          type: event.type,
          activityId: event.activityId,
          athleteId: event.athleteId,
          eventTime: new Date(event.eventTime).toISOString(),
          receivedAt: new Date(event.timestamp).toISOString(),
        }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              count: formattedEvents.length,
              events: formattedEvents,
            }, null, 2),
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Determine transport mode based on environment
const useSSE = process.env.USE_SSE === 'true' || process.env.PORT;

if (useSSE) {
  // SSE mode for Railway deployment
  const app = express();
  app.use(express.json());

  // CORS middleware to allow Poke.com and other clients to connect
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    next();
  });

  // Store active transports by session ID
  const transports = new Map<string, StreamableHTTPServerTransport>();

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', server: 'strava-mcp', version: '1.0.0' });
  });

  // Webhook validation endpoint (Strava calls this once during subscription setup)
  app.get('/webhook/strava', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log(`Webhook verification request - mode: ${mode}, token: ${token}`);

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      console.log('Webhook verification successful');
      res.json({ 'hub.challenge': challenge });
    } else {
      console.log('Webhook verification failed');
      res.status(403).send('Forbidden');
    }
  });

  // Webhook event receiver (Strava POSTs here when events happen)
  app.post('/webhook/strava', (req, res) => {
    const event = req.body;

    console.log('Received Strava webhook event:', JSON.stringify(event, null, 2));

    // Event structure:
    // {
    //   aspect_type: "create" | "update" | "delete",
    //   event_time: 1549560669,
    //   object_id: 1234567890,  // activity ID
    //   object_type: "activity" | "athlete",
    //   owner_id: 134815,        // athlete ID
    //   subscription_id: 120475,
    //   updates: { ... }         // for updates only
    // }

    if (event.object_type === 'activity' && event.object_id) {
      addWebhookEvent(event.aspect_type, event.object_id, event.owner_id, event.event_time);
    } else if (event.object_type === 'athlete') {
      console.log(`Athlete event: ${event.aspect_type} for athlete ${event.owner_id}`);
    }

    res.status(200).send('EVENT_RECEIVED');
  });

  // SSE endpoint - handles GET, POST, and DELETE using StreamableHTTPServerTransport
  app.all('/sse', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    console.log(`${req.method} /sse - Session: ${sessionId || 'new'}`);

    // Get existing transport or create new one
    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport) {
      // Create new transport for this session
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          console.log(`Session initialized: ${id}`);
          if (transport) {
            transports.set(id, transport);
          }
        },
        onsessionclosed: (id) => {
          console.log(`Session closed: ${id}`);
          transports.delete(id);
        },
      });

      // Connect the transport to the server
      await server.connect(transport);
    }

    // Handle the request
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling request:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Strava MCP server running on port ${PORT}`);
    console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
} else {
  // Stdio mode for local development
  console.log('Starting Strava MCP server in stdio mode');
  const transport = new StdioServerTransport();
  server.connect(transport).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
