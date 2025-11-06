import fetch from 'node-fetch';

export class TokenManager {
  private accessToken: string;
  private refreshToken: string;
  private expiresAt: number;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.accessToken = process.env.STRAVA_ACCESS_TOKEN || '';
    this.refreshToken = process.env.STRAVA_REFRESH_TOKEN || '';
    this.expiresAt = parseInt(process.env.STRAVA_EXPIRES_AT || '0');
    this.clientId = process.env.STRAVA_CLIENT_ID || '';
    this.clientSecret = process.env.STRAVA_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      throw new Error('STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set');
    }

    if (!this.accessToken || !this.refreshToken) {
      throw new Error('STRAVA_ACCESS_TOKEN and STRAVA_REFRESH_TOKEN must be set. Run setup-auth.ts first.');
    }
  }

  async getValidToken(): Promise<string> {
    // If token expires within 1 hour, refresh it
    const oneHour = 60 * 60;
    const currentTime = Math.floor(Date.now() / 1000);

    if (currentTime > this.expiresAt - oneHour) {
      await this.refresh();
    }

    return this.accessToken;
  }

  private async refresh(): Promise<void> {
    console.log('Refreshing Strava access token...');

    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${response.status} ${error}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_at: number;
    };

    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.expiresAt = data.expires_at;

    // Log new tokens for manual Railway update if needed
    console.log('Token refreshed successfully');
    console.log('New tokens (update Railway env vars if needed):');
    console.log('STRAVA_ACCESS_TOKEN:', this.accessToken);
    console.log('STRAVA_REFRESH_TOKEN:', this.refreshToken);
    console.log('STRAVA_EXPIRES_AT:', this.expiresAt);
  }
}
