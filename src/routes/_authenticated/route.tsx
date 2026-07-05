import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { auth } from "@clerk/tanstack-react-start/server";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { userId } = await auth();
    if (!userId) {
      throw redirect({
        to: "/auth",
        search: { redirect_url: location.href },
      });
    }
    return { userId };
  },
  component: () => <Outlet />,
});
