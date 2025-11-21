import React, { useState, useCallback } from 'react';
import { api } from '../lib/api';
import { Job } from '../types';
import GlassCard from '../components/GlassCard';
import { SkeletonCard } from '../components/SkeletonLoader';

const TestPage: React.FC = () => {
  const [startTime, setStartTime] = useState('');
  const [scanResult, setScanResult] = useState<{ scanned: number } | null>(null);
  const [newJobs, setNewJobs] = useState<Job[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetTimestamp = useCallback(() => {
    const now = new Date().toISOString();
    setStartTime(now);
    setScanResult(null);
    setNewJobs(null);
    setError(null);
  }, []);

  const handleTriggerScan = useCallback(async (source?: 'stepstone' | 'glassdoor') => {
    if (!startTime) {
      setError('Please get a baseline timestamp first.');
      return;
    }
    setLoading(true);
    setError(null);
    setScanResult(null);
    setNewJobs(null);
    try {
      const result = await api.triggerScan(source);
      setScanResult(result);
    } catch (err: any) {
      setError(`Scan failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [startTime]);

  const handleFetchNewJobs = useCallback(async () => {
    if (!startTime) {
      setError('Please get a baseline timestamp first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Fetch jobs created since the startTime
      const jobs = await api.getJobs(undefined, 100, undefined, startTime);
      setNewJobs(jobs);
    } catch (err: any) {
      setError(`Fetch failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [startTime]);

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-6 text-white">Job Feed Testing Utility</h1>

      {error && (
        <GlassCard className="bg-red-500/30 border-red-400 mb-4">
          <p className="text-red-200">Error: {error}</p>
        </GlassCard>
      )}

      <GlassCard className="mb-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Step 1: Get Baseline Timestamp</h2>
        <button
          onClick={handleGetTimestamp}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-200"
        >
          Get Current Time (ISO 8601)
        </button>
        {startTime && (
          <p className="mt-3 text-sm text-gray-300 break-all">
            Baseline Time: <code className="bg-gray-700 p-1 rounded">{startTime}</code>
          </p>
        )}
      </GlassCard>

      <GlassCard className="mb-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Step 2: Trigger Scan (Select Source)</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleTriggerScan('stepstone')}
            disabled={!startTime || loading}
            className={`px-4 py-2 rounded transition duration-200 ${
              !startTime || loading
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {loading ? 'Scanning StepStone...' : 'Scan StepStone'}
          </button>
          <button
            onClick={() => handleTriggerScan('glassdoor')}
            disabled={!startTime || loading}
            className={`px-4 py-2 rounded transition duration-200 ${
              !startTime || loading
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {loading ? 'Scanning Glassdoor...' : 'Scan Glassdoor'}
          </button>
          <button
            onClick={() => handleTriggerScan()}
            disabled={!startTime || loading}
            className={`px-4 py-2 rounded transition duration-200 ${
              !startTime || loading
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-yellow-500 text-white hover:bg-yellow-600'
            }`}
          >
            {loading ? 'Scanning All...' : 'Scan Both Portals'}
          </button>
        </div>
        {scanResult && (
          <p className="mt-3 text-sm text-green-300">
            Scan completed. Inserted <strong>{scanResult.scanned}</strong> new jobs.
          </p>
        )}
      </GlassCard>

      <GlassCard className="mb-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Step 3: Fetch New Jobs</h2>
        <button
          onClick={handleFetchNewJobs}
          disabled={!startTime || loading}
          className={`px-4 py-2 rounded transition duration-200 ${
            !startTime || loading
              ? 'bg-gray-500 cursor-not-allowed'
              : 'bg-purple-500 text-white hover:bg-purple-600'
          }`}
        >
          {loading ? 'Fetching...' : 'Fetch Jobs Since Baseline'}
        </button>
        {newJobs !== null && (
          <p className="mt-3 text-sm text-purple-300">
            Found <strong>{newJobs.length}</strong> jobs created since the baseline time.
          </p>
        )}
      </GlassCard>

      {loading && (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {newJobs && newJobs.length > 0 && (
        <GlassCard>
          <h2 className="text-xl font-semibold mb-4 text-white">New Jobs ({newJobs.length})</h2>
          <ul className="space-y-4">
            {newJobs.map((job) => (
              <li key={job.id} className="border-b border-gray-600 pb-2">
                <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-medium">
                  {job.title}
                </a>
                <p className="text-sm text-gray-400">{job.company} - {job.location} ({job.source})</p>
                <p className="text-xs text-gray-500">Created At: {new Date(job.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  );
};

export default TestPage;