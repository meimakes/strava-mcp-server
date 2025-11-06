import { StravaClient } from '../strava-client.js';

export async function getAthleteStats(client: StravaClient): Promise<string> {
  // Get the logged-in athlete ID
  const athlete = await client.getLoggedInAthlete();

  // Get athlete stats
  const stats = await client.getAthleteStats(athlete.id.toString());

  const formatStats = (totals: any, label: string) => {
    const distanceKm = (totals.distance / 1000).toFixed(2);
    const hours = Math.floor(totals.moving_time / 3600);
    const minutes = Math.floor((totals.moving_time % 3600) / 60);
    const elevationM = Math.round(totals.elevation_gain);

    return {
      label,
      count: totals.count,
      distance: `${distanceKm} km`,
      movingTime: `${hours}h ${minutes}m`,
      elevation: `${elevationM} m`
    };
  };

  const result = {
    recent: {
      description: 'Last 4 weeks',
      runs: formatStats(stats.recent_run_totals, 'Running'),
      rides: formatStats(stats.recent_ride_totals, 'Cycling')
    },
    yearToDate: {
      description: 'Year to date',
      runs: formatStats(stats.ytd_run_totals, 'Running'),
      rides: formatStats(stats.ytd_ride_totals, 'Cycling')
    },
    allTime: {
      description: 'All time',
      runs: formatStats(stats.all_run_totals, 'Running'),
      rides: formatStats(stats.all_ride_totals, 'Cycling')
    }
  };

  return JSON.stringify(result, null, 2);
}
