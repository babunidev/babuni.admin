import type {
  DashboardStats,
  LogEntry,
  Player,
  Report,
  ServerStatus,
  WorldMetric,
} from '../types'
import {
  mockDashboardStats,
  mockLogs,
  mockPlayers,
  mockReports,
  mockServerStatus,
  mockWorldMetrics,
} from './mockData'

/** Mock API layer — swap implementations when backend is ready. */
export async function fetchServerStatus(): Promise<ServerStatus> {
  return mockServerStatus
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return mockDashboardStats
}

export async function fetchPlayers(): Promise<Player[]> {
  return mockPlayers
}

export async function fetchLogs(): Promise<LogEntry[]> {
  return mockLogs
}

export async function fetchReports(): Promise<Report[]> {
  return mockReports
}

export async function fetchWorldMetrics(): Promise<WorldMetric[]> {
  return mockWorldMetrics
}
