import { describe, expect, it } from "vitest";
import { calculatePagination } from "@/lib/domain/pagination";

describe("pagination", () => {
  it("calculates offsets and page counts", () => {
    expect(calculatePagination({ page: 2, pageSize: 12, total: 25 })).toEqual({
      offset: 12,
      pageCount: 3,
    });
  });

  it("keeps an empty collection on page one", () => {
    expect(calculatePagination({ page: 1, pageSize: 12, total: 0 })).toEqual({
      offset: 0,
      pageCount: 1,
    });
  });
});
