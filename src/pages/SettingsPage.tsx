import { Settings as SettingsIcon, Bot, Bell, User, Palette } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-muted-foreground" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your personal OS</p>
      </div>

      <Tabs defaultValue="ai" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="ai" className="text-xs"><Bot className="h-3 w-3 mr-1" /> AI Provider</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs"><Bell className="h-3 w-3 mr-1" /> Notifications</TabsTrigger>
          <TabsTrigger value="account" className="text-xs"><User className="h-3 w-3 mr-1" /> Account</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">AI Provider Configuration</h3>
            <p className="text-xs text-muted-foreground">
              Select your preferred AI provider and model. API keys are stored securely.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Provider</label>
                <select className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary">
                  <option>Lovable AI</option>
                  <option>OpenAI</option>
                  <option>Anthropic Claude</option>
                  <option>Mistral</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Model</label>
                <select className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary">
                  <option>gemini-3-flash-preview</option>
                  <option>gpt-5</option>
                  <option>claude-4-sonnet</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">API Key</label>
                <input
                  type="password"
                  placeholder="Enter your API key..."
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Lovable AI is pre-configured — no key needed.</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">Notification Preferences</h3>
            <div className="space-y-3">
              {["Browser notifications", "Email reminders", "Daily AI briefing"].map(label => (
                <label key={label} className="flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  <div className="w-9 h-5 rounded-full bg-muted relative cursor-pointer">
                    <div className="w-4 h-4 rounded-full bg-muted-foreground absolute left-0.5 top-0.5 transition-transform" />
                  </div>
                </label>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="account" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">Account</h3>
            <p className="text-xs text-muted-foreground">
              Sign in to sync your data across devices. Authentication will be available once the backend is connected.
            </p>
            <button className="text-sm font-medium text-primary hover:underline">
              Connect Account →
            </button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
