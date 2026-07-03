import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import superjson from "superjson";
import App from "./App";
// OAuth disabled - using email/password login
// import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes default cache for better performance
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
      retry: 1, // Only retry once on failure
      refetchOnWindowFocus: false, // Don't refetch on window focus
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // Redirect to login page instead of OAuth
  window.location.href = "/login";
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
    // U-07: Mutationen ohne eigenes onError-Handling schlugen bisher stumm
    // fehl (nur console). Generischer deutscher Fehler-Toast als Fallback.
    if (!event.mutation.options.onError) {
      toast.error("Aktion fehlgeschlagen", {
        description: "Die Änderung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
      });
    }
  }
});

const trpcClient = trpc.createClient({
  links: [
    // httpLink (not httpBatchLink): each query is its own request so one slow
    // endpoint (e.g. the Copilot LLM ~5s) no longer head-of-line-blocks the
    // critical KPI queries. Fast queries return independently.
    httpLink({
      url: "/api/trpc",
      // @ts-expect-error - tRPC v11 type inference issue with transformer
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
