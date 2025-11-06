import { StravaClient } from '../strava-client.js';

export interface GetActivityDetailsParams {
  activity_id: string;
}

export async function getActivityDetails(
  client: StravaClient,
  params: GetActivityDetailsParams
): Promise<string> {
  const activity = await client.getActivity(params.activity_id);

  // Basic info
  const distanceKm = (activity.distance / 1000).toFixed(2);
  const durationMin = Math.floor(activity.moving_time / 60);
  const durationSec = activity.moving_time % 60;
  const avgPace = activity.distance > 0
    ? formatPace(activity.moving_time / (activity.distance / 1000))
    : 'N/A';
  const elevationM = Math.round(activity.total_elevation_gain);

  // Format splits if available
  let splits = null;
  if (activity.splits_metric && activity.splits_metric.length > 0) {
    splits = activity.splits_metric.map((split) => ({
      split: split.split,
      distance: `${(split.distance / 1000).toFixed(2)} km`,
      time: formatDuration(split.moving_time),
      pace: formatPace(split.moving_time / (split.distance / 1000)),
      elevationDiff: `${Math.round(split.elevation_difference)} m`
    }));
  }

  // Format segment efforts if available
  let segments = null;
  if (activity.segment_efforts && activity.segment_efforts.length > 0) {
    segments = activity.segment_efforts.slice(0, 10).map((effort: any) => ({
      name: effort.name,
      distance: `${(effort.distance / 1000).toFixed(2)} km`,
      time: formatDuration(effort.elapsed_time),
      achievements: effort.pr_rank ? `PR #${effort.pr_rank}` : null
    }));
  }

  const result = {
    id: activity.id,
    name: activity.name,
    type: activity.sport_type,
    date: new Date(activity.start_date).toLocaleString(),
    description: activity.description || null,
    distance: `${distanceKm} km`,
    duration: `${durationMin}:${durationSec.toString().padStart(2, '0')}`,
    pace: avgPace,
    elevation: `${elevationM} m`,
    avgHeartRate: activity.average_heartrate
      ? Math.round(activity.average_heartrate)
      : null,
    maxHeartRate: activity.max_heartrate
      ? Math.round(activity.max_heartrate)
      : null,
    calories: activity.calories || null,
    kudos: activity.kudos_count,
    splits: splits,
    segments: segments,
    hasMap: activity.map ? true : false,
    mapPolyline: activity.map?.summary_polyline || null
  };

  return JSON.stringify(result, null, 2);
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
}
