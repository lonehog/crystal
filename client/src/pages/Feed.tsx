import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, MapPin, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../lib/api'
import GlassCard from '../components/GlassCard'
import type { Job } from '../types'

function JobCard({ job, index, roleIndex }: { job: Job; index: number; roleIndex: number }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (roleIndex * 0.1) + (index * 0.05) }}
    >
      <GlassCard>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">
              {job.title}
            </h3>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-400">
                <Building2 size={16} />
                <span className="text-sm">{job.company}</span>
              </div>
              {job.source && (
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  job.source === 'stepstone' 
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-green-500/20 text-green-400 border border-green-500/30'
                }`}>
                  {job.source === 'stepstone' ? 'StepStone' : 'Glassdoor'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <MapPin size={16} />
              <span className="text-sm">{job.location || 'Location not specified'}</span>
            </div>
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 pt-4 border-t border-white/10">
                  {job.description && (
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-2">Job Description</h4>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {job.description}
                      </p>
                    </div>
                  )}
                  {job.qualifications && (
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-2">Qualifications</h4>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {job.qualifications}
                      </p>
                    </div>
                  )}
                  {!job.description && !job.qualifications && (
                    <p className="text-sm text-gray-400 italic">No additional details available</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-2 border-t border-white/10 flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-all border border-white/10 hover:border-white/20 text-sm font-medium"
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={16} />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  Show More
                </>
              )}
            </button>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-electric-blue/20 hover:bg-electric-blue/30 text-electric-blue rounded-lg transition-all border border-electric-blue/30 hover:border-electric-blue/50"
            >
              <span className="text-sm font-medium">Apply</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )
}

function getTimeSlot(createdAt: string): string {
  const date = new Date(createdAt)
  const hour = date.getHours()
  const nextHour = hour + 1
  const period = hour >= 12 ? 'PM' : 'AM'
  const nextPeriod = nextHour >= 12 ? 'PM' : 'AM'
  
  const formatHour = (h: number) => {
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${displayHour}:00 ${h >= 12 ? 'PM' : 'AM'}`
  }
  
  return `${formatHour(hour)} - ${formatHour(nextHour)}`
}

