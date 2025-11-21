import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, MapPin, ExternalLink, ChevronDown, ChevronUp, Heart, Search, Download, Filter, AlertCircle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import GlassCard from '../components/GlassCard'
import { SkeletonCard } from '../components/SkeletonLoader'
import type { Job } from '../types'

type SortOption = 'newest' | 'oldest' | 'company-asc' | 'company-desc' | 'location-asc'

function JobCard({ job, index, roleIndex, onFavoriteToggle }: { 
  job: Job; 
  index: number; 
  roleIndex: number;
  onFavoriteToggle: (jobId: number, isFavorite: boolean) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isFavorite = job.is_favorite === 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (roleIndex * 0.1) + (index * 0.05) }}
      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-lg font-bold text-white line-clamp-2 flex-1">
              {job.title}
            </h3>
            <button
              onClick={() => onFavoriteToggle(job.id, !isFavorite)}
              className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${
                isFavorite
                  ? 'text-red-400 hover:text-red-300'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-400">
                <Building2 size={14} />
                <span className="text-sm font-medium">{job.company}</span>
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
              <MapPin size={14} />
              <span className="text-sm">{job.location || 'Location not specified'}</span>
            </div>
          </div>

          <AnimatePresence>
            {isExpanded && (job.description || job.qualifications) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden mt-4"
              >
                <div className="space-y-3 pt-3 border-t border-white/10">
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-3 flex items-center gap-3">
            {/* Only show Show More button if there's actual content */}
            {(job.description || job.qualifications) && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-all border border-white/10 hover:border-white/20 text-xs font-medium"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp size={14} />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} />
                    Show More
                  </>
                )}
              </button>
            )}
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-electric-blue/20 hover:bg-electric-blue/30 text-electric-blue rounded-lg transition-all border border-electric-blue/30 hover:border-electric-blue/50 text-xs font-medium"
            >
              <span className="font-medium">Apply</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function getTimeSlot(createdAt: string): string {
  const date = new Date(createdAt)
  const hour = date.getHours()
  
  const formatHour = (h: number) => {
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h
    const period = h >= 12 ? 'PM' : 'AM'
    return `${displayHour}:00 ${period}`
  }
  
  const formatDate = (d: Date) => {
    const day = d.getDate()
    const month = d.toLocaleDateString('en-US', { month: 'long' })
    return `${day} ${month}`
  }
  
  return `${formatHour(hour)} ${formatDate(date)}`
}

