'use client';

import { useEffect, useState, useRef } from 'react';
import { Activity, KeyRound, UserX, UserCheck, Users, Clock, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import { formatDistanceToNow } from 'date-fns';

interface DashboardData {
  operationsToday: number;
  passwordResetsToday: number;
  disabledUsersToday: number;
  enabledUsersToday: number;
  activeAgents: number;
  recentActivity: any[];
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  SEARCH_USER: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  RESET_PASSWORD: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  UNLOCK_ACCOUNT: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  ENABLE_ACCOUNT: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  DISABLE_ACCOUNT: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  FORCE_PASSWORD_CHANGE: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  CREATE_AGENT: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  login_failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const RESULT_VARIANTS: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  success: 'default',
  failure: 'destructive',
  denied: 'destructive',
};

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const hasReports = useAuthStore(s => s.hasPermission('view_reports'));
  const loaded = useRef(false);

  useEffect(() => {
    if (!hasReports || loaded.current) return;
    loaded.current = true;
    api.getDashboard().then(setData).catch(() => {});
  }, [hasReports]);

  const loading = data === null && hasReports;

  const stats = data ? [
    { label: 'Total Operations Today', value: data.operationsToday, icon: Activity, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50' },
    { label: 'Password Resets', value: data.passwordResetsToday, icon: KeyRound, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50' },
    { label: 'Disabled Accounts', value: data.disabledUsersToday, icon: UserX, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/50' },
    { label: 'Enabled Accounts', value: data.enabledUsersToday, icon: UserCheck, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/50' },
    { label: 'Active Agents', value: data.activeAgents, icon: Users, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/50' },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Dashboard</h2>
        <p className="text-slate-500 dark:text-slate-400">Overview of today's identity management operations</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-3" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))
          : stats.map(s => (
              <Card key={s.label} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{s.label}</span>
                    <div className={`p-2 rounded-lg ${s.bg}`}>
                      <s.icon className={`h-4 w-4 ${s.color}`} />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{s.value}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-slate-500" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest operations performed across the system</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : data?.recentActivity.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No recent activity</p>
          ) : (
            <div className="space-y-2">
              {data?.recentActivity.map(log => (
                <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <div className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'}`}>
                    {log.action.replace(/_/g, ' ')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 dark:text-slate-100 truncate">
                      <span className="font-medium">{log.agent_username}</span>
                      {log.target_username && <span className="text-slate-500 dark:text-slate-400"> &rarr; {log.target_username}</span>}
                      {log.description && <span className="text-slate-400 dark:text-slate-500 ml-1">&middot; {log.description}</span>}
                    </p>
                  </div>
                  <Badge variant={RESULT_VARIANTS[log.result] || 'outline'} className="text-xs shrink-0">
                    {log.result}
                  </Badge>
                  <span className="text-xs text-slate-400 shrink-0 hidden sm:block">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
