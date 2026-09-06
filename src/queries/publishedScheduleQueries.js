import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { publishedScheduleApi } from "@/api/publishedScheduleApi";

export const publishedScheduleKeys = {
  all: ["published-schedule"],
  public: ["published-schedule-public"],
};

const SCHEDULE_CHANNEL = "published-schedule";

function invalidatePublishedScheduleQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: publishedScheduleKeys.all });
  queryClient.invalidateQueries({ queryKey: publishedScheduleKeys.public });
}

function notifyPublicViewers() {
  const channel = new BroadcastChannel(SCHEDULE_CHANNEL);
  channel.postMessage({ type: "published" });
  channel.close();
}

export function usePublishedSchedules(options = {}) {
  return useQuery({
    queryKey: publishedScheduleKeys.all,
    queryFn: () => publishedScheduleApi.list({ sort: "-date" }),
    ...options,
  });
}

export function usePublicPublishedSchedule(options = {}) {
  return useQuery({
    queryKey: publishedScheduleKeys.public,
    queryFn: () => publishedScheduleApi.getPublic(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    ...options,
  });
}

export function usePublishSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => publishedScheduleApi.upsert(data),
    onSuccess: () => {
      invalidatePublishedScheduleQueries(queryClient);
      notifyPublicViewers();
    },
  });
}
