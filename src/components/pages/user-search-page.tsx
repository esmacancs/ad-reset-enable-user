'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Search, RefreshCw, Lock, Unlock, KeyRound, UserCheck, UserX,
  AlertTriangle, ChevronDown, ChevronUp, Loader2, Shield,
  IdCard, CalendarDays, History, Eye, X, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { PasswordQrDialog } from '@/components/password-qr-dialog';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

interface ADUser {
  displayName: string;
  username: string;
  email: string;
  department: string;
  title: string;
  employeeId: string;
  enabled: boolean;
  locked: boolean;
  lastLogon: string | null;
  groups: string[];
  distinguishedName?: string;
  phone?: string;
  office?: string;
  manager?: string;
  whenCreated?: string;
  passwordLastSet?: string | null;
  description?: string | null;
}

interface VerificationRecord {
  id: number;
  target_username: string;
  civil_id_number: string;
  civil_id_expiry: string;
  verified_by: string;
  agent_ip: string | null;
  operation_type: string | null;
  created_at: string;
}

// --- Civil ID Verification Step ---
function CivilIdVerifyDialog({
  open, onOpenChange, user, operationLabel, operationIcon: OpIcon,
  onVerified, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: ADUser;
  operationLabel: string;
  operationIcon: React.ElementType;
  onVerified: (civilIdNumber: string, civilIdExpiry: string) => void;
  loading: boolean;
}) {
  const [civilId, setCivilId] = useState('');
  const [expiry, setExpiry] = useState('');
  const [lastVerification, setLastVerification] = useState<VerificationRecord | null>(null);
  const [fetching, setFetching] = useState(false);

  // Fetch last verification when dialog opens
  useEffect(() => {
    if (!open || !user?.username) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setCivilId('');
    setExpiry('');
    /* eslint-enable react-hooks/set-state-in-effect */
    setFetching(true);
    api.getVerifications(user.username)
      .then(data => {
        if (data.verifications.length > 0) {
          setLastVerification(data.verifications[0]);
        } else {
          setLastVerification(null);
        }
      })
      .catch(() => setLastVerification(null))
      .finally(() => setFetching(false));
  }, [open, user?.username]);

  const isValid = civilId.trim().length >= 5 && /^\d{4}-\d{2}-\d{2}$/.test(expiry);
  const isExpired = expiry && new Date(expiry) < new Date();

  const handleVerify = () => {
    if (!isValid || isExpired) return;
    onVerified(civilId.trim(), expiry);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IdCard className="h-5 w-5 text-primary" />
            Civil ID Verification Required
          </DialogTitle>
          <DialogDescription>
            Verify the caller's physical Civil ID before performing: <strong>{operationLabel}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* User info */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{user.displayName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user.username} &middot; {user.department}</p>
          </div>
          <Badge variant={user.enabled ? 'default' : 'destructive'} className="text-xs shrink-0">
            {user.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>

        {/* Last verification info */}
        {lastVerification && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <History className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-800 dark:text-blue-200 space-y-0.5">
              <p className="font-medium">Last verified Civil ID on file</p>
              <p>Civil ID: <span className="font-mono font-semibold">{lastVerification.civil_id_number}</span></p>
              <p>Expiry: {lastVerification.civil_id_expiry} &middot; Operation: {lastVerification.operation_type}</p>
              <p>By: {lastVerification.verified_by} &middot; {formatDistanceToNow(new Date(lastVerification.created_at), { addSuffix: true })}</p>
            </div>
          </div>
        )}
        {fetching && !lastVerification && <Skeleton className="h-16 w-full" />}

        {/* Civil ID inputs */}
        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="civilId" className="flex items-center gap-1.5 text-sm font-medium">
              <IdCard className="h-3.5 w-3.5" />
              Civil ID Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="civilId"
              placeholder="Enter the Civil ID number from the physical card"
              value={civilId}
              onChange={e => setCivilId(e.target.value.replace(/[^0-9]/g, ''))}
              className="font-mono text-lg tracking-wider"
              maxLength={15}
              autoFocus
            />
            <p className="text-xs text-slate-500">Enter the number exactly as shown on the physical Civil ID card</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiry" className="flex items-center gap-1.5 text-sm font-medium">
              <CalendarDays className="h-3.5 w-3.5" />
              Civil ID Expiry Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id="expiry"
              placeholder="YYYY-MM-DD"
              value={expiry}
              onChange={e => setExpiry(e.target.value.replace(/[^0-9-]/g, ''))}
              className="font-mono"
              maxLength={10}
            />
            <p className="text-xs text-slate-500">Enter expiry date in YYYY-MM-DD format (e.g. 2030-12-25)</p>
            {isExpired && (
              <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                This Civil ID has expired. Verification cannot proceed.
              </p>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleVerify}
            disabled={!isValid || isExpired || loading}
            className="gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Verify &amp; Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Verification History Dialog ---
function VerificationHistoryDialog({
  open, onOpenChange, username, displayName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  username: string;
  displayName: string;
}) {
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Parent controls fetching via a key prop change or explicit trigger
  useEffect(() => {
    if (!open || !username) return;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const data = await api.getVerifications(username);
        if (!controller.signal.aborted) setRecords(data.verifications);
      } catch {
        if (!controller.signal.aborted) setRecords([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [open, username]);

  const opLabel = (op: string | null) => {
    const map: Record<string, string> = {
      RESET_PASSWORD: 'Password Reset',
      UNLOCK_ACCOUNT: 'Unlock Account',
      ENABLE_ACCOUNT: 'Enable Account',
      DISABLE_ACCOUNT: 'Disable Account',
      FORCE_PASSWORD_CHANGE: 'Force Pwd Change',
    };
    return map[op || ''] || op || '-';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Civil ID Verification History
          </DialogTitle>
          <DialogDescription>{displayName} ({username})</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2 py-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-8">
            <IdCard className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No Civil ID verifications found for this user.</p>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-96 space-y-2">
            {records.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-sm">{r.civil_id_number}</span>
                    <Badge variant="outline" className="text-[10px]">Exp: {r.civil_id_expiry}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{opLabel(r.operation_type)}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verified by <span className="font-medium">{r.verified_by}</span>
                    {r.agent_ip && <> &middot; IP: {r.agent_ip}</>}
                    &middot; {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Main Page ---
export function UserSearchPage() {
  const [query, setQuery] = useState('');
  const [field, setField] = useState<string>('all');
  const [results, setResults] = useState<ADUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const [passwordDialog, setPasswordDialog] = useState<{
    open: boolean;
    password: string;
    username: string;
    displayName: string;
  } | null>(null);

  // Civil ID verification state
  const [verifyDialog, setVerifyDialog] = useState<{
    open: boolean;
    user: ADUser | null;
    operation: string;
    operationLabel: string;
    icon: React.ElementType;
  }>({ open: false, user: null, operation: '', operationLabel: '', icon: KeyRound });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    user: ADUser | null;
    operation: string;
    operationLabel: string;
    civilIdNumber: string;
    civilIdExpiry: string;
    icon: React.ElementType;
    isDanger?: boolean;
  }>({ open: false, user: null, operation: '', operationLabel: '', civilIdNumber: '', civilIdExpiry: '', icon: KeyRound });

  // Optional custom password for Reset Password (blank = auto-generate)
  const [customPassword, setCustomPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Verification history dialog
  const [historyDialog, setHistoryDialog] = useState<{
    open: boolean;
    username: string;
    displayName: string;
  }>({ open: false, username: '', displayName: '' });

  const userRole = useAuthStore(s => s.user?.role || '');
  const requiresCivilId = userRole === 'Password Reset Agent';

  const hasSearch = useAuthStore(s => s.hasPermission('search_users'));
  const hasDetails = useAuthStore(s => s.hasPermission('view_user_details'));
  const hasReset = useAuthStore(s => s.hasPermission('reset_passwords'));
  const hasUnlock = useAuthStore(s => s.hasPermission('unlock_accounts'));
  const hasEnable = useAuthStore(s => s.hasPermission('enable_ad_accounts'));
  const hasDisable = useAuthStore(s => s.hasPermission('disable_ad_accounts'));
  const hasForcePw = useAuthStore(s => s.hasPermission('force_password_change'));

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await api.searchUsers(query.trim(), field === 'all' ? undefined : field);
      setResults(data.users);
      setTotal(data.total);
      setExpandedUser(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [query, field]);

  useEffect(() => {
    if (query.length >= 2) {
      const t = setTimeout(() => handleSearch(), 500);
      return () => clearTimeout(t);
    }
  }, [query, field, handleSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  // Step 1: Open verification — skip Civil ID for Admin/Supervisor, require for Agent
  const openVerifyStep = (user: ADUser, operation: string, label: string, icon: React.ElementType) => {
    setCustomPassword('');
    if (requiresCivilId) {
      // Agent: must verify Civil ID first
      setVerifyDialog({ open: true, user, operation, operationLabel: label, icon });
    } else {
      // Admin/Supervisor: go directly to confirmation
      setConfirmDialog({
        open: true,
        user,
        operation,
        operationLabel: label,
        civilIdNumber: '',
        civilIdExpiry: '',
        icon,
        isDanger: operation === 'disable',
      });
    }
  };

  // Step 2 (Agent only): Civil ID verified -> open confirmation dialog
  const handleCivilIdVerified = (civilIdNumber: string, civilIdExpiry: string) => {
    setVerifyDialog(prev => ({ ...prev, open: false }));
    setCustomPassword('');
    setConfirmDialog({
      open: true,
      user: verifyDialog.user,
      operation: verifyDialog.operation,
      operationLabel: verifyDialog.operationLabel,
      civilIdNumber,
      civilIdExpiry,
      icon: verifyDialog.icon,
      isDanger: verifyDialog.operation === 'disable',
    });
  };

  // Step 3: Confirmed -> execute operation
  const executeOperation = async () => {
    const { user, operation, civilIdNumber, civilIdExpiry } = confirmDialog;
    if (!user) return;

    setConfirmDialog(prev => ({ ...prev, open: false }));
    setOperationLoading(operation);
    try {
      // Only pass civil ID if it was actually provided (Agent flow)
      const cid = civilIdNumber || undefined;
      const cidExp = civilIdExpiry || undefined;
      let result: any;
      switch (operation) {
        case 'reset-password':
          result = await api.resetPassword(user.username, cid, cidExp, customPassword.trim() || undefined);
          break;
        case 'unlock':
          result = await api.unlockAccount(user.username, cid, cidExp);
          break;
        case 'enable':
          result = await api.enableAccount(user.username, cid, cidExp);
          break;
        case 'disable':
          result = await api.disableAccount(user.username, cid, cidExp);
          break;
        case 'force-pw':
          result = await api.forcePasswordChange(user.username, cid, cidExp);
          break;
      }
      toast.success(result.message);
      if ((operation === 'reset-password' || operation === 'force-pw') && result.newPassword) {
        setPasswordDialog({
          open: true,
          password: result.newPassword,
          username: user.username,
          displayName: user.displayName,
        });
      }
      // Refresh search results
      if (query) handleSearch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setOperationLoading(null);
    }
  };


  if (!hasSearch) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">User Search</h2>
        <p className="text-slate-500 dark:text-slate-400">You don't have permission to search users.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">User Search</h2>
        <p className="text-slate-500 dark:text-slate-400">Search and manage Active Directory users{requiresCivilId ? ' &middot; Civil ID verification required for all operations' : ''}</p>
      </div>

      {/* Password QR Code Dialog */}
      {passwordDialog && (
        <PasswordQrDialog
          open={passwordDialog.open}
          onOpenChange={(open) => {
            if (!open) setPasswordDialog(null);
            else setPasswordDialog(prev => prev ? { ...prev, open } : null);
          }}
          password={passwordDialog.password}
          username={passwordDialog.username}
          displayName={passwordDialog.displayName}
        />
      )}

      {/* Search Bar */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, username, email, or employee ID..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={field} onValueChange={setField}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fields</SelectItem>
                  <SelectItem value="username">Username</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="employeeId">Employee ID</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2 hidden sm:inline">Search</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      {results.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Found <span className="font-semibold text-slate-900 dark:text-slate-100">{total}</span> result{total !== 1 ? 's' : ''}
            {total > results.length && <span> (showing first {results.length})</span>}
          </p>
          <Button variant="ghost" size="sm" onClick={handleSearch} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      )}

      {/* Search Results Table */}
      {results.length > 0 && (
        <Card className="shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300 hidden md:table-cell">Username</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300 hidden lg:table-cell">Department</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300 hidden xl:table-cell">Last Logon</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {results.map(user => (
                  <>
                    <tr key={user.username} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{user.displayName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 md:hidden">{user.username}</div>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell text-slate-600 dark:text-slate-400 font-mono text-xs">{user.username}</td>
                      <td className="py-3 px-4 hidden lg:table-cell text-slate-600 dark:text-slate-400">{user.department}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <Badge variant={user.enabled ? 'default' : 'destructive'} className="w-fit text-xs">
                            {user.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                          {user.locked && (
                            <Badge variant="outline" className="w-fit text-xs border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
                              <Lock className="h-3 w-3 mr-1" /> Locked
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden xl:table-cell text-slate-500 dark:text-slate-400 text-xs">
                        {user.lastLogon ? formatDistanceToNow(new Date(user.lastLogon), { addSuffix: true }) : 'Never'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {hasReset && user.enabled && (
                            <Button size="sm" variant="ghost" title="Reset Password"
                              disabled={!!operationLoading}
                              onClick={() => openVerifyStep(user, 'reset-password', 'Reset Password', KeyRound)}>
                              <KeyRound className="h-4 w-4 text-amber-600" />
                            </Button>
                          )}
                          {hasUnlock && user.locked && (
                            <Button size="sm" variant="ghost" title="Unlock Account"
                              disabled={!!operationLoading}
                              onClick={() => openVerifyStep(user, 'unlock', 'Unlock Account', Unlock)}>
                              {operationLoading === 'unlock' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4 text-green-600" />}
                            </Button>
                          )}
                          {hasEnable && !user.enabled && (
                            <Button size="sm" variant="ghost" title="Enable Account"
                              disabled={!!operationLoading}
                              onClick={() => openVerifyStep(user, 'enable', 'Enable Account', UserCheck)}>
                              <UserCheck className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          {hasDisable && user.enabled && (
                            <Button size="sm" variant="ghost" title="Disable Account"
                              disabled={!!operationLoading}
                              onClick={() => openVerifyStep(user, 'disable', 'Disable Account', UserX)}>
                              <UserX className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                          {hasForcePw && user.enabled && (
                            <Button size="sm" variant="ghost" title="Force Password Change"
                              disabled={!!operationLoading}
                              onClick={() => openVerifyStep(user, 'force-pw', 'Force Password Change', Shield)}>
                              {operationLoading === 'force-pw' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4 text-violet-500" />}
                            </Button>
                          )}
                          {hasDetails && (
                            <Button size="sm" variant="ghost" title="Verification History"
                              onClick={() => setHistoryDialog({ open: true, username: user.username, displayName: user.displayName })}>
                              <History className="h-4 w-4 text-slate-500" />
                            </Button>
                          )}
                          {hasDetails && (
                            <Button size="sm" variant="ghost"
                              onClick={() => setExpandedUser(expandedUser === user.username ? null : user.username)}>
                              {expandedUser === user.username ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedUser === user.username && (
                      <tr key={`${user.username}-detail`}>
                        <td colSpan={6} className="bg-slate-50/50 dark:bg-slate-800/20 px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div><span className="text-slate-500 dark:text-slate-400">Title:</span> <span className="font-medium">{user.title}</span></div>
                            <div><span className="text-slate-500 dark:text-slate-400">Employee ID:</span> <span className="font-medium">{user.employeeId}</span></div>
                            <div><span className="text-slate-500 dark:text-slate-400">Email:</span> <span className="font-medium">{user.email}</span></div>
                            <div><span className="text-slate-500 dark:text-slate-400">Groups:</span> <div className="flex flex-wrap gap-1 mt-1">{user.groups.map(g => <Badge key={g} variant="outline" className="text-xs">{g}</Badge>)}</div></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!loading && query.length >= 2 && results.length === 0 && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">No users found matching &quot;{query}&quot;</p>
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      )}

      {/* Step 1: Civil ID Verification Dialog */}
      {verifyDialog.user && (
        <CivilIdVerifyDialog
          open={verifyDialog.open}
          onOpenChange={v => setVerifyDialog(prev => ({ ...prev, open: v }))}
          user={verifyDialog.user}
          operationLabel={verifyDialog.operationLabel}
          operationIcon={verifyDialog.icon}
          onVerified={handleCivilIdVerified}
          loading={!!operationLoading}
        />
      )}

      {/* Step 2: Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={v => setConfirmDialog(prev => ({ ...prev, open: v }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={confirmDialog.isDanger ? 'flex items-center gap-2 text-red-700 dark:text-red-400' : ''}>
              {confirmDialog.isDanger && <AlertTriangle className="h-5 w-5" />}
              {confirmDialog.operationLabel} for {confirmDialog.user?.displayName}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {confirmDialog.operation === 'reset-password'
                    ? `Set a password for ${confirmDialog.user?.username}. Leave the field empty to auto-generate one — a custom password clears the "must change at next logon" flag.`
                    : confirmDialog.operation === 'force-pw'
                    ? `This will set a new temporary password for ${confirmDialog.user?.username} and require a change at next logon. The current password will stop working immediately.`
                    : confirmDialog.operation === 'disable'
                    ? `Are you sure you want to disable ${confirmDialog.user?.displayName} (${confirmDialog.user?.username})? This will prevent the user from logging in.`
                    : `Confirm ${confirmDialog.operationLabel.toLowerCase()} for ${confirmDialog.user?.username}?`
                  }
                </p>
                {confirmDialog.civilIdNumber && (
                  <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                    <p className="text-xs font-medium text-green-800 dark:text-green-200 mb-1">Civil ID Verified</p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      ID: <span className="font-mono font-semibold">{confirmDialog.civilIdNumber}</span>
                      &middot; Expiry: <span className="font-mono">{confirmDialog.civilIdExpiry}</span>
                    </p>
                  </div>
                )}
                {confirmDialog.operation === 'reset-password' && (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Input
                        type={showPw ? 'text' : 'password'}
                        value={customPassword}
                        onChange={e => setCustomPassword(e.target.value)}
                        placeholder="Type a password or leave blank to auto-generate"
                        className="pr-9 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(v => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        aria-label={showPw ? 'Hide password' : 'Show password'}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                    <p className={`text-[11px] ${customPassword && customPassword.length > 0 ? (
                      customPassword.length >= 12 && [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].filter(re => re.test(customPassword)).length >= 3
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-500'
                    ) : 'text-slate-500 dark:text-slate-400'}`}>
                      {customPassword && customPassword.length > 0
                        ? (customPassword.length >= 12 && [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].filter(re => re.test(customPassword)).length >= 3
                          ? 'Meets policy (12+ chars, upper/lower/digit/symbol)'
                          : 'Must be 12+ chars with upper, lower, digit, and symbol')
                        : 'Blank = auto-generate a secure temporary password'}
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeOperation}
              className={confirmDialog.isDanger ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {confirmDialog.operationLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Verification History Dialog */}
      <VerificationHistoryDialog
        open={historyDialog.open}
        onOpenChange={v => setHistoryDialog(prev => ({ ...prev, open: v }))}
        username={historyDialog.username}
        displayName={historyDialog.displayName}
      />
    </div>
  );
}
