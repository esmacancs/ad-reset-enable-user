'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import {
  Shield, LayoutDashboard, Search, Users, ScrollText,
  LogOut, Settings, Menu, X, ChevronDown,
  Lock, AlertTriangle, Building2, MonitorSmartphone, Wifi, WifiOff, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
interface ADStatus {
  mode: string;
  configured: boolean;
  connected: boolean;
  error: string | null;
  lastCheck: number;
  config: {
    url: string;
    host: string;
    port: number;
    useSSL: boolean;
    baseDN: string;
    domain: string;
    bindDN: string;
  };
}

export type Page = 'dashboard' | 'users' | 'agents' | 'audit' | 'settings';

interface AppShellProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: { page: Page; label: string; icon: React.ElementType; permission?: string }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'view_reports' },
  { page: 'users', label: 'User Search', icon: Search, permission: 'search_users' },
  { page: 'agents', label: 'Agent Management', icon: Users, permission: 'create_agents' },
  { page: 'audit', label: 'Audit Logs', icon: ScrollText, permission: 'view_all_audit_logs' },
  { page: 'settings', label: 'AD Settings', icon: Settings, permission: 'manage_roles' },
];

export function AppShell({ currentPage, onNavigate, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  const logout = useAuthStore(s => s.logout);
  const hasPermission = useAuthStore(s => s.hasPermission);

  const [adStatus, setAdStatus] = useState<ADStatus | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const fetchStatus = () => {
      if (cancelled) return;
      api.getAdStatus().then(setAdStatus).catch(() => {});
    };
    fetchStatus();
    const id = setInterval(fetchStatus, 20000);
    const onFocus = () => fetchStatus();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [token]);

  const handleLogout = () => {
    logout();
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const result = await api.testAdConnection();
      setAdStatus(prev => prev ? { ...prev, connected: result.connected, error: result.error || null, lastCheck: Date.now() } : prev);
    } catch {} finally {
      setTesting(false);
    }
  };

  const visibleNav = NAV_ITEMS.filter(item => !item.permission || hasPermission(item.permission));

  const initials = user?.fullName
    ? user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0 lg:static lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <div className="p-2 rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Shield className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-sm text-slate-900 dark:text-slate-50 truncate">AD Identity Portal</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Management System</p>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-3 px-3">
            <nav className="space-y-1">
              {visibleNav.map(item => {
                const Icon = item.icon;
                const active = currentPage === item.page;
                return (
                  <button
                    key={item.page}
                    onClick={() => { onNavigate(item.page); setSidebarOpen(false); }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                      ${active
                        ? 'bg-primary/10 text-primary dark:bg-primary/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                      }
                    `}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-primary' : ''}`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </ScrollArea>

          {/* User section at bottom */}
          <div className="border-t border-slate-200 dark:border-slate-800 p-3">
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{user?.fullName}</p>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{user?.role}</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between h-14 px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Building2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{adStatus?.config?.useSSL ? 'LDAPS' : 'LDAP'}://</span>
                <span className="font-mono">{adStatus?.config?.host || '10.177.19.9'}:{adStatus?.config?.port || '389'}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 h-4 ${
                    adStatus?.mode === 'mock'
                      ? 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400'
                      : adStatus?.connected
                        ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400'
                        : 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full mr-1 inline-block ${
                    adStatus?.mode === 'mock'
                      ? 'bg-amber-500'
                      : adStatus?.connected ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  {adStatus?.mode === 'mock' ? 'Demo Mode' : adStatus?.connected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline text-sm">{user?.fullName}</span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{user?.fullName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Role: {user?.role}</p>
                  </div>
                  <DropdownMenuSeparator />
                  {hasPermission('manage_roles') && (
                    <>
                      <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                        <Settings className="h-4 w-4 mr-2" /> AD Configuration
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30">
                    <LogOut className="h-4 w-4 mr-2" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 lg:px-6 py-3 mt-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <Lock className="h-3 w-3" />
              <span>AD Identity Management Portal &middot; Secure LDAPS Connection &middot; Fully Audited</span>
            </div>
            <div className="flex items-center gap-3">
              <span>Session: Active</span>
              <span>&middot;</span>
              <span>Domain: {adStatus?.config?.domain || 'ministry.housing.gov.om'}</span>
            </div>
          </div>
        </footer>
      </div>

      {/* AD Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MonitorSmartphone className="h-5 w-5" />
              Active Directory Configuration
            </DialogTitle>
            <DialogDescription>Current {adStatus?.mode === 'mock' ? 'Demo Mode (Mock AD)' : 'Live AD/LDAPS'} connection settings</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {adStatus && (
              <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                adStatus.mode === 'mock'
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                  : adStatus.connected
                    ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
              }`}>
                <Badge variant={adStatus.mode === 'mock' ? 'outline' : adStatus.connected ? 'default' : 'destructive'}>
                  {adStatus.mode === 'mock' ? 'Demo Mode' : adStatus.connected ? 'Connected' : 'Disconnected'}
                </Badge>
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  {adStatus.config.url}
                  {adStatus.connected && adStatus.error === null && ` · ${adStatus.config.domain}`}
                </span>
                {hasPermission('manage_roles') && adStatus.configured && (
                  <Button variant="outline" size="sm" className="ml-auto h-7 text-xs" disabled={testing} onClick={handleTestConnection}>
                    <RefreshCw className={`h-3 w-3 mr-1 ${testing ? 'animate-spin' : ''}`} />
                    {testing ? 'Testing...' : 'Test'}
                  </Button>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Server</p>
                <p className="text-sm font-mono bg-slate-100 dark:bg-slate-800 rounded px-3 py-2">{adStatus?.config?.host || '10.177.19.9'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Port</p>
                <p className="text-sm font-mono bg-slate-100 dark:bg-slate-800 rounded px-3 py-2">{adStatus?.config?.port || '389'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Protocol</p>
                <p className={`text-sm font-mono rounded px-3 py-2 ${adStatus?.config?.useSSL ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'}`}>
                  {adStatus?.config?.useSSL ? 'LDAPS (Secure)' : 'LDAP (Unencrypted)'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Domain</p>
                <p className="text-sm font-mono bg-slate-100 dark:bg-slate-800 rounded px-3 py-2">{adStatus?.config?.domain || 'ministry.housing.gov.om'}</p>
              </div>
              <div className="col-span-2 space-y-1">
                <p className="text-xs font-medium text-slate-500">Base DN</p>
                <p className="text-sm font-mono bg-slate-100 dark:bg-slate-800 rounded px-3 py-2 truncate">{adStatus?.config?.baseDN || 'DC=ministry,DC=housing,DC=gov,DC=om'}</p>
              </div>
              <div className="col-span-2 space-y-1">
                <p className="text-xs font-medium text-slate-500">Service Account</p>
                <p className="text-sm font-mono bg-slate-100 dark:bg-slate-800 rounded px-3 py-2 truncate">{adStatus?.config?.bindDN || '(not configured - running in Demo Mode)'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1">Connection is {adStatus?.mode === 'mock' ? 'in Demo Mode' : 'configured via .env file'}.</p>
                <p>To connect to your real AD server, set <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">AD_BIND_DN</code> and <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">AD_BIND_PASSWORD</code> in the .env file.</p>
                <p className="mt-1 font-mono opacity-80">AD_BIND_DN=svc_portal@ministry.housing.gov.om</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
