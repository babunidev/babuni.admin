import type {
  DashboardStats,
  LogEntry,
  Player,
  Report,
  ServerStatus,
  WorldMetric,
} from '../types'

export const mockServerStatus: ServerStatus = {
  label: 'Morkahja Prime',
  state: 'online',
  version: '0.4.2-mock',
  region: 'EU-West',
}

export const mockDashboardStats: DashboardStats = {
  onlinePlayers: 128,
  activeReports: 7,
  eventsToday: 342,
  serverUptime: '14d 6h',
}

export const mockPlayers: Player[] = [
  {
    id: 'p-001',
    name: 'Aelric_Thorn',
    status: 'online',
    level: 42,
    realm: 'Ashfen',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'p-002',
    name: 'MiraVoid',
    status: 'offline',
    level: 38,
    realm: 'Duskmire',
    lastSeen: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    id: 'p-003',
    name: 'Grimhold',
    status: 'muted',
    level: 51,
    realm: 'Ashfen',
    lastSeen: new Date(Date.now() - 900_000).toISOString(),
  },
  {
    id: 'p-004',
    name: 'SableWisp',
    status: 'online',
    level: 29,
    realm: 'Ironhollow',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'p-005',
    name: 'KaelDrift',
    status: 'banned',
    level: 19,
    realm: 'Duskmire',
    lastSeen: new Date(Date.now() - 86_400_000).toISOString(),
  },
  {
    id: 'p-006',
    name: 'VeyraNox',
    status: 'online',
    level: 47,
    realm: 'Ironhollow',
    lastSeen: new Date().toISOString(),
  },
]

export const mockLogs: LogEntry[] = [
  {
    id: 'log-101',
    timestamp: new Date(Date.now() - 120_000).toISOString(),
    level: 'audit',
    source: 'moderation',
    message: 'Mute applied to Grimhold (24h) — spam in trade chat',
  },
  {
    id: 'log-102',
    timestamp: new Date(Date.now() - 600_000).toISOString(),
    level: 'warn',
    source: 'world',
    message: 'Storm surge triggered in Ashfen — density +12%',
  },
  {
    id: 'log-103',
    timestamp: new Date(Date.now() - 1_800_000).toISOString(),
    level: 'info',
    source: 'auth',
    message: 'Session refresh batch completed (128 active)',
  },
  {
    id: 'log-104',
    timestamp: new Date(Date.now() - 3_600_000).toISOString(),
    level: 'error',
    source: 'economy',
    message: 'Ledger reconcile mismatch in vendor stall #44',
  },
  {
    id: 'log-105',
    timestamp: new Date(Date.now() - 7_200_000).toISOString(),
    level: 'audit',
    source: 'moderation',
    message: 'Ban upheld for KaelDrift — exploit attempt',
  },
]

export const mockReports: Report[] = [
  {
    id: 'rpt-201',
    reporter: 'SableWisp',
    target: 'Grimhold',
    reason: 'Harassment in party chat',
    status: 'reviewing',
    createdAt: new Date(Date.now() - 1_200_000).toISOString(),
  },
  {
    id: 'rpt-202',
    reporter: 'Aelric_Thorn',
    target: 'Unknown_4471',
    reason: 'Suspicious movement / speed',
    status: 'open',
    createdAt: new Date(Date.now() - 600_000).toISOString(),
  },
  {
    id: 'rpt-203',
    reporter: 'VeyraNox',
    target: 'MiraVoid',
    reason: 'Scam trade offer',
    status: 'open',
    createdAt: new Date(Date.now() - 300_000).toISOString(),
  },
  {
    id: 'rpt-204',
    reporter: 'System',
    target: 'KaelDrift',
    reason: 'Automated exploit flag',
    status: 'resolved',
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
]

export const mockWorldMetrics: WorldMetric[] = [
  {
    id: 'wm-1',
    label: 'Active Realms',
    value: '3',
    trend: 'stable',
    detail: 'Ashfen, Duskmire, Ironhollow',
  },
  {
    id: 'wm-2',
    label: 'World Threat',
    value: 'Moderate',
    trend: 'up',
    detail: 'Corruption index 0.62',
  },
  {
    id: 'wm-3',
    label: 'Economy Load',
    value: '78%',
    trend: 'up',
    detail: 'Vendor throughput nominal',
  },
  {
    id: 'wm-4',
    label: 'Event Cycle',
    value: 'Nightfall',
    trend: 'stable',
    detail: 'Next shift in 2h 14m',
  },
  {
    id: 'wm-5',
    label: 'Spawn Density',
    value: '1.12x',
    trend: 'down',
    detail: 'Ashfen reduced after surge',
  },
  {
    id: 'wm-6',
    label: 'Arcane Flux',
    value: 'Low',
    trend: 'stable',
    detail: 'No anomalies detected',
  },
]
