import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { ListView } from "./ListView"

const noop = () => {}
describe("issue list navigation", () => {
  it("keeps the heading and search available in an empty workspace", () => {
    const html = renderToStaticMarkup(
      createElement(ListView, {
        title: "Open issues",
        subtitle: "Work to do",
        issues: [],
        projects: [],
        screenshotUrls: {},
        onSelectIssue: noop,
        onNewIssue: noop,
        onToggleFixed: noop,
        onCopyPrompt: noop,
        onDeleteIssue: noop,
      }),
    )
    expect(html).toMatch(/<h1[^>]*>Open issues<\/h1>/)
    expect(html).toContain('aria-label="Search issues"')
  })
})
