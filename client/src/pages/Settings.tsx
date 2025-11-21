import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, RefreshCw, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import GlassCard from '../components/GlassCard'

export default function Settings() {
  const [newRole, setNewRole] = useState('')
  const queryClient = useQueryClient()

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: api.getRoles,
  })

  const addRoleMutation = useMutation({
    mutationFn: api.addRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setNewRole('')
      toast.success('Role added successfully')
    },
    onError: () => {
      toast.error('Failed to add role')
    },
  })

  const deleteRoleMutation = useMutation({
    mutationFn: api.deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role removed')
    },
    onError: () => {
      toast.error('Failed to remove role')
    },
  })

  const scanMutation = useMutation({
    mutationFn: api.triggerScan,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success(`Scan completed! Found ${data.scanned} new jobs.`)
    },
    onError: () => {
      toast.error('Scan failed. Please try again.')
    },
  })

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault()
    if (newRole.trim()) {
      addRoleMutation.mutate(newRole.trim())
    }
  }

  const handleDeleteRole = (role: string) => {
    if (window.confirm(`Remove "${role}" from active roles?`)) {
      deleteRoleMutation.mutate(role)
    }
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Manage job roles and scanning preferences</p>
      </motion.div>

      {/* Add Role */}
      <GlassCard>
        <h2 className="text-xl font-bold text-white mb-4">Add Job Role</h2>
        <form onSubmit={handleAddRole} className="flex gap-3">
          <input
            type="text"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            placeholder="e.g., Embedded Engineer, C++ Developer"
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-electric-blue focus:border-transparent"
          />
          <button
            type="submit"
            disabled={addRoleMutation.isPending || !newRole.trim()}
            className="px-6 py-3 bg-electric-blue hover:bg-electric-blue/80 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {addRoleMutation.isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Plus size={18} />
            )}
            Add Role
          </button>
        </form>
      </GlassCard>

      {/* Active Roles */}
      <GlassCard delay={0.1}>
        <h2 className="text-xl font-bold text-white mb-4">Active Roles</h2>
        {isLoading ? (
          <div className="text-gray-400">Loading roles...</div>
        ) : roles.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-2">No active roles</p>
            <p className="text-gray-500 text-sm">
              Add roles above to start scraping job listings
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {roles.map((role, index) => (
              <motion.div
                key={role}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-all"
              >
                <span className="text-white font-medium">{role}</span>
                <button
                  onClick={() => handleDeleteRole(role)}
                  disabled={deleteRoleMutation.isPending}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                >
                  <Trash2 size={18} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Scan Controls */}
      <GlassCard delay={0.2}>
        <h2 className="text-xl font-bold text-white mb-4">Scan Controls</h2>
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            Trigger an immediate scan of all active roles. Scans also run
            automatically every hour.
          </p>
          <button
            onClick={() => scanMutation.mutate(undefined)}
            disabled={scanMutation.isPending || roles.length === 0}
            className="px-6 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 hover:border-green-500/50 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {scanMutation.isPending ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <RefreshCw size={18} />
                Force Scan Now
              </>
            )}
          </button>
        </div>
      </GlassCard>
    </div>
  )
}

