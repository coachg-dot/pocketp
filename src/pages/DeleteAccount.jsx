import React from 'react';
import { Mail, Trash2, ShieldAlert } from 'lucide-react';

export default function DeleteAccount() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-5">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">PocketPitcher</h1>
            <p className="text-xs text-slate-400">Account Deletion</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-8">
        <div className="max-w-lg mx-auto space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Delete Your Account</h2>
            <p className="text-slate-300 leading-relaxed">
              If you would like to delete your PocketPitcher account and all associated data, you can request deletion from this page.
            </p>
          </div>

          {/* How to request */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-white">How to Request Deletion</h3>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              To request deletion, email us at{' '}
              <a
                href="mailto:delete@pocketpitcher.shop?subject=Delete%20My%20Account"
                className="text-blue-400 underline underline-offset-2 font-medium"
              >
                delete@pocketpitcher.shop
              </a>{' '}
              with the subject line <span className="font-semibold text-white">"Delete My Account"</span> and include the email address associated with your PocketPitcher account.
            </p>
            <a
              href="mailto:delete@pocketpitcher.shop?subject=Delete%20My%20Account&body=Hello%2C%0A%0AI%20would%20like%20to%20request%20deletion%20of%20my%20PocketPitcher%20account%20and%20all%20associated%20data.%0A%0AAccount%20email%3A%20%5Benter%20your%20email%20here%5D%0A%0AThank%20you."
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
            >
              <Mail className="w-4 h-4" />
              Send Deletion Request
            </a>
          </div>

          {/* What happens */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-yellow-400" />
              <h3 className="font-semibold text-white">What Happens Next</h3>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              Once we receive your request, we will delete your account and associated personal data within a reasonable timeframe, unless we are required to retain certain information for legal, security, fraud prevention, or compliance purposes.
            </p>
            <p className="text-red-400 text-sm font-medium">
              Account deletion is permanent and cannot be undone.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 px-4 py-4 text-center">
        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} PocketPitcher · <a href="mailto:delete@pocketpitcher.shop" className="hover:text-slate-400 transition-colors">delete@pocketpitcher.shop</a>
        </p>
      </div>
    </div>
  );
}