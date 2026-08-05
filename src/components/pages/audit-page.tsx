'client';

import { useEffect, useState, useCallback } from 'react';
import { FileDown, Filter, RotateCcw, Clock, ChevronLeft, ChevronRight, IdCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { format } from 'date-fns';

const RESULT_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failure: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  denied: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
};

const ACTION_BADGE_COLORS: Record<string, string> = {
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

export function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const hasAudit = useAuthStore(s => s.hasPermission('view_all_audit_logs'));
  const isAdmin = useAuthStore(s => s.hasPermission('manage_roles'));

  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    agent: '',
    action: '',
    result: '',
  });

  const loadLogs = useCallback(async (page = 1) => {
    if (!hasAudit) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await api.getAuditLogs({ ...filters, page, limit: 20 });
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [hasAudit, filters]);

  useEffect(() => { loadLogs(1); }, [loadLogs]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await api.exportAuditCSV(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported successfully');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportCivilId = async () => {
    setExportingExcel(true);
    try {
      const blob = await api.exportCivilIdExcel();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `civil-id-verifications-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Civil ID report exported successfully');
    } catch (err: any) {
      toast.error(err.message || 'Export failed. Admin only.');
    } finally {
      setExportingExcel(false);
    }
  };

  const clearFilters = () => {
    setFilters({ dateFrom: '', dateTo: '', agent: '', action: '', result: '' });
  };

  if (!hasAudit) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Audit Logs</h2>
        <p className="text-slate-500 dark:text-slate-400">You don't have permission to view audit logs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Audit Logs</h2>
          <p className="text-slate-500 dark:text-slate-400">Complete audit trail of all identity operations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <FileDown className={`h-4 w-4 mr-2 ${exporting ? 'animate-pulse' : ''}`} />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
          {isAdmin && (
            <Button onClick={handleExportCivilId} disabled={exportingExcel}>
              <IdCard className={`h-4 w-4 mr-2 ${exportingExcel ? 'animate-pulse' : ''}`} />
              {exportingExcel ? 'Exporting...' : 'Export Civil ID Report'}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <CardTitle className="text-base">Filters</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <RotateCcw className="h-3 w-3 mr-1" /> Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Date From</Label>
              <Input type="date" value={filters.dateFrom} onChange={e => setFilters({ ...filters, dateFrom: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Date To</Label>
              <Input type="date" value={filters.dateTo} onChange={e => setFilters({ ...filters, dateTo: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Agent</Label>
              <Input placeholder="Username..." value={filters.agent} onChange={e => setFilters({ ...filters, agent: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Action</Label>
              <Select value={filters.action} onValueChange={v => setFilters({ ...filters, action: v === '__all__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="All Actions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Actions</SelectItem>
                  <SelectItem value="LOGIN">Login</SelectItem>
                  <SelectItem value="RESET_PASSWORD">Reset Password</SelectItem>
                  <SelectItem value="UNLOCK_ACCOUNT">Unlock Account</SelectItem>
                  <SelectItem value="ENABLE_ACCOUNT">Enable Account</SelectItem>
                  <SelectItem value="DISABLE_ACCOUNT">Disable Account</SelectItem>
                  <SelectItem value="FORCE_PASSWORD_CHANGE">Force PW Change</SelectItem>
                  <SelectItem value="SEARCH_USER">Search User</SelectItem>
                  <SelectItem value="CREATE_AGENT">Create Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Result</Label>
              <Select value={filters.result} onValueChange={v => setFilters({ ...filters, result: v === '__all__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="All Results" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Results</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failure">Failure</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Info */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{pagination.total}</span> log entries
          (Page {pagination.page} of {pagination.totalPages})
        </p>
      </div>

      {/* Logs Table */}
      <Card className="shadow-sm overflow-hidden">
        {loading ? (
          <CardContent className="p-6 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent>
        ) : logs.length === 0 ? (
          <CardContent className="p-12 text-center">
            <Clock className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">No audit logs found matching your filters</p>
          </CardContent>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Timestamp</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Agent</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Action</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300 hidden md:table-cell">Target</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300 hidden lg:table-cell">Description</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Result</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300 hidden xl:table-cell">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">
                        {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100 font-mono text-xs">{log.agent_username}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${ACTION_BADGE_COLORS[log.action] || 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'}`}>
                          {(log.action || '').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell text-slate-600 dark:text-slate-400 font-mono text-xs">{log.target_username || '-'}</td>
                      <td className="py-3 px-4 hidden lg:table-cell text-slate-500 dark:text-slate-400 text-xs max-w-xs truncate">{log.description || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${RESULT_COLORS[log.result] || ''}`}>
                          {log.result}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden xl:table-cell text-slate-500 dark:text-slate-400 text-xs font-mono">{log.agent_ip || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-500">Page {pagination.page} of {pagination.totalPages}</p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline" size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => loadLogs(pagination.page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => loadLogs(pagination.page + 1)}
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
