import axios from 'axios';
import type { Job, Stats, ApiResponse } from '../types';

const API_BASE = '/api';

export const api = {
  async getJobs(role?: string, limit = 100, source?: string): Promise<Job[]> {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (source) params.append('source', source);
    params.append('limit', limit.toString());
    
    const response = await axios.get<ApiResponse<Job[]>>(
      `${API_BASE}/jobs?${params.toString()}`
    );
    return response.data.data || [];
  },

  async getStats(): Promise<Stats> {
    const response = await axios.get<ApiResponse<Stats>>(`${API_BASE}/stats`);
    return response.data.data || { total: 0, last24h: 0, daily: [] };
  },

  async getRoles(): Promise<string[]> {
    const response = await axios.get<ApiResponse<string[]>>(`${API_BASE}/roles`);
    return response.data.data || [];
  },

  async addRole(role: string): Promise<string[]> {
    const response = await axios.post<ApiResponse<string[]>>(
      `${API_BASE}/roles`,
      { role }
    );
    return response.data.data || [];
  },

  async deleteRole(role: string): Promise<string[]> {
    const response = await axios.delete<ApiResponse<string[]>>(
      `${API_BASE}/roles/${encodeURIComponent(role)}`
    );
    return response.data.data || [];
  },

  async triggerScan(): Promise<{ scanned: number }> {
    const response = await axios.get<ApiResponse<{ scanned: number }>>(
      `${API_BASE}/scan`
    );
    return response.data.data || { scanned: 0 };
  },
};

