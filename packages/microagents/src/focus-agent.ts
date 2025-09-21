import { Microagent, MicroagentContext, MicroagentResponse, FocusRecommendation } from './types';

export class FocusAgent implements Microagent {
  name = 'Focus Agent';
  description = 'Provides intelligent focus recommendations and distraction prevention';

  async execute(context: MicroagentContext): Promise<MicroagentResponse> {
    try {
      const recommendations = await this.generateFocusRecommendations(context);
      
      return {
        success: true,
        message: 'Focus recommendations generated',
        data: { recommendations },
        recommendations: recommendations.map(rec => rec.message)
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to generate focus recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async generateFocusRecommendations(context: MicroagentContext): Promise<FocusRecommendation[]> {
    const recommendations: FocusRecommendation[] = [];
    const recentSessions = context.workSessionHistory
      .filter(session => session.endTime && new Date().getTime() - session.endTime.getTime() < 24 * 60 * 60 * 1000)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    // Analyze focus patterns
    const avgFocusScore = recentSessions.reduce((sum, session) => sum + (session.focusScore || 0), 0) / 
                         Math.max(1, recentSessions.length);
    
    if (avgFocusScore < 70) {
      recommendations.push({
        type: 'distraction_avoidance',
        message: 'Your recent focus scores are lower than usual. Consider enabling "Do Not Disturb" mode during work sessions.',
        confidence: 0.8,
        action: 'enable_dnd'
      });
    }

    // Check for task switching patterns
    const taskSwitches = this.analyzeTaskSwitching(recentSessions);
    if (taskSwitches > 3) {
      recommendations.push({
        type: 'task_prioritization',
        message: `You've switched tasks ${taskSwitches} times recently. Try focusing on one task at a time for better productivity.`,
        confidence: 0.7,
        action: 'single_task_focus'
      });
    }

    // Time blocking recommendation based on historical patterns
    const optimalWorkTime = this.calculateOptimalWorkTime(recentSessions);
    if (optimalWorkTime) {
      recommendations.push({
        type: 'time_blocking',
        message: `Based on your patterns, ${optimalWorkTime} seems to be your most productive time. Schedule important tasks then.`,
        confidence: 0.6
      });
    }

    return recommendations;
  }

  private analyzeTaskSwitching(sessions: any[]): number {
    let switches = 0;
    let lastTaskId: string | undefined;
    
    for (const session of sessions) {
      if (session.taskId && session.taskId !== lastTaskId) {
        switches++;
        lastTaskId = session.taskId;
      }
    }
    
    return switches;
  }

  private calculateOptimalWorkTime(sessions: any[]): string | null {
    if (sessions.length === 0) return null;
    
    const hourCounts: Record<number, number> = {};
    sessions.forEach(session => {
      const hour = session.startTime.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const mostFrequentHour = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
    
    return mostFrequentHour ? `${mostFrequentHour}:00 - ${parseInt(mostFrequentHour) + 1}:00` : null;
  }
}