import { StravaClient } from '../strava-client.js';

export interface SearchActivitiesParams {
  sport_type?: string;
  min_distance?: number; // meters
  min_time?: number; // seconds
  start_date?: string; // ISO date
  end_date?: string; // ISO date
}

export async function searchActivities(
  client: StravaClient,
  params: SearchActivitiesParams
): Promise<string> {
  // Calculate timestamps
  let afterTimestamp: number | undefined;
  let beforeTimestamp: number | undefined;

  if (params.start_date) {
    afterTimestamp = Math.floor(new Date(params.start_date).getTime() / 1000);
  }

  if (params.end_date) {
    beforeTimestamp = Math.floor(new Date(params.end_date).getTime() / 1000);
  }

  // If no date range specified, default to last 90 days
  if (!afterTimestamp && !beforeTimestamp) {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    afterTimestamp = Math.floor(ninetyDaysAgo.getTime() / 1000);
  }

  // Fetch activities
  const activities = await client.getActivities({
    after: afterTimestamp,
    before: beforeTimestamp,
    per_page: 100
  });

  // Apply filters
  let filteredActivities = activities;

  if (params.sport_type) {
    filteredActivities = filteredActivities.filter(
      (a) => a.sport_type.toLowerCase() === params.sport_type!.toLowerCase()
    );
  }

  if (params.min_distance) {
    filteredActivities = filteredActivities.filter(
      (a) => a.distance >= params.min_distance!
    );
  }

  if (params.min_time) {
    filteredActivities = filteredActivities.filter(
      (a) => a.moving_time >= params.min_time!
    );
  }

  if (filteredActivities.length === 0) {
    return JSON.stringify({
      summary: 'No activities found matching the search criteria.',
      filters: params,
      count: 0,
      activities: []
    }, null, 2);
  }

  // Format activities
  const formattedActivities = filteredActivities.map((activity) => ({
    id: activity.id,
    name: activity.name,
    type: activity.sport_type,
    date: new Date(activity.start_date).toLocaleDateString(),
    distance: `${(activity.distance / 1000).toFixed(2)} km`,
    duration: formatDuration(activity.moving_time),
    elevation: `${Math.round(activity.total_elevation_gain)} m`,
    avgHeartRate: activity.average_heartrate
      ? Math.round(activity.average_heartrate)
      : null
  }));

  return JSON.stringify({
    summary: `Found ${filteredActivities.length} activities matching the criteria`,
    filters: params,
    count: filteredActivities.length,
    activities: formattedActivities
  }, null, 2);
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
