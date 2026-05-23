export type PlayerStatus = 'online' | 'offline' | 'banned' | 'muted'

export interface Player {
  id: string
  name: string
  status: PlayerStatus
  level: number
  realm: string
  lastSeen: string
}

export type LogLevel = 'info' | 'warn' | 'error' | 'audit'

export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  source: string
  message: string
}

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'

export interface Report {
  id: string
  reporter: string
  target: string
  reason: string
  status: ReportStatus
  createdAt: string
}

export interface DashboardStats {
  onlinePlayers: number
  activeReports: number
  eventsToday: number
  serverUptime: string
}

export interface WorldMetric {
  id: string
  label: string
  value: string
  trend: 'up' | 'down' | 'stable'
  detail?: string
}

export interface ServerStatus {
  label: string
  state: 'online' | 'degraded' | 'offline'
  version: string
  region: string
}
