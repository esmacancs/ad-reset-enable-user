'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { LoginPage } from '@/components/pages/login-page';
import { DashboardPage } from '@/components/pages/dashboard-page';
import { UserSearchPage } from '@/components/pages/user-search-page';
import { CreateUserPage } from '@/components/pages/create-user-page';
import { AgentManagementPage } from '@/components/pages/agent-management-page';
import { AuditPage } from '@/components/pages/audit-page';
import { AppShell, type Page } from '@/components/layout/app-shell';

export default function Home() {
  const token = useAuthStore(s => s.token);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!token) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage />;
      case 'users': return <UserSearchPage />;
      case 'create-user': return <CreateUserPage />;
      case 'agents': return <AgentManagementPage />;
      case 'audit': return <AuditPage />;
      case 'settings': return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">AD Configuration</h2>
          <p className="text-slate-500 dark:text-slate-400">View the current Active Directory connection settings from the header menu.</p>
        </div>
      );
      default: return <DashboardPage />;
    }
  };

  return (
    <AppShell currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </AppShell>
  );
}
