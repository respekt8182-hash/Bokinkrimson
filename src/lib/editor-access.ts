import { getAdminSession } from "@/lib/admin-auth";
import { getSession } from "@/lib/auth";

export type EditorSession =
  | {
      kind: "admin";
      id: string;
      isAdmin: true;
    }
  | {
      kind: "owner";
      id: string;
      isAdmin: false;
    };

export async function getEditorSession(): Promise<EditorSession | null> {
  const admin = await getAdminSession();
  if (admin) {
    return {
      kind: "admin",
      id: admin.id,
      isAdmin: true,
    };
  }

  const owner = await getSession();
  if (!owner) {
    return null;
  }

  return {
    kind: "owner",
    id: owner.id,
    isAdmin: false,
  };
}
