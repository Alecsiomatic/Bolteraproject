import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useEvents(options?: { all?: boolean }) {
  return useQuery({
    queryKey: ["events", options?.all ? "all" : "future"],
    queryFn: () => api.listEvents(options),
    staleTime: 1000 * 60,
  });
}
