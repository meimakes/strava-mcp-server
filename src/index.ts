#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
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
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'strava_get_activities': {
        const params = args as GetActivitiesParams;
        const result = await getActivities(stravaClient, params);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'strava_get_activity_details': {
        const params = args as GetActivityDetailsParams;
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
        const params = args as SearchActivitiesParams;
        const result = await searchActivities(stravaClient, params);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'strava_analyze_trends': {
        const params = args as AnalyzeTrendsParams;
        const result = await analyzeTrends(stravaClient, params);
        return {
          content: [{ type: 'text', text: result }],
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

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', server: 'strava-mcp', version: '1.0.0' });
  });

  // SSE endpoint
  app.get('/sse', async (req, res) => {
    console.log('Client connected via SSE');
    const transport = new SSEServerTransport('/message', res);
    await server.connect(transport);
  });

  // Message endpoint
  app.post('/message', async (req, res) => {
    // SSE transport handles the messages internally
    res.status(200).end();
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
