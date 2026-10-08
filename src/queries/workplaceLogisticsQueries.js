import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workplaceLogisticsApi } from "@/api/workplaceLogisticsApi";

export const workplaceLogisticsKeys = {
  all: ["workplace-logistics"],
  byDate: (date) => [...workplaceLogisticsKeys.all, date],
  pendingUnits: () => [...workplaceLogisticsKeys.all, "pending-units"],
};

function invalidateWorkplaceLogisticsQueries(queryClient, date) {
  queryClient.invalidateQueries({ queryKey: workplaceLogisticsKeys.pendingUnits() });
  if (date) {
    queryClient.invalidateQueries({ queryKey: workplaceLogisticsKeys.byDate(date) });
    queryClient.invalidateQueries({ queryKey: ["assignments", date] });
  } else {
    queryClient.invalidateQueries({ queryKey: workplaceLogisticsKeys.all });
    queryClient.invalidateQueries({ queryKey: ["assignments"] });
  }
}

function readPiecework(variables) {
  if (
    variables?.data &&
    Object.prototype.hasOwnProperty.call(variables.data, "is_piecework")
  ) {
    return Boolean(variables.data.is_piecework);
  }
  if (
    variables &&
    Object.prototype.hasOwnProperty.call(variables, "is_piecework")
  ) {
    return Boolean(variables.is_piecework);
  }
  return undefined;
}

function patchLogisticsPiecework(current, { id, workplaceId, date, isPiecework }) {
  const list = Array.isArray(current) ? current : [];
  let found = false;
  const next = list.map((item) => {
    const matches =
      (id && item.id === id) ||
      (!id && workplaceId && item.workplace_id === workplaceId);
    if (!matches) return item;
    found = true;
    return { ...item, is_piecework: isPiecework };
  });
  if (!found && workplaceId) {
    next.push({
      date,
      workplace_id: workplaceId,
      is_piecework: isPiecework,
    });
  }
  return next;
}

async function optimisticPiecework(queryClient, variables) {
  const isPiecework = readPiecework(variables);
  const date = variables?.date;
  if (!date || isPiecework === undefined) return {};
  const queryKey = workplaceLogisticsKeys.byDate(date);
  await queryClient.cancelQueries({ queryKey });
  const previous = queryClient.getQueryData(queryKey);
  const id = variables.id;
  const workplaceId = variables.workplace_id || variables.data?.workplace_id;
  queryClient.setQueryData(queryKey, (current) =>
    patchLogisticsPiecework(current, { id, workplaceId, date, isPiecework }),
  );
  return { queryKey, previous };
}

function rollbackPiecework(queryClient, context) {
  if (!context?.queryKey || !Object.prototype.hasOwnProperty.call(context, "previous")) {
    return;
  }
  queryClient.setQueryData(context.queryKey, context.previous);
}

export function useWorkplaceLogisticsByDate(date, options = {}) {
  return useQuery({
    queryKey: workplaceLogisticsKeys.byDate(date),
    queryFn: ({ signal }) => workplaceLogisticsApi.list({ date }, { signal }),
    enabled: !!date,
    ...options,
  });
}

export function usePendingPieceworkQuantities(options = {}) {
  return useQuery({
    queryKey: workplaceLogisticsKeys.pendingUnits(),
    queryFn: ({ signal }) =>
      workplaceLogisticsApi.list({ units_status: "ממתין" }, { signal }),
    ...options,
  });
}

/**
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, any>}
 */
export function useCreateWorkplaceLogistics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => workplaceLogisticsApi.create(data),
    onMutate: (variables) => optimisticPiecework(queryClient, variables),
    onError: (_error, _variables, context) => {
      rollbackPiecework(queryClient, context);
    },
    onSuccess: (_result, variables) => {
      invalidateWorkplaceLogisticsQueries(queryClient, variables?.date);
    },
  });
}

/**
 * @typedef {object} WorkplaceLogisticsUpdateInput
 * @property {string} id
 * @property {Record<string, unknown>} data
 * @property {string} [date]
 * @property {string} [workplaceId]
 */

/**
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, WorkplaceLogisticsUpdateInput>}
 */
export function useUpdateWorkplaceLogistics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {WorkplaceLogisticsUpdateInput} */ vars) =>
      workplaceLogisticsApi.update(vars.id, vars.data),
    onMutate: (variables) => optimisticPiecework(queryClient, variables),
    onError: (_error, _variables, context) => {
      rollbackPiecework(queryClient, context);
    },
    onSuccess: (_result, variables) => {
      invalidateWorkplaceLogisticsQueries(queryClient, variables?.date);
    },
  });
}
