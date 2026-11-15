// PASS Marketing's public pages at 390 px (IronStone impl-marketing P23; design-marketing §13, §16.3 scenario 16: public HTML is
// accessible and phone pages fit), on the PASS_HTTP data of MarketingSubscribeFixtures, MarketingFormFixtures, MarketingPagesFixtures
// and MarketingRegisterFixtures, in a browser at a phone's width: Subscribe and its receipt, VerifySubscription for a forged link, the
// Email preferences page by the known subscriber's link, the open survey on SubmitForm, the published landing page with its subscribe
// box, the free offer's Event and Register pages, and Registration for a forged link. Each page has its language, a level-one heading,
// a name for every visible form control and an alternative for every image, and does not scroll sideways. The walk only reads (GETs,
// no form is sent), so it runs beside the other Marketing walks in any order. The publication's id is read as john.doe over the
// authority's entity REST (params.authority, else this server).
// Run: ./moq accept mr-pass --spec MarketingSubscribeFixtures,MarketingFormFixtures,MarketingPagesFixtures,MarketingRegisterFixtures,MarketingPhonePages
const BASE = server.url.replace(/\/$/, "")
const AUTHORITY = String(params.authority || BASE).replace(/\/$/, "")
const viewport = {width: 390, height: 844}
const PREFS = "PASS_HTTP_MK_PREFS" + "0".repeat(22)
const OFFER = "PASS_HTTP_MR_OFFER_FREE"
const read = (who, entity, values) => who.get(AUTHORITY + "/rest/e1/" + entity, {params: values, accept: "json"}).json()
// a page at the phone's width: its status, its text, the first element past the viewport's edge (false when none) and the
// accessibility problems found (the language, a level-one heading, each visible control's name, each image's alternative)
function check(page, path) {
    const status = page.goto(path).status
    const found = page.evaluate(() => {
        const width = document.documentElement.clientWidth
        let overflow = false
        if (document.documentElement.scrollWidth > innerWidth) {
            const over = Array.from(document.querySelectorAll("body *")).find(
                node => node.getBoundingClientRect().right > width + 1
            )
            overflow = over
                ? over.tagName + (over.id ? "#" + over.id : "") + (over.className ? "." + over.className : "")
                : "the page"
        }
        const problems = []
        if (!document.documentElement.getAttribute("lang")) problems.push("no lang on html")
        if (!document.querySelector("h1")) problems.push("no h1")
        const visible = node => {
            const box = node.getBoundingClientRect()
            return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== "hidden"
        }
        const named = node => {
            if ((node.getAttribute("aria-label") || "").trim()) return true
            const labelledBy = node.getAttribute("aria-labelledby")
            if (labelledBy && labelledBy.split(/\s+/).some(id => (document.getElementById(id)?.textContent || "").trim()))
                return true
            if (node.id && document.querySelector(`label[for="${CSS.escape(node.id)}"]`)) return true
            if (node.closest("label")) return true
            if (node.tagName === "BUTTON") return !!(node.textContent || "").trim()
            if (node.tagName === "INPUT" && ["submit", "button", "reset"].includes(node.type)) return !!(node.value || "").trim()
            return !!(node.getAttribute("title") || "").trim()
        }
        for (const node of document.querySelectorAll("input, select, textarea, button")) {
            if (node.type === "hidden" || !visible(node)) continue
            if (!named(node))
                problems.push("unnamed " + node.tagName.toLowerCase() + (node.name ? "[name=" + node.name + "]" : ""))
        }
        for (const image of document.querySelectorAll("img"))
            if (!image.hasAttribute("alt")) problems.push("img without alt " + image.src)
        return {overflow, problems}
    })
    return {path, status, text: page.text(), overflow: found.overflow, problems: found.problems}
}
// a page's failure line, or "" when it opened, fits and has no accessibility problem
const failure = got =>
    got.status !== 200
        ? `${got.path}: status ${got.status}`
        : got.overflow !== false
          ? `${got.path}: scrolls sideways (${got.overflow})`
          : got.problems.length
            ? `${got.path}: ${got.problems.join("; ")}`
            : ""

feature("each public Marketing page at 390 px has its language, a heading, named controls and image alternatives and fits", {
    when() {
        const records = session({user: "john.doe"})
        const open = read(records, "mantle.party.FormPublication", {
            organizationPartyId: "PASS_HTTP_MK_ORG",
            description: "Open survey"
        })[0]?.publicationId
        const page = browser.newPage({viewport})
        const pages = {
            subscribe: check(page, "/marketing/Subscribe"),
            receipt: check(page, "/marketing/Subscribe?sent=1"),
            verify: check(page, "/marketing/VerifySubscription?token=" + "x".repeat(40)),
            preferences: check(page, "/account/EmailPreferences?token=" + PREFS),
            form: check(page, "/marketing/SubmitForm?publication=" + encodeURIComponent(open || "")),
            landing: check(page, "/marketing/pages/spring"),
            event: check(page, "/marketing/Event?offer=" + OFFER),
            register: check(page, "/marketing/Register?offer=" + OFFER),
            registration: check(page, "/marketing/Registration?token=" + "x".repeat(48))
        }
        const failures = Object.values(pages).map(failure).filter(Boolean)
        return {open, pages, failures}
    },
    then({open, pages, failures}) {
        open != null
        failures.join("\n") == ""
        // each page is the one asked for, not an error page: the offered lists, the survey, the landing page's box, the offer
        pages.subscribe.text.includes("Subscribe")
        pages.preferences.text.includes("preferences")
        pages.form.text.length > 0 && !pages.form.text.includes("not available")
        pages.landing.text.includes("Spring in the garden")
        pages.event.text.includes("Register")
        pages.register.text.length > 0
        // a forged link: the page says it is not available, and still fits
        pages.registration.text.toLowerCase().includes("not available")
    }
})
