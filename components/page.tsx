"use client";

import { 
  User, Building2, ShieldCheck, Settings2, 
  Bell, MessageSquare, Trash2, LogOut, ChevronRight,
  Globe, Phone, Mail, Lock
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  return (
    <div className="container max-w-4xl py-12 pb-24">
      <h1 className="font-display text-4xl mb-8">Settings</h1>

      <div className="space-y-12">
        {/* 1. Personal & Business */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-accent font-bold mb-4">Personal & Business</h2>
          <div className="grid gap-4">
            <SettingsItem icon={User} label="Personal Details" sub="Name, Profile Photo, Bio" />
            <div className="surface border rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="h-5 w-5 text-muted" />
                <h3 className="font-bold">Business Details</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <SettingsInput label="Company Name" placeholder="Agnora Auto LTD" />
                <SettingsInput label="Website Link" placeholder="https://..." />
                <div className="sm:col-span-2">
                  <SettingsInput label="Store Address" placeholder="123 Nairobi Road, Westlands" />
                </div>
                <SettingsInput label="Business Hours" placeholder="9AM - 6PM" />
              </div>
            </div>
          </div>
        </section>

        {/* 2. Verification */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-accent font-bold mb-4">Verification</h2>
          <div className="surface border rounded-2xl overflow-hidden">
            <SettingsItem icon={ShieldCheck} label="KRA PIN Verification" sub="Submit your tax details" border />
            <SettingsItem icon={Globe} label="Proof of Address" sub="Utility bill or lease agreement" />
          </div>
        </section>

        {/* 3. Account Controls */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-accent font-bold mb-4">Account Controls</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <SettingsItem icon={Phone} label="Change Phone" sub="+254 7XX..." />
            <SettingsItem icon={Mail} label="Change Email" sub="user@agnora.com" />
            <SettingsItem icon={Globe} label="Change Language" sub="English" />
            <SettingsItem icon={Lock} label="Change Password" />
          </div>
        </section>

        {/* 4. Preferences */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-accent font-bold mb-4">Preferences</h2>
          <div className="surface border rounded-2xl p-2">
            <ToggleItem label="Automatic Ad Sharing" description="Post new listings to social media automatically." defaultChecked />
            <ToggleItem label="Disable Chats" description="Potential buyers will only see your phone number." />
            <ToggleItem label="Disable Feedback" description="Hide rating and reviews from your public profile." />
            <SettingsItem icon={Bell} label="Manage Notifications" sub="Email, Push, SMS" />
          </div>
        </section>

        {/* 5. Danger Zone */}
        <section className="pt-8 border-t">
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-surface-2 border font-bold hover:bg-surface transition-colors"
            >
              <LogOut className="h-4 w-4" /> Log Out
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 font-bold hover:bg-red-500/20 transition-colors">
              <Trash2 className="h-4 w-4" /> Delete Account Permanently
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function SettingsItem({ icon: Icon, label, sub, border }: any) {
  return (
    <button className={cn(
      "w-full flex items-center gap-4 p-4 hover:bg-surface-2 transition-colors text-left",
      !sub ? "surface border rounded-2xl" : "bg-transparent",
      border && "border-b"
    )}>
      <div className="h-10 w-10 rounded-xl bg-surface-2 border flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-muted" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">{label}</p>
        {sub && <p className="text-xs text-muted truncate">{sub}</p>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted" />
    </button>
  );
}

function SettingsInput({ label, ...props }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] uppercase tracking-widest font-bold text-muted">{label}</label>
      <input {...props} className="w-full h-11 bg-surface-2 border rounded-xl px-4 text-sm outline-none focus:border-accent" />
    </div>
  );
}

function ToggleItem({ label, description, defaultChecked }: any) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex-1 pr-4">
        <p className="font-bold text-sm">{label}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" defaultChecked={defaultChecked} className="sr-only peer" />
        <div className="w-11 h-6 bg-surface-3 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
      </label>
    </div>
  );
}