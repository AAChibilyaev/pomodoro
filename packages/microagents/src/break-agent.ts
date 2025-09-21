import { Microagent, MicroagentContext, MicroagentResponse, BreakRecommendation } from './types';

export class BreakAgent implements Microagent {
  name = 'Break Agent';
  description = 'Provides intelligent break recommendations and wellness suggestions';

  async execute(context: MicroagentContext): Promise<MicroagentResponse> {
    try {
      const recommendations = await this.generateBreakRecommendations(context);
      
      return {
        success: true,
        message: 'Break recommendations generated',
        data: { recommendations },
        recommendations: recommendations.map(rec => rec.message)
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to generate break recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async generateBreakRecommendations(context: MicroagentContext): Promise<BreakRecommendation[]> {
    const recommendations: BreakRecommendation[] = [];
    const recentSessions = context.workSessionHistory
      .filter(session => session.endTime && new Date().getTime() - session.endTime.getTime() < 8 * 60 * 60 * 1000);

    // Check if user needs a break based on recent work patterns
    const consecutiveSessions = this.countConsecutiveSessions(recentSessions);
    
    if (consecutiveSessions >= 3) {
      recommendations.push({
        type: 'mental_break',
        message: `You've completed ${consecutiveSessions} consecutive work sessions. Take a longer break to recharge.`,
        duration: context.userPreferences.longBreakDuration,
        confidence: 0.9,
        activities: ['Meditate for 5 minutes', 'Take a short walk', 'Do some light stretching']
      });
    }

    // Check for eye strain patterns
    const totalScreenTime = recentSessions.reduce((total, session) => {
      const duration = session.endTime ? (session.endTime.getTime() - session.startTime.getTime()) / 60000 : 0;
      return total + duration;
    }, 0);

    if (totalScreenTime > 120) { // 2 hours
      recommendations.push({
        type: 'eye_break',
        message: `You've been working for over 2 hours. Give your eyes a rest with the 20-20-20 rule.`,
        duration: 2,
        confidence: 0.8,
        activities: ['Look at something 20 feet away for 20 seconds', 'Blink frequently', 'Use eye drops if needed']
      });
    }

    // Physical activity recommendation
    const sedentaryTime = this.calculateSedentaryTime(recentSessions);
    if (sedentaryTime > 60) {
      recommendations.push({
        type: 'stretch_break',
        message: `You've been sitting for ${Math.round(sedentaryTime)} minutes. Time to stretch and move around!`,
        duration: 5,
        confidence: 0.7,
        activities: ['Neck rolls and shoulder shrugs', 'Stand up and walk around', 'Do some light stretching exercises']
      });
    }

    // Micro-break suggestion for focus maintenance
    if (recentSessions.length > 0 && recentSessions[0].focusScore && recentSessions[0].focusScore < 60) {
      recommendations.push({
        type: 'micro_break',
        message: 'Your focus score is dropping. A quick micro-break might help refresh your concentration.',
        duration: 1,
        confidence: 0.6,
        activities: ['Take 3 deep breaths', 'Drink some water', 'Look away from the screen for a moment']
      });
    }

    return recommendations;
  }

  private countConsecutiveSessions(sessions: any[]): number {
    if (sessions.length === 0) return 0;
    
    let count = 1;
    for (let i = 1; i < sessions.length; i++) {
      const timeDiff = sessions[i-1].endTime.getTime() - sessions[i].startTime.getTime();
      if (timeDiff < 5 * 60 * 1000) { // Less than 5 minutes between sessions
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  private calculateSedentaryTime(sessions: any[]): number {
    if (sessions.length === 0) return 0;
    
    const now = new Date();
    const lastBreak = sessions[sessions.length - 1]?.endTime;
    
    if (!lastBreak) return 0;
    
    return (now.getTime() - lastBreak.getTime()) / 60000; // minutes
  }
}