import { describe, expect, it } from "vitest";
import { buildViews, primaryPage, resolveLayout, viewIndexOfPage } from "./views";

describe("resolveLayout", () => {
  it("keeps explicit layouts", () => {
    expect(resolveLayout("single", { width: 2000, height: 800 })).toBe("single");
    expect(resolveLayout("spread", { width: 300, height: 800 })).toBe("spread");
    expect(resolveLayout("scroll", { width: 2000, height: 800 })).toBe("scroll");
  });

  it("auto picks a spread only when wide enough and landscape", () => {
    expect(resolveLayout("auto", { width: 768, height: 600 })).toBe("spread");
    expect(resolveLayout("auto", { width: 767, height: 600 })).toBe("single");
    expect(resolveLayout("auto", { width: 900, height: 1200 })).toBe("single");
    expect(resolveLayout("auto", { width: 390, height: 844 })).toBe("single");
  });
});

describe("buildViews", () => {
  it("single layout has one page per view", () => {
    expect(buildViews(3, "single")).toEqual([[0], [1], [2]]);
  });

  it("spread places the cover alone on the right (even count)", () => {
    expect(buildViews(4, "spread")).toEqual([[null, 0], [1, 2], [3, null]]);
  });

  it("spread with odd count ends on a full pair", () => {
    expect(buildViews(5, "spread")).toEqual([[null, 0], [1, 2], [3, 4]]);
  });

  it("handles one page and no pages", () => {
    expect(buildViews(1, "spread")).toEqual([[null, 0]]);
    expect(buildViews(0, "single")).toEqual([]);
  });
});

describe("page and view lookups", () => {
  const views = buildViews(6, "spread");

  it("finds the view containing a page", () => {
    expect(viewIndexOfPage(views, 0)).toBe(0);
    expect(viewIndexOfPage(views, 2)).toBe(1);
    expect(viewIndexOfPage(views, 5)).toBe(3);
  });

  it("clamps pages beyond the end to the last view", () => {
    expect(viewIndexOfPage(views, 99)).toBe(views.length - 1);
  });

  it("primary page is the left page or the only page", () => {
    expect(primaryPage([null, 0])).toBe(0);
    expect(primaryPage([3, 4])).toBe(3);
    expect(primaryPage([7])).toBe(7);
  });
});
