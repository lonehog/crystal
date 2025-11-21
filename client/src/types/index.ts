export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  url: string;
  posted_at: string;
  role_slug: string;
  created_at: string;
  description?: string;
  qualifications?: string;
  source?: string;
}

export interface Stats {
  total: number;
  last24h: number;
  daily: Array<{
    date: string;
    count: number;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

