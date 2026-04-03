import { SupportChatManager } from "@/components/admin/support-chat-manager";
import {
  getSupportChatSettings,
  getSupportChatTemplates,
  getAllManagers,
} from "@/lib/support-chat";

export const dynamic = "force-dynamic";

export default async function AdminSupportChatPage() {
  const [settings, templates, managers] = await Promise.all([
    getSupportChatSettings(),
    getSupportChatTemplates(),
    getAllManagers(),
  ]);

  return (
    <SupportChatManager
      initialEnabled={settings.enabled}
      initialTemplates={templates}
      initialManagers={managers.map((m) => ({
        id: m.id,
        name: m.name,
        photoUrl: m.photoUrl,
        isActive: m.isActive,
      }))}
    />
  );
}
