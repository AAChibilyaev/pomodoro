import { Supabase, Task } from '@flowmo/types';

export interface MicroagentContext {
  supabase: Supabase;
  userId: string;
  currentTask?: Task;
  workSessionHistory: WorkSession[];
  userPreferences: UserPreferences;
}

export interface WorkSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  taskId?: string;
  taskName?: string;
  focusScore?: number;
  interruptions: number;
  completed: boolean;
}

export interface UserPreferences {
  workDuration: number; // minutes
  breakDuration: number; // minutes
  longBreakDuration: number; // minutes
  sessionsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
  notificationSound: boolean;
  focusMode: 'deep' | 'balanced' | 'light';
}

export interface MicroagentResponse {
  success: boolean;
  message: string;
  data?: any;
  recommendations?: string[];
}

export interface Microagent {
  name: string;
  description: string;
  
  execute(context: MicroagentContext): Promise<MicroagentResponse>;
}

export interface FocusRecommendation {
  type: 'task_prioritization' | 'time_blocking' | 'distraction_avoidance';
  message: string;
  confidence: number;
  action?: string;
}

export interface BreakRecommendation {
  type: 'micro_break' | 'stretch_break' | 'eye_break' | 'mental_break';
  message: string;
  duration: number; // minutes
  confidence: number;
  activities?: string[];
}