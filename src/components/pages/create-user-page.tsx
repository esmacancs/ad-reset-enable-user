'use client';

import { useEffect, useState } from 'react';
import {
  UserPlus, Loader2, Eye, EyeOff, RefreshCw, ShieldCheck,
  UserCheck, KeyRound, FolderOpen, Info, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { PasswordQrDialog } from '@/components/password-qr-dialog';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface OUEntry {
  name: string;
  ou: string;
  dn: string;
}

const emptyForm = {
  firstName: '',
  lastName: '',
  displayName: '',
  sAMAccountName: '',
  email: '',
  ou: '',
  department: '',
  title: '',
  office: '',
  phone: '',
  employeeId: '',
  description: '',
  password: '',
  confirmPassword: '',
  autoGenerate: true,
  mustChangePassword: true,
  enabled: true,
};

const nEmpty = (v: string) => v.trim().length > 0;

export function CreateUserPage() {
  const [form, setForm] = useState(emptyForm);
  const [ous, setOus] = useState<OUEntry[]>([]);
  const [domain, setDomain] = useState('');
  const [ousLoading, setOusLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resultDialog, setResultDialog] = useState<{ open: boolean; password: string; username: string; displayName: string } | null>(null);

  const hasCreate = useAuthStore(s => s.hasPermission('create_ad_accounts'));

  const loadOUs = () => {
    setOusLoading(true);
    api.listOUs()
      .then(r => {
        setOus(r.ous);
        setDomain(r.domain);
        setForm(f => ({ ...f, ou: f.ou || r.ous[0]?.dn || '' }));
      })
      .catch(err => toast.error(err.message))
      .finally(() => setOusLoading(false));
  };

  useEffect(() => { loadOUs(); }, []);

  const displayNameValue = form.displayName.trim() || `${form.firstName} ${form.lastName}`.trim();
  const upn = form.sAMAccountName.trim() ? `${form.sAMAccountName.trim()}@${domain || 'ministry.housing.gov.om'}` : '';
  const previewDn = displayNameValue && form.ou ? `CN=${displayNameValue},${form.ou}` : '';

  const pwMeetsPolicy = form.password.length >= 12 && [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].filter(re => re.test(form.password)).length >= 3;
  const pwError = form.password && form.password.length > 0 && !pwMeetsPolicy;

  const canSubmit = !submitting
    && nEmpty(form.firstName) && nEmpty(form.lastName) && nEmpty(form.sAMAccountName)
    && nEmpty(form.email) && nEmpty(form.ou)
    && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(form.sAMAccountName.trim())
    && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())
    && (form.autoGenerate || (nEmpty(form.password) && pwMeetsPolicy && form.password === form.confirmPassword));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await api.createAdUser({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        displayName: displayNameValue,
        sAMAccountName: form.sAMAccountName.trim(),
        email: form.email.trim(),
        ou: form.ou.trim(),
        department: form.department.trim() || undefined,
        title: form.title.trim() || undefined,
        office: form.office.trim() || undefined,
        phone: form.phone.trim() || undefined,
        employeeId: form.employeeId.trim() || undefined,
        description: form.description.trim() || undefined,
        password: form.autoGenerate ? '' : form.password,
        mustChangePassword: form.mustChangePassword,
        enabled: form.enabled,
      });
      toast.success(res.message);
      if (res.newPassword) {
        setResultDialog({
          open: true,
          password: res.newPassword,
          username: form.sAMAccountName.trim(),
          displayName: displayNameValue,
        });
      }
      setForm(emptyForm);
      setOus([]);
      loadOUs();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasCreate) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Create AD User</h2>
        <div className="flex items-center gap-2 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <ShieldCheck className="h-5 w-5 text-amber-600" />
          <p className="text-amber-800 dark:text-amber-200 text-sm">Superadmin access is required to create AD accounts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {resultDialog && (
        <PasswordQrDialog
          open={resultDialog.open}
          onOpenChange={(open) => {
            if (!open) setResultDialog(null);
            else setResultDialog(prev => prev ? { ...prev, open } : prev);
          }}
          password={resultDialog.password}
          username={resultDialog.username}
          displayName={resultDialog.displayName}
        />
      )}

      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Create AD User</h2>
        <p className="text-slate-500 dark:text-slate-400">Provision a new account in Active Directory</p>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-800 dark:text-blue-200">
          The new account is written directly to Active Directory over LDAPS. If &quot;must change password at next logon&quot; is
          left enabled, the user will be prompted to set a personal password on first login.
        </p>
      </div>

      {/* Identity */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /> Identity</CardTitle>
          <CardDescription>Names and login details for the new account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cu-first">First Name <span className="text-red-500">*</span></Label>
              <Input id="cu-first" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="e.g. Ahmed" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cu-last">Last Name <span className="text-red-500">*</span></Label>
              <Input id="cu-last" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="e.g. Al-Rashid" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cu-dn">Display Name</Label>
              <Input id="cu-dn" value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} placeholder="Defaults to First + Last Name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cu-username">Username (sAMAccountName) <span className="text-red-500">*</span></Label>
              <Input
                id="cu-username"
                value={form.sAMAccountName}
                onChange={e => setForm({ ...form, sAMAccountName: e.target.value.toLowerCase() })}
                placeholder="e.g. ahmed.alrashid"
                className="font-mono"
              />
              {form.sAMAccountName && !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(form.sAMAccountName) && (
                <p className="text-xs text-red-500">Letters, numbers, . - _ only; no leading special character.</p>
              )}
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="cu-email">Email / User Principal Name <span className="text-red-500">*</span></Label>
              <Input
                id="cu-email"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="e.g. ahmed.alrashid@ministry.housing.gov.om"
              />
              <p className="text-xs text-slate-500">Sign-in UPN: <span className="font-mono">{upn || '-'}</span></p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organization */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" /> Organization</CardTitle>
          <CardDescription>Where the account lives and its job attributes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Container / OU <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                {ousLoading ? (
                  <div className="flex-1 h-10 rounded-md border border-slate-200 dark:border-slate-700 flex items-center px-3 gap-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading OUs...
                  </div>
                ) : ous.length > 0 ? (
                  <Select value={form.ou} onValueChange={v => setForm({ ...form, ou: v })}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select an OU" /></SelectTrigger>
                    <SelectContent>
                      {ous.map(o => <SelectItem key={o.dn} value={o.dn}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.ou}
                    onChange={e => setForm({ ...form, ou: e.target.value })}
                    placeholder="e.g. OU=Employees,DC=ministry,DC=housing,DC=gov,DC=om"
                    className="flex-1 font-mono text-xs"
                  />
                )}
                <Button variant="outline" size="icon" onClick={loadOUs} title="Refresh OUs">
                  <RefreshCw className={`h-4 w-4 ${ousLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cu-dept">Department</Label>
              <Input id="cu-dept" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="e.g. Information Technology" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cu-title">Title</Label>
              <Input id="cu-title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Specialist" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cu-office">Office</Label>
              <Input id="cu-office" value={form.office} onChange={e => setForm({ ...form, office: e.target.value })} placeholder="e.g. Head Office" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cu-phone">Phone</Label>
              <Input id="cu-phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="e.g. +968-90000000" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cu-empid">Employee ID</Label>
              <Input id="cu-empid" value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} placeholder="e.g. 8399694" />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="cu-desc">Description</Label>
              <Input id="cu-desc" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional notes about this account" />
            </div>
          </div>
          {previewDn && (
            <p className="text-xs text-slate-500 mt-4">DN: <span className="font-mono">{previewDn}</span></p>
          )}
        </CardContent>
      </Card>

      {/* Account / Password */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Account Settings</CardTitle>
          <CardDescription>Initial password and account state</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <Checkbox
              id="cu-auto"
              checked={form.autoGenerate}
              onCheckedChange={(v) => setForm({ ...form, autoGenerate: v === true })}
            />
            <div>
              <Label htmlFor="cu-auto" className="cursor-pointer flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Auto-generate a secure temporary password
              </Label>
              <p className="text-xs text-slate-500 mt-0.5">Recommended — the password is shown in a QR dialog after creation.</p>
            </div>
          </div>

          {!form.autoGenerate && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cu-pw">Password <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    id="cu-pw"
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="12+ chars with upper, lower, digit, symbol"
                    className="pr-9 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {pwError && <p className="text-xs text-red-500">Must be 12+ chars with upper, lower, digit, and symbol.</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cu-pwc">Confirm Password <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    id="cu-pwc"
                    type={showConfirm ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="Re-enter password"
                    className="pr-9 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="text-xs text-red-500">Passwords do not match.</p>
                )}
              </div>
            </div>
          )}

          {!form.autoGenerate && !pwError && form.password && pwMeetsPolicy && form.password === form.confirmPassword && (
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Meets domain password policy.
            </p>
          )}

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <Checkbox
                id="cu-mustchange"
                checked={form.mustChangePassword}
                onCheckedChange={(v) => setForm({ ...form, mustChangePassword: v === true })}
              />
              <div>
                <Label htmlFor="cu-mustchange" className="cursor-pointer flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-primary" /> Must change password at next logon
                </Label>
                <p className="text-xs text-slate-500 mt-0.5">Recommended for new accounts.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="cu-enabled"
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v === true })}
              />
              <div>
                <Label htmlFor="cu-enabled" className="cursor-pointer flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-green-600" /> Enable account immediately
                </Label>
                <p className="text-xs text-slate-500 mt-0.5">Leave unchecked to create the account disabled.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {form.enabled && <Badge variant="outline" className="text-xs">Account will be enabled</Badge>}
        {form.mustChangePassword && <Badge variant="outline" className="text-xs">Force change at logon</Badge>}
        <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2 min-w-[180px]">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {submitting ? 'Creating in AD...' : 'Create AD Account'}
        </Button>
      </div>
    </div>
  );
}