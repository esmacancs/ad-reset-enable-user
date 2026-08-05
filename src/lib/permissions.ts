export const PERMISSIONS = {
  search_users: 'search_users',
  view_user_details: 'view_user_details',
  reset_passwords: 'reset_passwords',
  unlock_accounts: 'unlock_accounts',
  enable_ad_accounts: 'enable_ad_accounts',
  disable_ad_accounts: 'disable_ad_accounts',
  force_password_change: 'force_password_change',
  view_reports: 'view_reports',
  view_all_audit_logs: 'view_all_audit_logs',
  export_audit_logs: 'export_audit_logs',
  create_agents: 'create_agents',
  manage_roles: 'manage_roles',
  view_own_audit_logs: 'view_own_audit_logs',
} as const;

export type PermissionName = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<string, PermissionName[]> = {
  Administrator: [
    PERMISSIONS.search_users,
    PERMISSIONS.view_user_details,
    PERMISSIONS.reset_passwords,
    PERMISSIONS.unlock_accounts,
    PERMISSIONS.enable_ad_accounts,
    PERMISSIONS.disable_ad_accounts,
    PERMISSIONS.force_password_change,
    PERMISSIONS.view_reports,
    PERMISSIONS.view_all_audit_logs,
    PERMISSIONS.export_audit_logs,
    PERMISSIONS.create_agents,
    PERMISSIONS.manage_roles,
    PERMISSIONS.view_own_audit_logs,
  ],
  Supervisor: [
    PERMISSIONS.search_users,
    PERMISSIONS.view_user_details,
    PERMISSIONS.reset_passwords,
    PERMISSIONS.unlock_accounts,
    PERMISSIONS.enable_ad_accounts,
    PERMISSIONS.view_reports,
    PERMISSIONS.view_own_audit_logs,
  ],
  'Password Reset Agent': [
    PERMISSIONS.search_users,
    PERMISSIONS.reset_passwords,
    PERMISSIONS.unlock_accounts,
    PERMISSIONS.enable_ad_accounts,
    PERMISSIONS.disable_ad_accounts,
    PERMISSIONS.view_own_audit_logs,
  ],
};
