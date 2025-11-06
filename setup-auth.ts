#!/usr/bin/env node

/**
 * Strava OAuth Setup Script
 *
 * This script helps you obtain the initial OAuth tokens from Strava.
 * Run this once locally to get the tokens, then add them to Railway environment variables.
 *
 * Usage:
 *   1. Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET environment variables
 *   2. Run: npm run setup-auth
 *   3. Follow the prompts to authorize the app
 *   4. Copy the tokens to Railway environment variables
 */

import * as readline from 'readline';
import * as http from 'http';
import fetch from 'node-fetch';

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/auth/callback';
const PORT = 3000;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set');
  console.error('\nSet them by running:');
  console.error('  export STRAVA_CLIENT_ID=your_client_id');
  console.error('  export STRAVA_CLIENT_SECRET=your_client_secret');
  process.exit(1);
}

console.log('\n=== Strava OAuth Setup ===\n');
console.log('Step 1: Visit this URL in your browser to authorize the app:\n');

const authUrl = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&approval_prompt=force&scope=activity:read_all`;
console.log(authUrl);

console.log('\nStep 2: After authorizing, you will be redirected to a callback URL.');
console.log('Starting local server to capture the authorization code...\n');

// Create a simple HTTP server to capture the callback
const server = http.createServer(async (req, res) => {
  if (req.url?.startsWith('/auth/callback')) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<h1>Error: ${error}</h1><p>Authorization failed. Please try again.</p>`);
      console.error(`\nError: ${error}`);
      server.close();
      process.exit(1);
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>Error: No authorization code received</h1>');
      console.error('\nError: No authorization code received');
      server.close();
      process.exit(1);
    }

    console.log('\nAuthorization code received! Exchanging for tokens...\n');

    try {
      // Exchange code for tokens
      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
      }

      const data = await response.json() as {
        access_token: string;
        refresh_token: string;
        expires_at: number;
        athlete: { id: number; username: string };
      };

      console.log('✓ Successfully obtained tokens!\n');
      console.log('=== Copy these values to your Railway environment variables ===\n');
      console.log(`STRAVA_CLIENT_ID=${CLIENT_ID}`);
      console.log(`STRAVA_CLIENT_SECRET=${CLIENT_SECRET}`);
      console.log(`STRAVA_ACCESS_TOKEN=${data.access_token}`);
      console.log(`STRAVA_REFRESH_TOKEN=${data.refresh_token}`);
      console.log(`STRAVA_EXPIRES_AT=${data.expires_at}`);
      console.log('\n=== Additional Info ===\n');
      console.log(`Athlete ID: ${data.athlete.id}`);
      console.log(`Username: ${data.athlete.username}`);
      console.log(`Token expires: ${new Date(data.expires_at * 1000).toLocaleString()}`);

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <h1>✓ Authorization Successful!</h1>
        <p>Tokens have been generated. Check your terminal for the values to add to Railway.</p>
        <p>You can close this window now.</p>
      `);

      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 1000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`\nError exchanging code for tokens: ${errorMessage}`);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<h1>Error</h1><p>${errorMessage}</p>`);
      server.close();
      process.exit(1);
    }
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
  console.log('Waiting for authorization...\n');
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\nSetup cancelled.');
  server.close();
  process.exit(0);
});
