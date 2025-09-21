import { Microagent, MicroagentContext, MicroagentResponse } from './types';

export class AnalyticsAgent implements Microagent {
  name = 'Analytics Agent';
  description = 'Provides productivity insights and performance analytics';

  async execute(context: MicroagentContext): Promise<MicroagentResponse> {
    try {
      const insights = await this.generateProductivityInsights(context);
      
      return {
        success: true,
        message: 'Productivity insights generated',
        data: { insights },
        recommendations: insights.map(insight => insight.message)
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to generate productivity insights: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async generateProductivityInsights(context: MicroagentContext): Promise<
    Array<{ type: string; message: string; data?: any }>
  > {
    const insights: Array<{ type: string; message: string; data?: any }> = [];
    
    // Fetch work session data
    const { data: sessions } = await context.supabase
      .from('logs')
      .select('*')
      .eq('user_id', context.userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!sessions || sessions.length === 0) {
      return [{ type: 'welcome', message: 'Welcome to Flowmo! Start your first work session to get personalized insights.' }];
    }

    // Calculate daily productivity metrics
    const dailyStats = this.calculateDailyStats(sessions);
    insights.push({
      type: 'daily_summary',
      message: `Today: ${dailyStats.today.sessions} sessions, ${Math.round(dailyStats.today.totalMinutes)} minutes focused`,
      data: dailyStats.today
    });

    // Weekly trends
    const weeklyTrend = this.analyzeWeeklyTrend(sessions);
    if (weeklyTrend.trend !== 'stable') {
      insights.push({
        type: 'weekly_trend',
        message: `Your productivity is ${weeklyTrend.trend} this week compared to last week`,
        data: weeklyTrend
      });
    }

    // Best time of day analysis
    const bestTime = this.findBestProductivityTime(sessions);
    if (bestTime) {
      insights.push({
        type: 'optimal_time',
        message: `Your most productive time is ${bestTime.hour}:00-${bestTime.hour + 1}:00 with ${bestTime.avgFocus}% average focus`,
        data: bestTime
      });
    }

    // Task completion rate
    const completionRate = await this.calculateCompletionRate(context);
    insights.push({
      type: 'completion_rate',
      message: `Your task completion rate is ${completionRate.rate}%`,
      data: completionRate
    });

    // Focus score trends
    const focusTrend = this.analyzeFocusTrend(sessions);
    if (focusTrend.trend !== 'stable') {
      insights.push({
        type: 'focus_trend',
        message: `Your focus scores are ${focusTrend.trend}`,
        data: focusTrend
      });
    }

    return insights;
  }

  private calculateDailyStats(sessions: any[]): { today: any; yesterday: any } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todaySessions = sessions.filter(session => 
      new Date(session.created_at) >= today
    );
    const yesterdaySessions = sessions.filter(session => {
      const sessionDate = new Date(session.created_at);
      return sessionDate >= yesterday && sessionDate < today;
    });

    return {
      today: {
        sessions: todaySessions.length,
        totalMinutes: todaySessions.reduce((total, session) => total + (session.duration || 0), 0),
        avgFocus: todaySessions.length > 0 ? 
          todaySessions.reduce((sum, session) => sum + (session.focus_score || 0), 0) / todaySessions.length : 0
      },
      yesterday: {
        sessions: yesterdaySessions.length,
        totalMinutes: yesterdaySessions.reduce((total, session) => total + (session.duration || 0), 0),
        avgFocus: yesterdaySessions.length > 0 ? 
          yesterdaySessions.reduce((sum, session) => sum + (session.focus_score || 0), 0) / yesterdaySessions.length : 0
      }
    };
  }

  private analyzeWeeklyTrend(sessions: any[]): { trend: 'increasing' | 'decreasing' | 'stable'; change: number } {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const lastWeekSessions = sessions.filter(session => 
      new Date(session.created_at) >= oneWeekAgo
    );
    const previousWeekSessions = sessions.filter(session => {
      const sessionDate = new Date(session.created_at);
      return sessionDate >= twoWeeksAgo && sessionDate < oneWeekAgo;
    });

    const lastWeekTotal = lastWeekSessions.reduce((total, session) => total + (session.duration || 0), 0);
    const previousWeekTotal = previousWeekSessions.reduce((total, session) => total + (session.duration || 0), 0);

    const change = ((lastWeekTotal - previousWeekTotal) / Math.max(1, previousWeekTotal)) * 100;

    if (Math.abs(change) < 10) return { trend: 'stable', change };
    return { trend: change > 0 ? 'increasing' : 'decreasing', change: Math.abs(change) };
  }

  private findBestProductivityTime(sessions: any[]): { hour: number; avgFocus: number; sessionCount: number } | null {
    const hourStats: Record<number, { totalFocus: number; count: number }> = {};

    sessions.forEach(session => {
      const hour = new Date(session.created_at).getHours();
      hourStats[hour] = hourStats[hour] || { totalFocus: 0, count: 0 };
      hourStats[hour].totalFocus += session.focus_score || 0;
      hourStats[hour].count++;
    });

    let bestHour: number | null = null;
    let bestAvgFocus = 0;

    Object.entries(hourStats).forEach(([hour, stats]) => {
      const avgFocus = stats.totalFocus / stats.count;
      if (avgFocus > bestAvgFocus && stats.count >= 3) {
        bestAvgFocus = avgFocus;
        bestHour = parseInt(hour);
      }
    });

    return bestHour !== null ? { hour: bestHour, avgFocus: bestAvgFocus, sessionCount: hourStats[bestHour].count } : null;
  }

  private async calculateCompletionRate(context: MicroagentContext): Promise<{ rate: number; total: number; completed: number }> {
    const { data: allTasks } = await context.supabase
      .from('tasks')
      .select('id, completed')
      .eq('user_id', context.userId);

    if (!allTasks) return { rate: 0, total: 0, completed: 0 };

    const completed = allTasks.filter(task => task.completed).length;
    const total = allTasks.length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { rate, total, completed };
  }

  private analyzeFocusTrend(sessions: any[]): { trend: 'improving' | 'declining' | 'stable'; change: number } {
    if (sessions.length < 10) return { trend: 'stable', change: 0 };

    const recentSessions = sessions.slice(0, 10);
    const olderSessions = sessions.slice(10, 20);

    const recentAvg = recentSessions.reduce((sum, session) => sum + (session.focus_score || 0), 0) / recentSessions.length;
    const olderAvg = olderSessions.reduce((sum, session) => sum + (session.focus_score || 0), 0) / olderSessions.length;

    const change = ((recentAvg - olderAvg) / Math.max(1, olderAvg)) * 100;

    if (Math.abs(change) < 5) return { trend: 'stable', change };
    return { trend: change > 0 ? 'improving' : 'declining', change: Math.abs(change) };
  }
}