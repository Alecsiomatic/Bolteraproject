import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useEventLayout(eventId?: string) {
  return useQuery({
    queryKey: ["event-layout", eventId],
    queryFn: () => {
      if (!eventId) {
        throw new Error("eventId is required");
      }
      return api.getEventLayout(eventId);
    },
    enabled: Boolean(eventId),
    staleTime: 1000 * 60,
  });
}
