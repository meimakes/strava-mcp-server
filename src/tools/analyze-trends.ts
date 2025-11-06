import { StravaClient, StravaActivity } from '../strava-client.js';

export interface AnalyzeTrendsParams {
  metric: 'pace' | 'distance' | 'elevation' | 'heart_rate';
  sport_type: string;
  weeks?: number;
}

interface WeeklyData {
  week: number;
  startDate: string;
  endDate: string;
  activities: number;
  avgValue: number;
  totalDistance: number;
}

export async function analyzeTrends(
  client: StravaClient,
  params: AnalyzeTrendsParams
): Promise<string> {
  const weeks = params.weeks || 8;

  // Calculate timestamp for N weeks ago
  const weeksAgo = new Date();
  weeksAgo.setDate(weeksAgo.getDate() - (weeks * 7));
  const afterTimestamp = Math.floor(weeksAgo.getTime() / 1000);

  // Fetch activities
  const activities = await client.getActivities({
    after: afterTimestamp,
    per_page: 200
  });

  // Filter by sport type
  const filteredActivities = activities.filter(
    (a) => a.sport_type.toLowerCase() === params.sport_type.toLowerCase()
  );

  if (filteredActivities.length === 0) {
    return JSON.stringify({
      error: `No activities found for sport type "${params.sport_type}" in the last ${weeks} weeks`
    }, null, 2);
  }

  // Group activities by week
  const weeklyData: WeeklyData[] = [];
  const now = new Date();

  for (let i = 0; i < weeks; i++) {
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() - (i * 7));
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 7);

    const weekActivities = filteredActivities.filter((a) => {
      const activityDate = new Date(a.start_date);
      return activityDate >= weekStart && activityDate < weekEnd;
    });

    if (weekActivities.length > 0) {
      let avgValue = 0;
      let totalDistance = 0;

      // Calculate metric
      switch (params.metric) {
        case 'pace':
          // Average pace in min/km
          avgValue = weekActivities.reduce((sum, a) => {
            const distanceKm = a.distance / 1000;
            const paceSecPerKm = distanceKm > 0 ? a.moving_time / distanceKm : 0;
            return sum + paceSecPerKm;
          }, 0) / weekActivities.length;
          break;

        case 'distance':
          // Total distance in km
          avgValue = weekActivities.reduce((sum, a) => sum + a.distance, 0) / 1000;
          break;

        case 'elevation':
          // Average elevation gain per activity in meters
          avgValue = weekActivities.reduce((sum, a) => sum + a.total_elevation_gain, 0) / weekActivities.length;
          break;

        case 'heart_rate':
          // Average heart rate across activities
          const activitiesWithHr = weekActivities.filter((a) => a.average_heartrate);
          avgValue = activitiesWithHr.length > 0
            ? activitiesWithHr.reduce((sum, a) => sum + (a.average_heartrate || 0), 0) / activitiesWithHr.length
            : 0;
          break;
      }

      totalDistance = weekActivities.reduce((sum, a) => sum + a.distance, 0) / 1000;

      weeklyData.push({
        week: weeks - i,
        startDate: weekStart.toLocaleDateString(),
        endDate: weekEnd.toLocaleDateString(),
        activities: weekActivities.length,
        avgValue,
        totalDistance
      });
    }
  }

  if (weeklyData.length === 0) {
    return JSON.stringify({
      error: `No data available for metric "${params.metric}" in the last ${weeks} weeks`
    }, null, 2);
  }

  // Sort by week (oldest first)
  weeklyData.sort((a, b) => a.week - b.week);

  // Calculate trend
  const firstWeek = weeklyData[0].avgValue;
  const lastWeek = weeklyData[weeklyData.length - 1].avgValue;
  const percentChange = ((lastWeek - firstWeek) / firstWeek) * 100;

  let trendDirection: string;
  if (params.metric === 'pace') {
    // For pace, lower is better
    trendDirection = percentChange < -5 ? 'improving' : percentChange > 5 ? 'declining' : 'stable';
  } else {
    // For other metrics, higher is better
    trendDirection = percentChange > 5 ? 'improving' : percentChange < -5 ? 'declining' : 'stable';
  }

  // Find best and worst weeks
  const bestWeek = weeklyData.reduce((best, week) => {
    if (params.metric === 'pace') {
      return week.avgValue < best.avgValue ? week : best;
    }
    return week.avgValue > best.avgValue ? week : best;
  });

  const worstWeek = weeklyData.reduce((worst, week) => {
    if (params.metric === 'pace') {
      return week.avgValue > worst.avgValue ? week : worst;
    }
    return week.avgValue < worst.avgValue ? week : worst;
  });

  // Format weekly data
  const formattedWeeks = weeklyData.map((week) => ({
    week: `Week ${week.week}`,
    dateRange: `${week.startDate} - ${week.endDate}`,
    activities: week.activities,
    value: formatMetric(week.avgValue, params.metric),
    totalDistance: `${week.totalDistance.toFixed(2)} km`
  }));

  const result = {
    metric: params.metric,
    sportType: params.sport_type,
    weeksAnalyzed: weeks,
    totalActivities: filteredActivities.length,
    trend: {
      direction: trendDirection,
      percentChange: `${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%`
    },
    bestWeek: {
      week: `Week ${bestWeek.week}`,
      dateRange: `${bestWeek.startDate} - ${bestWeek.endDate}`,
      value: formatMetric(bestWeek.avgValue, params.metric)
    },
    worstWeek: {
      week: `Week ${worstWeek.week}`,
      dateRange: `${worstWeek.startDate} - ${worstWeek.endDate}`,
      value: formatMetric(worstWeek.avgValue, params.metric)
    },
    weeklyBreakdown: formattedWeeks
  };

  return JSON.stringify(result, null, 2);
}

function formatMetric(value: number, metric: string): string {
  switch (metric) {
    case 'pace':
      const minutes = Math.floor(value / 60);
      const seconds = Math.round(value % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
    case 'distance':
      return `${value.toFixed(2)} km`;
    case 'elevation':
      return `${Math.round(value)} m`;
    case 'heart_rate':
      return `${Math.round(value)} bpm`;
    default:
      return value.toFixed(2);
  }
}
