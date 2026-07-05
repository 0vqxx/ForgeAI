import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/tanstack-react-start";
import { useAuthedFetch } from "@/lib/api-fetch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Forge" }] }),
  component: AdminDashboard,
});

type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: "user" | "dev" | "admin" | "founder";
  created_at: string;
};

function AdminDashboard() {
  const authedFetch = useAuthedFetch();
  const { user } = useUser();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  useEffect(() => {
    async function loadUsers() {
      if (!user) return;
      try {
        const profileRes = await authedFetch("/api/profile");
        if (!profileRes.ok) return;
        const profile = await profileRes.json();
        setCurrentUserRole(profile.role || null);

        if (!["admin", "dev", "founder"].includes(profile.role || "")) {
          toast.error("Unauthorized: You don't have admin access");
          return;
        }

        const response = await authedFetch("/api/admin/users");
        if (response.ok) {
          const data = await response.json();
          setUsers(data);
        } else {
          toast.error("Failed to load users");
        }
      } catch {
        toast.error("Error loading users");
      } finally {
        setLoading(false);
      }
    }

    void loadUsers();
  }, [user, authedFetch]);

  async function changeRole(userId: string, newRole: "user" | "dev" | "admin" | "founder") {
    try {
      const response = await authedFetch("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (response.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
        toast.success("Role updated successfully");
      } else {
        const error = await response.json().catch(() => ({ message: "Failed" }));
        toast.error(error.message || "Failed to update role");
      }
    } catch {
      toast.error("Error updating role");
    }
  }

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!currentUserRole || !["admin", "dev", "founder"].includes(currentUserRole)) {
    return <div className="p-8 text-red-500">Unauthorized: You don't have admin access</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {user.avatar_url && (
                      <img
                        className="h-10 w-10 rounded-full"
                        src={user.avatar_url}
                        alt=""
                      />
                    )}
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.display_name || "Unknown"}
                      </div>
                      <div className="text-sm text-gray-500">{user.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.role === "founder" ? "bg-purple-100 text-purple-800" :
                    user.role === "admin" ? "bg-red-100 text-red-800" :
                    user.role === "dev" ? "bg-blue-100 text-blue-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {user.role || "user"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {currentUserRole === "founder" && (
                    <select
                      value={user.role || "user"}
                      onChange={(e) => changeRole(user.id, e.target.value as any)}
                      className="border rounded px-2 py-1"
                    >
                      <option value="user">User</option>
                      <option value="dev">Dev</option>
                      <option value="admin">Admin</option>
                      <option value="founder">Founder</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
