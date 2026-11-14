// Smithy's one access spec (plan/design-smithy.md §19.2), started in DG1 and extended each phase with a rule, one holder and
// one non-holder each: the view rule through the facade on the repository read (a members-only repository, a site member and
// a visitor), and concealment: a hidden repository, a private one by id, by path and on a rendered page answer exactly as
// what does not exist. DG2's rules: a write needs a confirmed address (on the form's post), code needs a Developer
// (createRef), settings need a Maintainer (storeBranchRule, and the Settings tab and page), ownership needs an Owner
// (setRepositoryVisibility, and the Members' forms and the Archive tab), and no Smithy write is a bearer link's. The rule
// behind each role is Mantle's (SmithyVisibility, SmithyRoles, SmithyMembers).
const fixtures = () => ec.resource.script("component://mr-pass/test/Smithy/SmithyFixtures.js")
const SITE = "PASS_SMITHY_ACCESS"
const HOST = "smithy-access.example.test"
const STRANGER = "pass.smithy.stranger"
const REPORTER = "pass.smithy.reporter"
const DEVELOPER = "pass.smithy.developer"
const MAINTAINER = "pass.smithy.maintainer"
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
        // the stranger has no confirmed address; the others have one, and a role in the group
        f.account(SITE, STRANGER)
        t.work = f.repository(SITE, t.group, "work", "public", FILES)
        for (const [username, role] of [
            [REPORTER, "SmrReporter"],
            [DEVELOPER, "SmrDeveloper"],
            [MAINTAINER, "SmrMaintainer"]
        ])
            f.account(SITE, username, {confirmed: true, role, groupId: t.group})
    },
    cleanup() {
        login("john.doe")
    }
})
feature("the facade carries the view rule: a site member reads a members-only repository, a visitor gets Not Found", {
    when() {
        const f = fixtures()
        const read = username =>
            as(username, () => f.operation("getRepository", {siteId: SITE, repositoryId: t.members.repositoryId}))
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
feature("a write needs a confirmed address: the form of an account without one is refused, and says so", {
    when() {
        const f = fixtures()
        const create = (username, slug) =>
            as(username, () =>
                f.post(SITE, HOST, "createRepository", {
                    groupId: t.group,
                    slug,
                    visibility: "public",
                    operationId: "pass-sma-" + slug,
                    returnTo: "/code/new/repository?namespace=pass-sma"
                })
            )
        return {
            confirmed: create(MAINTAINER, "made"),
            unconfirmed: create(STRANGER, "refused"),
            made: f.route(SITE, HOST, "/code/pass-sma/made")
        }
    },
    then({confirmed, unconfirmed, made}) {
        confirmed.status === 303
        confirmed.location === "/code/pass-sma/made"
        confirmed.cache === "no-store"
        made.screenPath === "/Smithy/RepositoryDetail/Files"
        // the refusal goes back to the form with the design's text, and what was typed
        unconfirmed.status === 303
        unconfirmed.location === "/code/new/repository?namespace=pass-sma"
        unconfirmed.flash.form === "createRepository"
        unconfirmed.flash.error.message === "Confirm your email address to do this."
        unconfirmed.flash.values.slug === "refused"
    }
})
feature("code needs a Developer, settings a Maintainer and ownership an Owner: one holder and one non-holder each", {
    when() {
        const f = fixtures()
        const portal = ec.resource.script("component://mr-pass/screen/Shared/Portal.js")
        const repositoryId = t.work.repositoryId
        const call = (operation, input) => {
            const out = portal.attempt(operation, {siteId: SITE, repositoryId, ...input})
            return out.error ? out.error.reason || out.error.kind : "done"
        }
        const attempt = (username, operation, input) => as(username, () => call(operation, input))
        const branch = name => ({refType: "branch", name, fromRevision: "main", operationId: "pass-sma-" + name})
        const rule = pattern => ({refPattern: pattern, requireMergeRequest: true, operationId: "pass-sma-rule-" + pattern})
        const revision = () => f.operation("getRepository", {siteId: SITE, repositoryId}).repository.revision
        return {
            developer: attempt(DEVELOPER, "createRef", branch("by-developer")),
            reporter: attempt(REPORTER, "createRef", branch("by-reporter")),
            maintainerRule: attempt(MAINTAINER, "storeBranchRule", rule("main")),
            developerRule: attempt(DEVELOPER, "storeBranchRule", rule("next")),
            maintainerVisibility: attempt(MAINTAINER, "setRepositoryVisibility", {
                visibility: "members",
                expectedRevision: revision()
            }),
            // the site's operator is an Owner on the pages
            ownerVisibility: call("setRepositoryVisibility", {visibility: "members", expectedRevision: revision()})
        }
    },
    then({developer, reporter, maintainerRule, developerRule, maintainerVisibility, ownerVisibility}) {
        developer === "done"
        reporter === "accessDenied"
        maintainerRule === "done"
        developerRule === "accessDenied"
        maintainerVisibility === "accessDenied"
        ownerVisibility === "done"
    }
})
feature("a tab is shown to the role that may use it, and Settings is Not Found for anyone else", {
    when() {
        const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
        const forms = ec.resource.script("component://mr-pass/screen/Smithy/SmithyForms.js")
        // what each role reaches, read once from the shell and the settings' own rule, with no page built
        const look = username =>
            as(username, () => {
                const shell = smithy.repositoryShell(SITE, t.work.repositoryId, "/code", "/code/pass-sma/work/-/settings")
                const out = {tabs: shell.tabs.map(tab => tab.label).join(" ")}
                try {
                    const access = forms.settingsAccess(shell)
                    out.settings = access.tabs.join(" ")
                    out.changesMembers = access.changesMembers
                } catch (error) {
                    out.kind = error.moquiErrorKind
                }
                return out
            })
        // Account's Git access is Smithy's page: on a site that mounts no Smithy it is Not Found
        let unmounted = null
        try {
            forms.gitAccess(SITE, {account: "/account"}, {authenticated: true, mounts: [{app: "account"}]}, "/account/GitAccess")
        } catch (error) {
            unmounted = error.moquiErrorKind
        }
        return {reporter: look(REPORTER), maintainer: look(MAINTAINER), unmounted}
    },
    then({reporter, maintainer, unmounted}) {
        // a Reporter has no Settings tab, and the page is as one that does not exist
        reporter.tabs === "Files Commits Branches Tags"
        reporter.kind === "NotFound"
        reporter.settings == null
        // a Maintainer has Settings with Branch rules, reads the members without changing them, and has no Archive
        maintainer.tabs === "Files Commits Branches Tags Settings"
        maintainer.kind == null
        maintainer.settings === "general members branch-rules webhooks"
        maintainer.changesMembers === false
        unmounted === "NotFound"
    }
})
feature("no Smithy write is a bearer link's: none is among the writes a link's token authorizes", {
    when() {
        const operations = Object.keys(ec.resource.script("component://mr-pass/service/pass/SmithySchema.js"))
        const tokenWrites = ec.resource.script("component://mr-pass/service/pass/Transport.js").TOKEN_WRITES
        return {count: operations.length, byToken: operations.filter(name => tokenWrites.includes(name))}
    },
    then({count, byToken}) {
        count > 16
        byToken.length === 0
    }
})
