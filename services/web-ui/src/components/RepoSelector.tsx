import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

interface Repository {
  id: string;
  name: string;
  path: string;
  description?: string;
}

interface RepoSelectorProps {
  onRepoChange: (repoId: string | null) => void;
}

const fetchRepos = async (): Promise<Repository[]> => {
  const response = await fetch('http://localhost:3847/api/repos');
  if (!response.ok) {
    throw new Error('Failed to fetch repositories');
  }
  const data = await response.json();
  return data.repos || [];
};

export function RepoSelector({ onRepoChange }: RepoSelectorProps) {
  const STORAGE_KEY = 'selectedRepoId';
  const [selectedRepo, setSelectedRepo] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY);
  });

  const { data: repos = [], isLoading, error } = useQuery({
    queryKey: ['repos'],
    queryFn: fetchRepos,
  });

  useEffect(() => {
    if (selectedRepo) {
      localStorage.setItem(STORAGE_KEY, selectedRepo);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    onRepoChange(selectedRepo);
  }, [selectedRepo, onRepoChange]);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedRepo(value === 'all' ? null : value);
  };

  if (isLoading) {
    return (
      <div className="text-sm text-zinc-500">
        Loading repositories...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-400">
        Failed to load repositories
      </div>
    );
  }

  if (repos.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="repo-selector" className="text-sm font-medium text-zinc-300">
        Repository:
      </label>
      <select
        id="repo-selector"
        value={selectedRepo || 'all'}
        onChange={handleChange}
        className="px-3 py-1.5 text-sm bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-zinc-600 transition-colors"
      >
        <option value="all">All Repositories</option>
        {repos.map((repo) => (
          <option key={repo.id} value={repo.id}>
            {repo.name}
            {repo.description && ` - ${repo.description}`}
          </option>
        ))}
      </select>
    </div>
  );
}
