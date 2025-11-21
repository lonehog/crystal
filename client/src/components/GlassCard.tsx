import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  delay?: number
}

export default function GlassCard({ children, className = '', delay = 0 }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`glass p-6 ${className}`}
    >
      {children}
    </motion.div>
  )
}

