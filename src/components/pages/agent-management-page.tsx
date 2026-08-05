'use client';

import { useEffect, useState, useCallback } from 'react';
import { UserPlus, Pencil, Trash2, Loader2, Users, ShieldCheck, Ban, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Agent {
  id: number;
  username: string;
  fullName: string;
  email: string;
  location: string | null;
  phone: string | null;
  status: string;
  role: { id: number; name: string; permissions: string[] };
  failedLogins: number;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Role {
  id: number;
  name: string;
}

const emptyForm = { username: '', password: '', fullName: '', email: '', location: '', phone: '', roleId: 0 };

export function AgentManagementPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [resetTarget, setResetTarget] = useState<Agent | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const hasCreate = useAuthStore(s => s.hasPermission('create_agents'));

  const loadAgents = useCallback(async () => {
    if (!hasCreate) { setLoading(false); return; }
    try {
      const data = await api.getAgents();
      setAgents(data as Agent[]);
      const uniqueRoles = Array.from(new Map((data as Agent[]).map(a => [a.role.id, { id: a.role.id, name: a.role.name }])).values());
      setRoles(uniqueRoles);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [hasCreate]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const handleSave = async () => {
    if (!form.fullName || !form.email || !form.roleId) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!editId && (!form.username || !form.password)) {
      toast.error('Username and password are required for new agents');
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        await api.updateAgent(editId, {
          fullName: form.fullName,
          email: form.email,
          location: form.location || null,
          phone: form.phone || null,
          roleId: form.roleId,
        });
        toast.success('Agent updated successfully');
      } else {
        await api.createAgent({
          username: form.username,
          password: form.password,
          fullName: form.fullName,
          email: form.email,
          location: form.location || undefined,
          phone: form.phone || undefined,
          roleId: form.roleId,
        });
        toast.success('Agent created successfully');
      }
      setDialogOpen(false);
      setEditId(null);
      setForm(emptyForm);
      loadAgents();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteAgent(id);
      toast.success('Agent disabled successfully');
      loadAgents();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openEdit = (agent: Agent) => {
    setEditId(agent.id);
    setForm({
      username: agent.username,
      password: '',
      fullName: agent.fullName,
      email: agent.email,
      location: agent.location || '',
      phone: agent.phone || '',
      roleId: agent.role.id,
    });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setResetting(true);
    try {
      await api.resetAgentPassword(resetTarget.id, newPassword);
      toast.success(`Password reset for ${resetTarget.username}`);
      setResetTarget(null);
      setNewPassword('');
      loadAgents();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setResetting(false);
    }
  };

  if (!hasCreate) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Agent Management</h2>
        <div className="flex items-center gap-2 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <ShieldCheck className="h-5 w-5 text-amber-600" />
          <p className="text-amber-800 dark:text-amber-200 text-sm">Administrator access is required to manage agents.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Agent Management</h2>
          <p className="text-slate-500 dark:text-slate-400">Create and manage call center agents</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><UserPlus className="h-4 w-4 mr-2" /> Create Agent</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? 'Edit Agent' : 'Create New Agent'}</DialogTitle>
              <DialogDescription>{editId ? 'Update agent information and role assignment.' : 'Create a new call center agent account.'}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {!editId && (
                <div className="grid gap-2">
                  <Label htmlFor="ag-username">Username *</Label>
                  <Input id="ag-username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="e.g. agent4" />
                </div>
              )}
              {!editId && (
                <div className="grid gap-2">
                  <Label htmlFor="ag-password">Password *</Label>
                  <Input id="ag-password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Minimum 8 characters" />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="ag-name">Full Name *</Label>
                <Input id="ag-name" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="Full name" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ag-email">Email *</Label>
                <Input id="ag-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="agent@company.local" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="ag-location">Location</Label>
                  <Input id="ag-location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Branch A" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ag-phone">Phone</Label>
                  <Input id="ag-phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="e.g. +968-90000000" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Role *</Label>
                <Select value={String(form.roleId)} onValueChange={v => setForm({ ...form, roleId: Number(v) })}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {roles.map(r => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editId ? 'Update Agent' : 'Create Agent'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!resetTarget} onOpenChange={o => { if (!o) { setResetTarget(null); setNewPassword(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Agent Password</DialogTitle>
            <DialogDescription>
              Set a new login password for <strong>{resetTarget?.fullName}</strong> ({resetTarget?.username}). This also unlocks the account and clears failed login attempts.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="rp-password">New Password</Label>
            <Input id="rp-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 8 characters" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetTarget(null); setNewPassword(''); }}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={resetting}>{resetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Reset Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="shadow-sm overflow-hidden">
        {loading ? (
          <CardContent className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</CardContent>
        ) : agents.length === 0 ? (
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">No agents found</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Agent</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300 hidden md:table-cell">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300 hidden lg:table-cell">Location</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {agents.map(agent => (
                  <tr key={agent.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{agent.fullName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{agent.username}</div>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell text-slate-600 dark:text-slate-400 text-xs">{agent.email}</td>
                    <td className="py-3 px-4 hidden lg:table-cell text-slate-600 dark:text-slate-400">{agent.location || '-'}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs">{agent.role.name}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={agent.status === 'active' ? 'default' : 'destructive'} className="text-xs">
                        {agent.status === 'active' ? 'Active' : 'Disabled'}
                      </Badge>
                      {agent.lockedUntil && new Date(agent.lockedUntil) > new Date() && (
                        <Badge variant="outline" className="text-xs ml-1 border-amber-300 text-amber-700"><Ban className="h-3 w-3 mr-1" />Locked</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(agent)} title="Edit"><Pencil className="h-4 w-4 text-slate-500" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { setResetTarget(agent); setNewPassword(''); }} title="Reset Password"><KeyRound className="h-4 w-4 text-blue-500" /></Button>
                        {agent.status === 'active' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" title="Disable Agent"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Disable Agent Account</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to disable <strong>{agent.fullName}</strong> ({agent.username})? They will no longer be able to access the portal.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(agent.id)} className="bg-red-600 hover:bg-red-700">Disable Agent</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
