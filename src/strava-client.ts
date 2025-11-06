import fetch from 'node-fetch';
import { TokenManager } from './token-manager.js';

export interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  sport_type: string;
  start_date: string;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  kudos_count: number;
}

export interface StravaActivityDetails extends StravaActivity {
  description?: string;
  calories?: number;
  splits_metric?: Array<{
    distance: number;
    elapsed_time: number;
    elevation_difference: number;
    moving_time: number;
    split: number;
    average_speed: number;
    pace_zone: number;
  }>;
  laps?: Array<any>;
  segment_efforts?: Array<any>;
  map?: {
    id: string;
    summary_polyline: string;
  };
}

export interface StravaAthleteStats {
  recent_run_totals: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
  };
  recent_ride_totals: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
  };
  ytd_run_totals: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
  };
  ytd_ride_totals: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
  };
  all_run_totals: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
  };
  all_ride_totals: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
  };
}

export class StravaClient {
  private tokenManager: TokenManager;
  private baseUrl = 'https://www.strava.com/api/v3';
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheDuration = 5 * 60 * 1000; // 5 minutes

  constructor(tokenManager: TokenManager) {
    this.tokenManager = tokenManager;
  }

  private async request<T>(endpoint: string, useCache = true): Promise<T> {
    const cacheKey = endpoint;

    // Check cache
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        console.log(`Cache hit for ${endpoint}`);
        return cached.data as T;
      }
    }

    // Make request
    const token = await this.tokenManager.getValidToken();
    const url = `${this.baseUrl}${endpoint}`;

    console.log(`Fetching: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Strava API error: ${response.status} ${error}`);
    }

    const data = await response.json() as T;

    // Cache the result
    if (useCache) {
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
    }

    return data;
  }

  async getActivities(params: {
    before?: number;
    after?: number;
    page?: number;
    per_page?: number;
  }): Promise<StravaActivity[]> {
    const query = new URLSearchParams();
    if (params.before) query.append('before', params.before.toString());
    if (params.after) query.append('after', params.after.toString());
    if (params.page) query.append('page', params.page.toString());
    if (params.per_page) query.append('per_page', params.per_page.toString());

    const endpoint = `/athlete/activities?${query.toString()}`;
    return this.request<StravaActivity[]>(endpoint);
  }

  async getActivity(activityId: string): Promise<StravaActivityDetails> {
    return this.request<StravaActivityDetails>(`/activities/${activityId}`, true);
  }

  async getAthleteStats(athleteId: string): Promise<StravaAthleteStats> {
    return this.request<StravaAthleteStats>(`/athletes/${athleteId}/stats`, true);
  }

  async getLoggedInAthlete(): Promise<{ id: number }> {
    return this.request<{ id: number }>('/athlete', true);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
