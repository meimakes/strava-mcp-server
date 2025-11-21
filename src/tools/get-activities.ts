import { StravaClient } from '../strava-client.js';

export interface GetActivitiesParams {
  days_back?: number;
  sport_type?: string;
  limit?: number;
}

export async function getActivities(
  client: StravaClient,
  params: GetActivitiesParams
): Promise<string> {
  const daysBack = params.days_back || 90; // Changed from 30 to 90 to match search-activities
  const limit = params.limit || 30;
  const sportType = params.sport_type;

  // Calculate timestamp for N days ago
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - daysBack);
  const afterTimestamp = Math.floor(daysAgo.getTime() / 1000);

  console.log(`Fetching activities: days_back=${daysBack}, limit=${limit}, sport_type=${sportType || 'all'}, after_timestamp=${afterTimestamp}`);

  // Fetch activities
  const activities = await client.getActivities({
    after: afterTimestamp,
    per_page: limit
  });

  console.log(`API returned ${activities.length} activities`);

  // Filter by sport type if specified
  let filteredActivities = activities;
  if (sportType) {
    filteredActivities = activities.filter(
      (a) => a.sport_type.toLowerCase() === sportType.toLowerCase()
    );
    console.log(`After sport_type filter: ${filteredActivities.length} activities (looking for "${sportType}")`);

    // Debug: show all unique sport types in the results
    const uniqueSportTypes = [...new Set(activities.map(a => a.sport_type))];
    console.log(`Available sport types in results: ${uniqueSportTypes.join(', ')}`);
  }

  if (filteredActivities.length === 0) {
    return `No activities found in the last ${daysBack} days${sportType ? ` for sport type "${sportType}"` : ''}.`;
  }

  // Format activities for display
  const formattedActivities = filteredActivities.map((activity) => {
    const distanceKm = (activity.distance / 1000).toFixed(2);
    const durationMin = Math.floor(activity.moving_time / 60);
    const durationSec = activity.moving_time % 60;
    const avgPace = activity.distance > 0
      ? formatPace(activity.moving_time / (activity.distance / 1000))
      : 'N/A';
    const elevationM = Math.round(activity.total_elevation_gain);
    const avgHr = activity.average_heartrate
      ? Math.round(activity.average_heartrate)
      : 'N/A';

    return {
      id: activity.id,
      name: activity.name,
      type: activity.sport_type,
      date: new Date(activity.start_date).toLocaleDateString(),
      distance: `${distanceKm} km`,
      duration: `${durationMin}:${durationSec.toString().padStart(2, '0')}`,
      pace: avgPace,
      elevation: `${elevationM} m`,
      avgHeartRate: avgHr,
      kudos: activity.kudos_count
    };
  });

  return JSON.stringify({
    summary: `Found ${filteredActivities.length} activities in the last ${daysBack} days${sportType ? ` for sport type "${sportType}"` : ''}`,
    activities: formattedActivities
  }, null, 2);
}

function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
}
