import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Briefcase, RefreshCw } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { motion } from 'framer-motion'
import { api } from '../lib/api'
import GlassCard from '../components/GlassCard'
import { SkeletonKPICard, SkeletonChart } from '../components/SkeletonLoader'

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const { data: nextScan, isLoading: nextScanLoading } = useQuery({
    queryKey: ['next-scan'],
    queryFn: api.getNextScan,
    refetchInterval: 60000, // Refetch every minute
  })

  const { data: uptime, isLoading: uptimeLoading } = useQuery({
    queryKey: ['uptime'],
    queryFn: api.getUptime,
    refetchInterval: 60000, // Refetch every minute
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const chartData = stats?.daily.map((item) => ({
    date: formatDate(item.date),
    jobs: item.count,
  })) || []

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Monitor your job aggregation in real-time</p>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {isLoading ? (
          <>
            <SkeletonKPICard />
            <SkeletonKPICard />
            <SkeletonKPICard />
          </>
        ) : (
          <>
            <GlassCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Total Jobs</p>
                  <p className="text-3xl font-bold text-white">
                    {stats?.total.toLocaleString() || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-electric-blue/20 rounded-lg flex items-center justify-center">
                  <Briefcase className="text-electric-blue" size={24} />
                </div>
              </div>
            </GlassCard>

            <GlassCard delay={0.1}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">New Jobs (24h)</p>
                  <p className="text-3xl font-bold text-white">
                    {stats?.last24h.toLocaleString() || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="text-green-400" size={24} />
                </div>
              </div>
            </GlassCard>

            <GlassCard delay={0.2}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Next Scan</p>
                  <p className="text-lg font-semibold text-white">
                    {nextScanLoading ? '...' : nextScan?.formatted || '--'}
                  </p>
                  {nextScan && (
                    <p className="text-xs text-gray-500 mt-1">
                      in {nextScan.minutesUntil} min
                    </p>
                  )}
                </div>
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <RefreshCw className="text-purple-400" size={24} />
                </div>
              </div>
            </GlassCard>
          </>
        )}
      </div>

      {/* Chart */}
      <GlassCard delay={0.3}>
        <h2 className="text-xl font-bold text-white mb-6">Jobs Found (Last 7 Days)</h2>
        {isLoading ? (
          <SkeletonChart />
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorJobs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0075FF" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#0075FF" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(17, 24, 39, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Area
                type="monotone"
                dataKey="jobs"
                stroke="#0075FF"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorJobs)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center">
            <div className="text-gray-400">No data available yet</div>
          </div>
        )}
      </GlassCard>

      {/* Uptime Chart */}
      <GlassCard delay={0.4}>
        <h2 className="text-xl font-bold text-white mb-6">Uptime (Last 24 Hours)</h2>
        {uptimeLoading ? (
          <SkeletonChart />
        ) : uptime?.hourly && uptime.hourly.length > 0 ? (
          <div>
            <div className="mb-4 flex items-center gap-4">
              <div className="text-sm text-gray-400">
                Total Uptime: <span className="text-white font-semibold">{uptime.totalUptimeHours.toFixed(2)} hours</span>
              </div>
              <div className="text-sm text-gray-400">
                Server Started: <span className="text-white font-semibold">
                  {new Date(uptime.serverStartTime).toLocaleString()}
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={uptime.hourly}>
                <defs>
                  <linearGradient id="colorUptime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="hour"
                  stroke="#9CA3AF"
                  style={{ fontSize: '11px' }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  stroke="#9CA3AF"
                  style={{ fontSize: '12px' }}
                  domain={[0, 100]}
                  label={{ value: 'Uptime %', angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF', fontSize: '12px' } }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(17, 24, 39, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Uptime']}
                />
                <Bar
                  dataKey="uptime"
                  fill="url(#colorUptime)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center">
            <div className="text-gray-400">No uptime data available yet</div>
          </div>
        )}
      </GlassCard>
    </div>
  )
}