export default function Feed() {
  const [sourceFilter, setSourceFilter] = useState<'all' | 'stepstone' | 'glassdoor'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [showGlassdoorNotice, setShowGlassdoorNotice] = useState(false)
  const queryClient = useQueryClient()

  const { data: allJobs = [], isLoading } = useQuery({
    queryKey: ['jobs', sourceFilter],
    queryFn: () => api.getJobs(undefined, 1000, sourceFilter === 'all' ? undefined : sourceFilter),
    refetchInterval: 60000,
  })

  const favoriteMutation = useMutation({
    mutationFn: ({ jobId, isFavorite }: { jobId: number; isFavorite: boolean }) =>
      isFavorite ? api.favoriteJob(jobId) : api.unfavoriteJob(jobId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      toast.success(variables.isFavorite ? 'Job favorited' : 'Job unfavorited')
    },
    onError: () => {
      toast.error('Failed to update favorite')
    },
  })

  const handleFavoriteToggle = (jobId: number, isFavorite: boolean) => {
    favoriteMutation.mutate({ jobId, isFavorite })
  }

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const blob = await api.exportJobs(format)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `jobs.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success(`Jobs exported as ${format.toUpperCase()}`)
    } catch (error) {
      toast.error('Failed to export jobs')
    }
  }

  // Check for Glassdoor data and show notice if needed
  useEffect(() => {
    const hasGlassdoorJobs = allJobs.some((job: Job) => job.source === 'glassdoor')
    const hasStepstoneJobs = allJobs.some((job: Job) => job.source === 'stepstone')
    
    if (hasStepstoneJobs && !hasGlassdoorJobs) {
      setShowGlassdoorNotice(true)
    }
  }, [allJobs])

  // Filter and sort jobs
  const processedJobs = useMemo(() => {
    let filtered = allJobs

    // Filter by favorites
    if (showFavoritesOnly) {
      filtered = filtered.filter((job: Job) => job.is_favorite === 1)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((job: Job) =>
        job.title.toLowerCase().includes(query) ||
        job.company.toLowerCase().includes(query) ||
        job.location.toLowerCase().includes(query)
      )
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'company-asc':
          return a.company.localeCompare(b.company)
        case 'company-desc':
          return b.company.localeCompare(a.company)
        case 'location-asc':
          return (a.location || '').localeCompare(b.location || '')
        default:
          return 0
      }
    })

    return filtered
  }, [allJobs, searchQuery, sortBy, showFavoritesOnly])

  // Group jobs by time slot
  const jobsByTimeSlot = useMemo(() => {
    const byTimeSlot = processedJobs.reduce((acc, job) => {
      const timeSlot = getTimeSlot(job.created_at)
      if (!acc[timeSlot]) {
        acc[timeSlot] = []
      }
      acc[timeSlot].push(job)
      return acc
    }, {} as Record<string, Job[]>)

    return byTimeSlot
  }, [processedJobs])



  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-bold text-white mb-2">Job Feed</h1>
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 animate-pulse">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="h-6 bg-white/10 rounded w-3/4" />
                  <div className="w-6 h-6 bg-white/10 rounded" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-4 bg-white/10 rounded w-1/2" />
                  <div className="h-4 bg-white/10 rounded w-2/3" />
                </div>
                <div className="flex gap-2">
                  <div className="h-6 bg-white/10 rounded w-20" />
                  <div className="h-6 bg-white/10 rounded w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const sortedTimeSlots = Object.keys(jobsByTimeSlot).sort((a, b) => {
    // Extract time and date from format "HH:MM AM/PM DD Month"
    const extractTimeInfo = (slot: string) => {
      const parts = slot.split(' ')
      const timePart = parts[0] // "HH:MM"
      const period = parts[1] // "AM/PM"
      const datePart = parts.slice(2).join(' ') // "DD Month"
      
      const [hours, minutes] = timePart.split(':').map(Number)
      const adjustedHours = period === 'PM' && hours !== 12 ? hours + 12 : 
                           period === 'AM' && hours === 12 ? 0 : hours
      
      return {
        timestamp: adjustedHours * 60 + minutes,
        dateString: datePart
      }
    }
    
    const aInfo = extractTimeInfo(a)
    const bInfo = extractTimeInfo(b)
    
    // First sort by date, then by time
    if (aInfo.dateString !== bInfo.dateString) {
      return new Date(aInfo.dateString + ', ' + new Date().getFullYear()).getTime() - 
             new Date(bInfo.dateString + ', ' + new Date().getFullYear()).getTime()
    }
    
    return bInfo.timestamp - aInfo.timestamp
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
              {processedJobs.length} job{processedJobs.length !== 1 ? 's' : ''} found
              {allJobs.length > processedJobs.length && (
                <span className="text-gray-500 ml-2">
                  ({allJobs.length} total)
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('csv')}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-all border border-white/10 hover:border-white/20 flex items-center gap-2"
            >
              <Download size={16} />
              <span className="text-sm">Export CSV</span>
            </button>
            <button
              onClick={() => handleExport('json')}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-all border border-white/10 hover:border-white/20 flex items-center gap-2"
            >
              <Download size={16} />
              <span className="text-sm">Export JSON</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4">
          <GlassCard>
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search jobs by title, company, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-electric-blue focus:border-transparent"
                />
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {/* Source Filter */}
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-300">Portal:</span>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="source"
                        value="all"
                        checked={sourceFilter === 'all'}
                        onChange={(e) => setSourceFilter(e.target.value as 'all' | 'stepstone' | 'glassdoor')}
                        className="w-3 h-3 text-electric-blue bg-white/5 border-white/20 focus:ring-electric-blue"
                      />
                      <span className="text-sm text-gray-300">Both</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="source"
                        value="stepstone"
                        checked={sourceFilter === 'stepstone'}
                        onChange={(e) => setSourceFilter(e.target.value as 'all' | 'stepstone' | 'glassdoor')}
                        className="w-3 h-3 text-electric-blue bg-white/5 border-white/20 focus:ring-electric-blue"
                      />
                      <span className="text-sm text-gray-300">StepStone</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="source"
                        value="glassdoor"
                        checked={sourceFilter === 'glassdoor'}
                        onChange={(e) => setSourceFilter(e.target.value as 'all' | 'stepstone' | 'glassdoor')}
                        className="w-3 h-3 text-electric-blue bg-white/5 border-white/20 focus:ring-electric-blue"
                      />
                      <span className="text-sm text-gray-300">Glassdoor</span>
                    </label>
                  </div>
                </div>

                {/* Sort */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-300">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="company-asc">Company A-Z</option>
                    <option value="company-desc">Company Z-A</option>
                    <option value="location-asc">Location A-Z</option>
                  </select>
                </div>

                {/* Favorites Filter */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showFavoritesOnly}
                    onChange={(e) => setShowFavoritesOnly(e.target.checked)}
                    className="w-4 h-4 text-electric-blue bg-white/5 border-white/20 rounded focus:ring-electric-blue"
                  />
                  <span className="text-sm text-gray-300 flex items-center gap-1">
                    <Heart size={14} />
                    Favorites Only
                  </span>
                </label>
              </div>
            </div>
          </GlassCard>
        </div>
      </motion.div>

      {sortedTimeSlots.length === 0 ? (
        <GlassCard>
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg mb-4">No jobs found</p>
            <p className="text-gray-500 text-sm">
              {searchQuery || showFavoritesOnly
                ? 'Try adjusting your filters'
                : 'Add roles in Settings and trigger a scan to get started'}
            </p>
          </div>
        </GlassCard>
      ) : (
        sortedTimeSlots.map((timeSlot, timeIndex) => {
          const jobsInSlot = jobsByTimeSlot[timeSlot]
          const totalJobsInSlot = jobsInSlot.length

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

              <div className="space-y-4">
                {jobsInSlot.map((job, jobIndex) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    index={jobIndex}
                    roleIndex={timeIndex}
                    onFavoriteToggle={handleFavoriteToggle}
                  />
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
