// Smithy's one access spec (plan/design-smithy.md §19.2), started in DG1 and extended each phase with a rule, one holder and
// one non-holder each: the view rule through the facade on the repository read (a members-only repository, a site member and
// a visitor), and concealment: a hidden repository, a private one by id, by path and on a rendered page answer exactly as
// what does not exist. The rule behind each role is Mantle's (SmithyVisibility, SmithyRoles).
const fixtures = () => ec.resource.script("component://mr-pass/test/Smithy/SmithyFixtures.js")
const SITE = "PASS_SMITHY_ACCESS"
const HOST = "smithy-access.example.test"
const STRANGER = "pass.smithy.stranger"
const t = {}
const FILES = {"README.md": "# Access\n", "src/a.txt": "one\n"}
const as = (username, work) => {
    if (username) login(username, "moqui1!!")
    else logout()
    try {
        return work()
    } finally {
        login("john.doe")
    }
}
spec({
    requires: ["git"],
    setupSpec() {
        login("john.doe")
        const f = fixtures()
        f.site(SITE, HOST)
        t.group = f.group(SITE, "pass-sma", "public")
        t.members = f.repository(SITE, t.group, "inside", "members", FILES)
        t.private = f.repository(SITE, t.group, "secret", "private", FILES)
        t.hidden = f.repository(SITE, t.group, "hidden", "public", FILES)
        f.run("update#mantle.smithy.SmithyRepository", {repositoryId: t.hidden.repositoryId, hiddenAt: Date.now()})
        f.account(SITE, STRANGER)
    },
    cleanup() {
        login("john.doe")
    }
})
feature("the facade carries the view rule: a site member reads a members-only repository, a visitor gets Not Found", {
    when() {
        const f = fixtures()
        const read = username => as(username, () => f.operation("getRepository", {siteId: SITE, repositoryId: t.members.repositoryId}))
        return {member: read(STRANGER), visitor: read(null)}
    },
    then({member, visitor}) {
        member.repository.effectiveVisibility === "members"
        member.capabilities.canPush === false
        visitor.kind === "NotFound"
    }
})
feature("what Smithy conceals answers as what does not exist: by id, by path and on a rendered page", {
    when() {
        const f = fixtures()
        return as(STRANGER, () => ({
            hidden: f.operation("getRepository", {siteId: SITE, repositoryId: t.hidden.repositoryId}),
            missing: f.operation("getRepository", {siteId: SITE, repositoryId: "pass-smithy-none"}),
            concealed: f.operation("getRepository", {siteId: SITE, repositoryId: t.private.repositoryId}),
            routeConcealed: f.route(SITE, HOST, "/code/pass-sma/secret/-/commits/main"),
            routeMissing: f.route(SITE, HOST, "/code/pass-sma/nothing/-/commits/main"),
            routeShown: f.route(SITE, HOST, "/code/pass-sma/inside/-/commits/main"),
            page: f.render(SITE, HOST, "/code/pass-sma/secret/-/commits/main", "Smithy/RepositoryDetail/Commits", {
                repositoryId: t.private.repositoryId,
                namePath: "pass-sma/secret",
                refPath: "main"
            })
        }))
    },
    then({hidden, missing, concealed, routeConcealed, routeMissing, routeShown, page}) {
        hidden.kind === "NotFound"
        missing.kind === "NotFound"
        concealed.kind === "NotFound"
        concealed.message === missing.message
        hidden.message === missing.message
        routeShown.screenPath === "/Smithy/RepositoryDetail/Commits"
        routeConcealed.kind === "NotFound"
        routeConcealed.message === routeMissing.message
        // the page of a private repository is the framework's Not Found, with nothing of the repository in it
        page.errors.length === 1
        page.errors[0].includes("Page not found")
        page.html === ""
    }
})
