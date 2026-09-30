import { describe, it, expect } from "vitest"
import { filterTeamIssues } from "./teamFilters"
const issues = [
  {
    id: "one",
    title: "Mobile menu",
    description: "Closes too soon",
    status: "open",
    type: "bug",
    project_id: "web",
  },
  {
    id: "two",
    title: "Homepage",
    description: "Mobile spacing",
    status: "fixed",
    type: "uiux",
    project_id: "web",
  },
  {
    id: "three",
    title: "Mobile menu",
    description: "",
    status: "open",
    type: "bug",
    project_id: "app",
  },
]
describe("team issue filters", () => {
  it("combines project, status, type and case-insensitive search", () => {
    expect(
      filterTeamIssues(issues, {
        query: " MOBILE ",
        project: "web",
        status: "open",
        type: "bug",
      }).map((i) => i.id),
    ).toEqual(["one"])
  })
  it("searches descriptions and allows all statuses", () => {
    expect(
      filterTeamIssues(issues, {
        query: "spacing",
        project: "all",
        status: "all",
        type: "all",
      }).map((i) => i.id),
    ).toEqual(["two"])
  })
})
