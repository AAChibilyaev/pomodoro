import { Supabase } from '@flowmo/types';
import { FocusAgent } from './focus-agent';
import { BreakAgent } from './break-agent';
import { TaskAgent } from './task-agent';
import { AnalyticsAgent } from './analytics-agent';
import { Microagent, MicroagentContext, MicroagentResponse } from './types';

export class MicroagentsManager {
  private agents: Microagent[];
  private supabase: Supabase;

  constructor(supabase: Supabase) {
    this.supabase = supabase;
    this.agents = [
      new FocusAgent(),
      new BreakAgent(),
      new TaskAgent(),
      new AnalyticsAgent()
    ];
  }

  async initialize(userId: string): Promise<void> {
    // Initialization logic if needed
    console.log('Microagents manager initialized for user:', userId);
  }

  async executeAll(userId: string, currentTask?: any): Promise<Record<string, MicroagentResponse>> {
    const context = await this.buildContext(userId, currentTask);
    
    const results: Record<string, MicroagentResponse> = {};
    
    for (const agent of this.agents) {
      try {
        results[agent.name] = await agent.execute(context);
      } catch (error) {
        results[agent.name] = {
          success: false,
          message: `Agent execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }

    return results;
  }

  async executeAgent(agentName: string, userId: string, currentTask?: any): Promise<MicroagentResponse> {
    const context = await this.buildContext(userId, currentTask);
    const agent = this.agents.find(a => a.name === agentName);
    
    if (!agent) {
      return {
        success: false,
        message: `Agent "${agentName}" not found`
      };
    }

    return agent.execute(context);
  }

  private async buildContext(userId: string, currentTask?: any): Promise<MicroagentContext> {
    // Fetch user preferences
    const { data: preferences } = await this.supabase
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Fetch recent work sessions
    const { data: sessions } = await this.supabase
      .from('logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    return {
      supabase: this.supabase,
      userId,
      currentTask,
      workSessionHistory: sessions?.map(session => ({
        id: session.id.toString(),
        startTime: new Date(session.start_time),
        endTime: session.end_time ? new Date(session.end_time) : undefined,
        taskId: session.task_id?.toString(),
        taskName: session.task_name || undefined,
        focusScore: 0, // Not available in logs table
        interruptions: 0, // Not available in logs table
        completed: false // Not available in logs table
      })) || [],
      userPreferences: preferences ? {
        workDuration: 25, // Default value
        breakDuration: 5, // Default value
        longBreakDuration: 15, // Default value
        sessionsBeforeLongBreak: 4, // Default value
        autoStartBreaks: true, // Default value
        autoStartWork: false, // Default value
        notificationSound: true, // Default value
        focusMode: 'balanced' // Default value
      } : {
        workDuration: 25,
        breakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4,
        autoStartBreaks: true,
        autoStartWork: false,
        notificationSound: true,
        focusMode: 'balanced'
      }
    };
  }

  getAvailableAgents(): { name: string; description: string }[] {
    return this.agents.map(agent => ({
      name: agent.name,
      description: agent.description
    }));
  }
}