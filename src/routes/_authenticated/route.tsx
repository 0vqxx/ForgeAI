import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";

const getAuthServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { userId } = await auth();
  return { userId };
});

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { userId } = await getAuthServerFn();
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
