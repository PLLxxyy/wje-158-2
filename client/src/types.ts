export interface User {
  id: string;
  username: string;
  role: 'admin' | 'inspector' | 'repairer';
  real_name: string;
}

export interface Facility {
  id: string;
  station_id: string;
  type: 'shelter' | 'seat' | 'sign' | 'light' | 'canopy';
  status: 'good' | 'damaged' | 'missing';
  description: string;
  created_at: string;
}

export interface Station {
  id: string;
  name: string;
  location: string;
  region: string;
  lines: string;
  created_at: string;
  facilities?: Facility[];
  health_rate?: number;
}

export interface Inspection {
  id: string;
  station_id: string;
  inspector_id: string;
  date: string;
  status: 'pending' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  station_name?: string;
  station_location?: string;
  station_region?: string;
  station_lines?: string;
  facility_count?: number;
  facilities?: Facility[];
  items?: InspectionItem[];
}

export interface InspectionItem {
  id: string;
  inspection_id: string;
  facility_id: string;
  facility_type: string;
  result: 'good' | 'damaged' | 'missing' | null;
  damage_desc: string;
  photo: string;
  repaired: number;
}

export interface RepairOrder {
  id: string;
  inspection_item_id: string;
  station_id: string;
  facility_id: string;
  facility_type: string;
  damage_desc: string;
  damage_photo: string;
  status: 'pending' | 'in_progress' | 'completed';
  repairer_id: string | null;
  repair_photo: string;
  repair_desc: string;
  created_at: string;
  assigned_at: string | null;
  completed_at: string | null;
  station_name?: string;
  station_location?: string;
  station_region?: string;
  hours_taken?: number | null;
}

export interface HealthRanking {
  station_id: string;
  station_name: string;
  region: string;
  total_facilities: number;
  good_count: number;
  damaged_count: number;
  missing_count: number;
  health_rate: number;
}

export interface RepairTimeliness {
  summary: {
    total: number;
    completed: number;
    pending: number;
    in_progress: number;
    timely_count: number;
    timeliness_rate: number;
  };
  recent_orders: RepairOrder[];
}

export interface InspectionCompletion {
  summary: {
    month: string;
    total: number;
    completed: number;
    completion_rate: number;
  };
  daily_breakdown: Array<{ date: string; total: number; completed: number }>;
  station_breakdown: Array<{ station_name: string; total: number; completed: number }>;
}

export const FACILITY_LABELS: Record<string, string> = {
  shelter: '候车亭',
  seat: '座椅',
  sign: '站牌',
  light: '照明',
  canopy: '遮雨棚'
};

export const FACILITY_ICONS: Record<string, string> = {
  shelter: '\u{1F3D8}',
  seat: '\u{1F4BA}',
  sign: '\u{1F6A9}',
  light: '\u{1F4A1}',
  canopy: '\u{2602}'
};

export const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  in_progress: '处理中',
  completed: '已完成'
};

export const RESULT_LABELS: Record<string, string> = {
  good: '完好',
  damaged: '损坏',
  missing: '缺失'
};
