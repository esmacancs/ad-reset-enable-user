'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { KeyRound, Copy, Check, QrCode, X, Smartphone, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface PasswordQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  password: string;
  username: string;
  displayName: string;
}

export function PasswordQrDialog({ open, onOpenChange, password, username, displayName }: PasswordQrDialogProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!open || !password) return;
    // Build the QR content: password encoded for easy scanning
    const qrContent = `AD Portal\nUser: ${username}\nPassword: ${password}`;
    QRCode.toDataURL(qrContent, {
      width: 256,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    }).then(url => {
      setQrDataUrl(url);
    }).catch(() => {
      setQrDataUrl('');
    });
  }, [open, password, username]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = password;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=500,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Password Reset - ${username}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 40px;
            display: flex;
            justify-content: center;
          }
          .card {
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 32px;
            max-width: 400px;
            width: 100%;
            text-align: center;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin-bottom: 16px;
            color: #0f172a;
            font-size: 20px;
            font-weight: 700;
          }
          .subtitle {
            color: #64748b;
            font-size: 13px;
            margin-bottom: 24px;
          }
          .user-info {
            background: #f1f5f9;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 20px;
          }
          .user-info p {
            font-size: 14px;
            color: #334155;
            margin: 4px 0;
          }
          .user-info .label {
            font-size: 11px;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .password-section {
            margin: 20px 0;
          }
          .password-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
            margin-bottom: 8px;
          }
          .password {
            font-family: 'Courier New', monospace;
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            background: #fff;
            border: 1px dashed #cbd5e1;
            border-radius: 6px;
            padding: 12px;
            letter-spacing: 1px;
          }
          .qr-section {
            margin-top: 20px;
          }
          .qr-section p {
            font-size: 11px;
            color: #94a3b8;
            margin-top: 8px;
          }
          .footer {
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid #e2e8f0;
            font-size: 11px;
            color: #94a3b8;
          }
          .warning {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 6px;
            padding: 8px 12px;
            margin-top: 16px;
            font-size: 11px;
            color: #991b1b;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
            AD Portal - Password Reset
          </div>
          <div class="subtitle">Ministry of Housing - IT Helpdesk</div>
          <div class="user-info">
            <p class="label">User</p>
            <p><strong>${displayName}</strong></p>
            <p style="font-size:12px; color:#64748b;">${username}</p>
          </div>
          <div class="password-section">
            <p class="password-label">New Temporary Password</p>
            <div class="password">${password}</div>
          </div>
          <div class="qr-section">
            <img src="${qrDataUrl}" width="180" height="180" alt="QR Code" style="margin: 0 auto; display: block;" />
            <p>Scan with your phone camera to view the password</p>
          </div>
          <div class="warning">
            This password is temporary. You must change it on your next login.
          </div>
          <div class="footer">
            Generated on ${new Date().toLocaleString('en-OM', { timeZone: 'Asia/Muscat' })}
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <ShieldCheck className="h-5 w-5" />
            Password Reset Successful
          </DialogTitle>
          <DialogDescription>
            A new temporary password has been generated for this user. Share it securely.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* User Info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">
                {displayName?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{displayName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{username}</p>
            </div>
          </div>

          <Separator />

          {/* Password Section */}
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" />
              Temporary Password
            </p>
            <div className="relative group">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-900 dark:bg-slate-950 border border-slate-200 dark:border-slate-700">
                <code className={`flex-1 font-mono text-base text-green-400 tracking-wider ${!showPassword ? 'blur-[6px] select-none' : ''}`}>
                  {password}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-slate-400 hover:text-slate-200 shrink-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <X className="h-4 w-4" /> : <span className="text-[10px] font-medium">Show</span>}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* QR Code Section */}
          <div className="text-center">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-center gap-1.5">
              <QrCode className="h-3.5 w-3.5" />
              Scan QR Code
            </p>
            <div className="flex justify-center">
              {qrDataUrl ? (
                <div className="p-3 bg-white rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <img
                    src={qrDataUrl}
                    alt="Password QR Code"
                    width={200}
                    height={200}
                    className="block"
                  />
                </div>
              ) : (
                <div className="w-[226px] h-[226px] bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                  <div className="animate-pulse text-slate-400 text-sm">Generating...</div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-slate-400 dark:text-slate-500">
              <Smartphone className="h-3.5 w-3.5" />
              Scan with phone camera to view password
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy Password'}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handlePrint}
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect width="12" height="8" x="6" y="14" />
              </svg>
              Print
            </Button>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <svg className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              This password is temporary and will be hidden after closing this dialog. The user must change it on next login.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