export default function Feed() {
  const [sourceFilter, setSourceFilter] = useState<'all' | 'stepstone' | 'glassdoor'>('all')

  const { data: allJobs = [], isLoading } = useQuery({
    queryKey: ['jobs', sourceFilter],
    queryFn: () => api.getJobs(undefined, 1000, sourceFilter === 'all' ? undefined : sourceFilter),
    refetchInterval: 60000, // Refetch every minute
  })

  // Filter jobs from last 1 hour
  const oneHourAgo = new Date()
  oneHourAgo.setHours(oneHourAgo.getHours() - 1)
  
  const recentJobs = allJobs.filter((job: Job) => {
    const jobDate = new Date(job.created_at)
    return jobDate >= oneHourAgo
  })

  // Group jobs by time slot (1-hour intervals)
  const jobsByTimeSlot = recentJobs.reduce((acc, job) => {
    const timeSlot = getTimeSlot(job.created_at)
    if (!acc[timeSlot]) {
      acc[timeSlot] = []
    }
    acc[timeSlot].push(job)
    return acc
  }, {} as Record<string, Job[]>)

  // Then group by role within each time slot
  const jobsByRoleAndTime = Object.entries(jobsByTimeSlot).reduce((acc, [timeSlot, jobs]) => {
    const byRole = jobs.reduce((roleAcc, job) => {
      if (!roleAcc[job.role_slug]) {
        roleAcc[job.role_slug] = []
      }
      roleAcc[job.role_slug].push(job)
      return roleAcc
    }, {} as Record<string, Job[]>)
    
    acc[timeSlot] = byRole
    return acc
  }, {} as Record<string, Record<string, Job[]>>)

  const formatRoleName = (slug: string) => {
    return slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-bold text-white mb-2">Job Feed</h1>
        <div className="text-gray-400">Loading jobs...</div>
      </div>
    )
  }

  if (recentJobs.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-bold text-white mb-2">Job Feed</h1>
        <GlassCard>
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg mb-4">No new jobs in the last hour</p>
            <p className="text-gray-500 text-sm">
              {allJobs.length > 0 
                ? `${allJobs.length} total jobs found, but none in the last hour`
                : 'Add roles in Settings and trigger a scan to get started'}
            </p>
          </div>
        </GlassCard>
      </div>
    )
  }

  // Sort time slots (newest first)
  const sortedTimeSlots = Object.keys(jobsByRoleAndTime).sort((a, b) => {
    // Extract hour from time slot string for comparison
    const getHour = (slot: string) => {
      const match = slot.match(/(\d+):00/)
      return match ? parseInt(match[1]) : 0
    }
    return getHour(b) - getHour(a)
  })

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Job Feed</h1>
            <p className="text-gray-400">
              {recentJobs.length} new job{recentJobs.length !== 1 ? 's' : ''} in the last hour
              {allJobs.length > recentJobs.length && (
                <span className="text-gray-500 ml-2">
                  ({allJobs.length} total)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Source Filter */}
        <GlassCard>
          <div className="flex items-center gap-6">
            <span className="text-sm font-medium text-gray-300">Filter by Portal:</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="source"
                  value="all"
                  checked={sourceFilter === 'all'}
                  onChange={(e) => setSourceFilter(e.target.value as 'all' | 'stepstone' | 'glassdoor')}
                  className="w-4 h-4 text-electric-blue bg-white/5 border-white/20 focus:ring-electric-blue focus:ring-2"
                />
                <span className="text-sm text-gray-300">Both</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="source"
                  value="stepstone"
                  checked={sourceFilter === 'stepstone'}
                  onChange={(e) => setSourceFilter(e.target.value as 'all' | 'stepstone' | 'glassdoor')}
                  className="w-4 h-4 text-electric-blue bg-white/5 border-white/20 focus:ring-electric-blue focus:ring-2"
                />
                <span className="text-sm text-gray-300">StepStone</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="source"
                  value="glassdoor"
                  checked={sourceFilter === 'glassdoor'}
                  onChange={(e) => setSourceFilter(e.target.value as 'all' | 'stepstone' | 'glassdoor')}
                  className="w-4 h-4 text-electric-blue bg-white/5 border-white/20 focus:ring-electric-blue focus:ring-2"
                />
                <span className="text-sm text-gray-300">Glassdoor</span>
              </label>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {sortedTimeSlots.map((timeSlot, timeIndex) => {
        const rolesInSlot = jobsByRoleAndTime[timeSlot]
        const totalJobsInSlot = Object.values(rolesInSlot).flat().length

        return (
          <div key={timeSlot} className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: timeIndex * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-electric-blue/50 to-transparent" />
              <h2 className="text-xl font-bold text-electric-blue whitespace-nowrap">
                {timeSlot}
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-electric-blue/50 to-transparent" />
              <span className="text-sm text-gray-400">
                {totalJobsInSlot} job{totalJobsInSlot !== 1 ? 's' : ''}
              </span>
            </motion.div>

            {Object.entries(rolesInSlot).map(([roleSlug, roleJobs], roleIndex) => (
              <div key={roleSlug} className="space-y-4">
                <motion.h3
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (timeIndex * 0.1) + (roleIndex * 0.05) }}
                  className="text-lg font-semibold text-white flex items-center gap-2"
                >
                  <span className="w-1 h-5 bg-electric-blue rounded-full" />
                  {formatRoleName(roleSlug)}
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    ({roleJobs.length})
                  </span>
                </motion.h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {roleJobs.map((job, jobIndex) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      index={jobIndex}
                      roleIndex={timeIndex + roleIndex}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
