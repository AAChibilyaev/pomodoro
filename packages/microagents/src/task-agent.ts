import { Microagent, MicroagentContext, MicroagentResponse } from './types';

export class TaskAgent implements Microagent {
  name = 'Task Agent';
  description = 'Provides intelligent task management and prioritization suggestions';

  async execute(context: MicroagentContext): Promise<MicroagentResponse> {
    try {
      const recommendations = await this.generateTaskRecommendations(context);
      
      return {
        success: true,
        message: 'Task recommendations generated',
        data: { recommendations },
        recommendations: recommendations
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to generate task recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async generateTaskRecommendations(context: MicroagentContext): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Fetch user's tasks from the database
    const { data: tasks, error } = await context.supabase
      .from('tasks')
      .select('*')
      .eq('user_id', context.userId)
      .eq('completed', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      return ['Unable to analyze tasks at this time'];
    }

    if (!tasks || tasks.length === 0) {
      return ['No active tasks found. Consider adding some tasks to get started!'];
    }

    // Analyze task completion patterns
    const completionStats = await this.analyzeCompletionPatterns(context, tasks);
    
    if (completionStats.avgCompletionTime > 120) { // More than 2 hours average
      recommendations.push(`Your tasks take about ${Math.round(completionStats.avgCompletionTime)} minutes on average. Consider breaking larger tasks into smaller subtasks.`);
    }

    // Check for overdue tasks - due dates not implemented yet
    const overdueTasks: any[] = [];

    if (overdueTasks.length > 0) {
      recommendations.push(`You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}. Consider prioritizing these or adjusting their due dates.`);
    }

    // Suggest task batching based on categories or contexts
    const taskCategories = this.analyzeTaskCategories(tasks);
    if (Object.keys(taskCategories).length >= 3) {
      const largestCategory = Object.entries(taskCategories)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (largestCategory && largestCategory[1] >= 3) {
        recommendations.push(`You have ${largestCategory[1]} tasks in "${largestCategory[0]}". Consider batching similar tasks together for better efficiency.`);
      }
    }

    // Time-based task suggestions
    const currentHour = new Date().getHours();
    if (currentHour >= 9 && currentHour <= 11) {
      recommendations.push('Morning hours are great for tackling your most important tasks. Consider working on high-priority items now.');
    } else if (currentHour >= 14 && currentHour <= 16) {
      recommendations.push('Afternoon slump time! This might be a good time for routine tasks or taking a break.');
    }

    return recommendations;
  }

  private async analyzeCompletionPatterns(context: MicroagentContext, tasks: any[]): Promise<{
    avgCompletionTime: number;
    completionRate: number;
  }> {
    // Fetch completed tasks to analyze patterns
    const { data: completedTasks } = await context.supabase
      .from('tasks')
      .select('*')
      .eq('user_id', context.userId)
      .eq('completed', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!completedTasks || completedTasks.length === 0) {
      return { avgCompletionTime: 0, completionRate: 0 };
    }

    // Simplified analysis since we don't have completion timestamps
    const completionRate = (completedTasks.length / (completedTasks.length + tasks.length)) * 100;

    return {
      avgCompletionTime: 30, // Default estimate since we can't calculate actual time
      completionRate
    };
  }

  private analyzeTaskCategories(tasks: any[]): Record<string, number> {
    const categories: Record<string, number> = {};
    
    tasks.forEach(task => {
      // Simple category extraction from task names
      const words = task.name.toLowerCase().split(/\s+/);
      const commonCategories = ['email', 'meeting', 'coding', 'design', 'research', 'writing', 'review', 'call'];
      
      const foundCategory = words.find((word: string) => commonCategories.includes(word));
      if (foundCategory) {
        categories[foundCategory] = (categories[foundCategory] || 0) + 1;
      }
    });

    return categories;
  }
}