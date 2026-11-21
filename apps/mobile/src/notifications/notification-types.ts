export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';

export interface NotificationListItem {
  id: string;
  type: string;
  priority: NotificationPriority;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface NotificationListResult {
  unread_count: number;
  notifications: NotificationListItem[];
  meta: { page: number; per_page: number; total: number };
}

export type ScheduleRepeatType = 'NEVER' | 'EVERY_N_DAYS' | 'WEEKLY' | 'MONTHLY';
export type ScheduleAudienceMode = 'USER' | 'ROLES' | 'USERS';

export interface UpcomingItem {
  occurrence_id: string;
  schedule_id: string;
  fire_at: string;
  fire_at_local: string;
  title: string;
  body: string | null;
  origin: 'USER' | 'SYSTEM';
  category: string;
  priority: string;
  link: string | null;
  animals_count: number;
  repeat: ScheduleRepeatType;
  can_edit: boolean;
}

export interface NotificationSchedule {
  id: string;
  title: string;
  body: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'DONE' | 'CANCELLED';
  trigger: 'DATE' | 'BEFORE_EVENT' | 'AFTER_EVENT';
  date: string | null;
  time: string | null;
  all_day: boolean;
  repeat: { type: ScheduleRepeatType; interval: number | null; end_date: string | null };
  lead_minutes: number[];
  audience: { mode: ScheduleAudienceMode; user_ids: string[]; roles: string[] };
  animal_ids: string[];
  created_by: string;
  next_fire_at: string | null;
  created_at: string;
  can_edit: boolean;
}

export interface CreateScheduleInput {
  title: string;
  body?: string;
  trigger: 'DATE' | 'BEFORE_EVENT' | 'AFTER_EVENT';
  date?: string;
  time?: string;
  repeat?: {
    type: ScheduleRepeatType;
    interval?: number;
    end_date?: string;
  };
  lead_minutes?: number[];
  audience: {
    mode: ScheduleAudienceMode;
    user_id?: string;
    roles?: string[];
    user_ids?: string[];
  };
  animal_ids?: string[];
}

export type UpdateScheduleInput = Partial<CreateScheduleInput>;

export interface SchedulePreview {
  timezone: string;
  all_day: boolean;
  next_fire_times: Array<{
    fire_at: string;
    local: string;
    lead_minutes: number;
  }>;
  recipient_count: number;
}

export interface NotificationChannels {
  in_app: boolean;
  push: boolean;
  sms: boolean;
  whatsapp: boolean;
  telegram: boolean;
  email: boolean;
}

export interface NotificationPreferenceItem {
  event_key: string;
  label: string;
  category: string;
  can_disable: boolean;
  enabled: boolean;
  channels: NotificationChannels;
}

export interface NotificationPreferencesResult {
  quiet_hours: { start: string | null; end: string | null };
  preferences: NotificationPreferenceItem[];
}

export interface FarmMemberOption {
  id: string;
  name: string;
  email?: string;
  role?: string;
}
