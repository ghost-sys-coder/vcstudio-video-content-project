export function calculatePagination(input: {
  page: number;
  pageSize: number;
  total: number;
}) {
  return {
    offset: (input.page - 1) * input.pageSize,
    pageCount: Math.max(1, Math.ceil(input.total / input.pageSize)),
  };
}
