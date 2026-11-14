// Smithy's GitHub import and push mirrors (Dogfood DG8; plan/design-smithy.md §6 GroupSettings, §11 RepositorySettings and
// Import): an import started through its form's post on recorded GitHub answers (smithy_github_api names a directory of
// them, so GitHub is never called), the token in no address, no flash and no page; one render of a group's Import tab (the
// start form with a refusal on it and what was typed, the warning of publishPrivate, the group's imports), one of an
// import's page (stage, counts, the rate limit's wait with the time it goes on, the report escaped, Resume and Stop); Stop
// refused without its confirmation, and a mirror's refused form keeping no secret, no username and no user part of its
// address (the Mirrors tab's render is SmithyAccess's). Mantle's
// SmithyGithubImport spec covers the rules behind them; SmithyAccess has who may reach these pages. Regression suite: these
// are the pages' own logic. Run: ./moq test mr-pass --spec SmithyImport
const fixtures = () => ec.resource.script("component://mr-pass/test/Smithy/SmithyFixtures.js")
const SITE = "PASS_SMITHY_IMPORT"
const HOST = "smithy-import.example.test"
const RECORDED = "runtime://tmp/pass-smithy-import/"
const TOKEN = "ghp_PassSmithyImportToken0123456789"
const REFUSED = "ghp_PassSmithyRefusedToken9876543210"
const t = {}
spec({
    requires: ["git"],
    setupSpec() {
        login("john.doe")
        const f = fixtures()
        f.site(SITE, HOST)
        t.group = f.group(SITE, "pass-smi", "public")
        t.repo = f.repository(SITE, t.group, "kept", "public", null)
        // GitHub's answer for acme/tools, and none for acme/missing (a 404, as GitHub answers a repository the token may not read)
        ec.resource.getLocationReference(RECORDED + "repos_acme_tools.json").putText(
            JSON.stringify({
                status: 200,
                headers: {},
                body: {id: 7001, full_name: "acme/tools", private: false, default_branch: "main"}
            })
        )
        setProperty("smithy_github_api", RECORDED.replace(/\/$/, ""))
    }
})
feature(
    "an import starts through its form and goes to its page; a refusal returns to the form; the token is in no address, flash or page",
    {
        when() {
            const f = fixtures()
            const tab = "/code/pass-smi/-/settings/import"
            const start = (source, token, keep) =>
                f.post(
                    SITE,
                    HOST,
                    "startGitHubImport",
                    {
                        groupId: t.group,
                        sourceRepository: source,
                        token,
                        repositoryId: "",
                        slug: "tools",
                        issues: "true",
                        pullRequests: "true",
                        operationId: "pass-smi-" + source.replace("/", "-"),
                        returnTo: tab
                    },
                    true,
                    keep
                )
            const made = start("acme/tools", TOKEN)
            t.importId = (/^\/code\/import\/([A-Za-z0-9_-]+)$/.exec(made.location || "") || [])[1] || null
            // refused by GitHub's answer; the flash is left for the tab's render
            const refused = start("acme/missing", REFUSED, true)
            const page = f.render(SITE, HOST, tab, "Smithy/GroupDetail/Settings", {
                groupId: t.group,
                namePath: "pass-smi",
                tab: "import"
            })
            return {made, refused, page, html: page.html}
        },
        then({made, refused, page, html}) {
            made.status === 303
            t.importId != null
            made.flash.notice === "The import started. It goes on in steps, and this page shows where it is."
            !JSON.stringify(made).includes(TOKEN)
            refused.status === 303
            refused.location === "/code/pass-smi/-/settings/import"
            refused.flash.form === "startGitHubImport"
            refused.flash.error.message.includes("GitHub has no repository acme/missing")
            refused.flash.values.sourceRepository === "acme/missing"
            !JSON.stringify(refused).includes(REFUSED)
            // the tab: its place among the group's tabs, the start form with the refusal and what was typed, the token's field
            // empty, the warning of a private repository, and the import listed with its page
            page.errors.length === 0
            !html.includes("Error rendering")
            html.includes('<a href="/code/pass-smi/-/settings/import" aria-current="page">Import</a>')
            html.includes('<form method="post" class="card" id="Smithy_startGitHubImport" action="/code/-/do/startGitHubImport">')
            html.includes('<p role="alert" class="error" id="Smithy_startGitHubImport_error">')
            html.includes('name="sourceRepository" value="acme/missing"')
            html.includes('<input type="password" name="token" maxlength="1000" required autocomplete="off">')
            !html.includes(REFUSED)
            !html.includes(TOKEN)
            html.includes('name="publishPrivate" value="true"')
            html.includes("becomes visible to everyone who may see the repository here")
            html.includes('<a href="/code/import/' + t.importId + '">acme/tools</a> into <code>pass-smi/tools</code>')
            !html.includes("<script")
        }
    }
)
feature("an import's page shows its stage, counts, the rate limit's wait with its time, the report escaped, Resume and Stop", {
    when() {
        const f = fixtures()
        // the run as a step would leave it (its row written as a step writes it, past the status flow): importing issues, one
        // failed, a reaction the forum lacks, waiting on the limit
        const run = ec.entity.find("mantle.smithy.SmithyImportRun").condition("importId", t.importId).disableAuthz().one()
        run.set("statusId", "SmiIssues")
        run.set(
            "countsJson",
            JSON.stringify({label: {imported: 2, source: 2, failed: 0}, issue: {imported: 3, source: 5, failed: 1}})
        )
        run.set(
            "reportJson",
            JSON.stringify({
                items: [{sourceType: "issue", sourceId: "7", errorText: "<b>refused</b> by a rule"}],
                notCarried: {reactions: {rocket: 2}}
            })
        )
        run.set("waitingUntil", Date.now() + 3600000)
        const was = ec.artifactExecution.disableAuthz()
        try {
            run.update()
        } finally {
            if (!was) ec.artifactExecution.enableAuthz()
        }
        const path = "/code/import/" + t.importId
        const page = f.render(SITE, HOST, path, "Smithy/Import", {importId: t.importId})
        return {page, html: page.html, cache: page.header("Cache-Control")}
    },
    then({page, html, cache}) {
        page.errors.length === 0
        !html.includes("Error rendering")
        html.includes("Import of acme/tools")
        html.includes('Into <a href="/code/pass-smi/tools">pass-smi/tools</a>')
        html.includes("<strong>Importing issues</strong>")
        html.includes('<tr><th scope="row">Issues</th><td>3</td><td>5</td><td>1</td></tr>')
        html.includes('<p role="status" id="SmithyImportWaiting">GitHub\'s rate limit holds this import. It goes on at ')
        html.includes("Issue 7: &lt;b&gt;refused&lt;/b&gt; by a rule")
        html.includes("Not carried, reactions: rocket (2).")
        html.includes("An import never carries the edit history")
        html.includes('<a href="/code/import/' + t.importId + '" id="SmithyImportRefresh">Refresh</a>')
        html.includes(
            '<form method="post" class="card" id="Smithy_resumeGitHubImport_' +
                t.importId +
                '" action="/code/-/do/resumeGitHubImport">'
        )
        html.includes('<a href="/code/import/' + t.importId + '?confirm=cancel" id="SmithyImportCancel">Stop the import</a>')
        !html.includes(TOKEN)
        cache === "no-store"
    }
})
feature(
    "Stop needs its confirmation page's answer; a refused mirror keeps no secret, no username and no user part of its address",
    {
        when() {
            const f = fixtures()
            const stage = () =>
                ec.entity.find("mantle.smithy.SmithyImportRun").condition("importId", t.importId).disableAuthz().one().statusId
            const before = stage()
            const back = "/code/import/" + t.importId
            const unasked = f.post(SITE, HOST, "cancelGitHubImport", {
                importId: t.importId,
                expectedRevision: "1",
                returnTo: back
            })
            const after = stage()
            // refused (notBuilt) on a server whose framework has no push mirrors
            const mirror = f.post(SITE, HOST, "storeMirror", {
                repositoryId: t.repo.repositoryId,
                mirrorId: "",
                url: "https://someone:hunter2pass@git.example.test/a.git",
                username: "mirror-user-name",
                secret: "mirror-secret-0123456789",
                refs: "refs/heads/*",
                enabled: "true",
                operationId: "pass-smi-mirror-1",
                returnTo: "/code/pass-smi/kept/-/settings/mirrors"
            })
            return {before, after, unasked, mirror, kept: JSON.stringify(mirror.flash)}
        },
        then({before, after, unasked, mirror, kept}) {
            unasked.status === 303
            unasked.flash.error.message === "Confirm this change on its own page first."
            after === before
            after !== "SmiCancelled"
            mirror.status === 303
            mirror.flash.form === "storeMirror"
            mirror.flash.error.reason === "notBuilt"
            mirror.flash.values.url === "https://git.example.test/a.git"
            mirror.flash.values.refs === "refs/heads/*"
            !kept.includes("mirror-secret-0123456789")
            !kept.includes("mirror-user-name")
            !kept.includes("hunter2pass")
        }
    }
)
