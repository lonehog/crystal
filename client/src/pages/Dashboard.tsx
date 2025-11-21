import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Briefcase, Clock } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'
import { api } from '../lib/api'
import GlassCard from '../components/GlassCard'

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
    refetchInterval: 30000, // Refetch every 30 seconds
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
        <GlassCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Jobs</p>
              <p className="text-3xl font-bold text-white">
                {isLoading ? '...' : stats?.total.toLocaleString() || 0}
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
                {isLoading ? '...' : stats?.last24h.toLocaleString() || 0}
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
              <p className="text-gray-400 text-sm mb-1">Last Updated</p>
              <p className="text-lg font-semibold text-white">
                {new Date().toLocaleTimeString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Clock className="text-purple-400" size={24} />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Chart */}
      <GlassCard delay={0.3}>
        <h2 className="text-xl font-bold text-white mb-6">Jobs Found (Last 7 Days)</h2>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-gray-400">Loading chart data...</div>
          </div>
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
    </div>
  )
}

