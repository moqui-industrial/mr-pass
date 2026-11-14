// Smithy (Dogfood DG1; plan/design-smithy.md §4.4, §7, §19.1): the route resolver's grammar (service/pass/SmithyRoutes.js, the
// smithy branch of pass.RouteServices.resolve#Route) with the name lookup stubbed, then through the resolver on a site with a
// group and a repository; one render each of Files, Blob and CommitDetail with its checks; and the operations PASS registers
// against Mantle's. DG2 (§4.4, §11): the paths of the pages that write, one render of a repository's Settings and one of
// Account's Git access, and a form's post through Smithy/Do: the redirect after a write, a refusal shown on its form, the
// confirmation an ending action needs, and the session token. Mantle's SmithyPaths, SmithyVisibility and SmithyRoles specs
// cover the rules behind the reads, and its DG2 specs those behind the writes. DG3 (§8): the issue paths, one render each of
// Issues, IssueDetail (the conversation's rendered Markdown, cleaned; the reactions and the forms by capability) and
// NewIssue, and an issue filed through Smithy/Do, its refusal and its preview. Mantle's SmithyIssues, SmithyIssueProjection
// and SmithyConfidential specs cover the rules behind them.
const fixtures = () => ec.resource.script("component://mr-pass/test/Smithy/SmithyFixtures.js")
const routes = () => ec.resource.script("component://mr-pass/service/pass/SmithyRoutes.js")
const SITE = "PASS_SMITHY"
const HOST = "smithy.example.test"
const KEYS = "pass.smithy.keys"
const PLAIN = "pass.smithy.plain"
const state = {}
// what the authority would answer for a lowered name path
const NAMES = {
    moqui: {kind: "group", groupId: "G1", canonicalPath: "moqui"},
    "moqui/addons": {kind: "group", groupId: "G2", canonicalPath: "moqui/addons"},
    "moqui/mr-moqui": {kind: "repository", repositoryId: "R1", canonicalPath: "moqui/mr-moqui"},
    "moqui/addons/mantle-usl": {kind: "repository", repositoryId: "R2", canonicalPath: "moqui/addons/mantle-usl"},
    jane: {kind: "account", handle: "jane", canonicalPath: "jane"},
    "moqui/old-name": {kind: "redirect", redirectPath: "moqui/mr-moqui"},
    "moqui/mr-moqui/pull/7": {kind: "redirect", redirectPath: "moqui/mr-moqui/-/merge-requests/7"},
    "Moqui/mr-moqui/blob/main/Docs/README.md": {kind: "redirect", redirectPath: "moqui/mr-moqui/-/blob/main/Docs/README.md"},
    "moqui/mr-moqui/blob/main/LICENSE": {kind: "redirect", redirectPath: "moqui/mr-moqui/-/blob/main/LICENSE"},
    "moqui/mr-moqui/blob/main/x.git": {kind: "redirect", redirectPath: "moqui/mr-moqui/-/blob/main/x.git"}
}
const asked = []
function parse(path, base) {
    try {
        return routes().parse(path, base == null ? "/code" : base, name => {
            asked.push(name)
            // the authority lowers a name path itself; a form GitHub has is answered as it was typed
            return NAMES[name] || (/\/(?:blob|pull)\//.test(name) ? null : NAMES[name.toLowerCase()]) || null
        })
    } catch (error) {
        return {kind: error.moquiErrorKind || "Error"}
    }
}
spec({
    requires: ["git"],
    setupSpec() {
        login("john.doe")
        const f = fixtures()
        f.site(SITE, HOST)
        state.group = f.group(SITE, "pass-smg", "public")
        // a public account with a confirmed address, for its own git access
        f.account(SITE, KEYS, {confirmed: true})
        const made = f.repository(SITE, state.group, "web", "public", {
            "README.md": "# Web sample\n\nThe *web* repository.\n\n<script>alert(1)</script>\n",
            "docs/Guide.md":
                "# Guide\n\n[Up](../README.md) [Out](../../../etc/passwd) [Site](https://example.test/a) ![Logo](img/logo.png)\n",
            'docs/n\u00e9"w.txt': "plain <b>text</b>\n",
            "src/main.js": "const a = 1\nif (a < 2) console.log('<script>alert(1)</script>')\n"
        })
        state.repo = made.repositoryId
        state.first = made.commitId
        // a branch whose name has a slash, with a second commit on main after it
        f.run("org.moqui.git.GitServices.create#GitRef", {repositoryId: state.repo, refName: "feature/login", refType: "branch"})
        state.second = f.commit(state.repo, "Greet everyone & all\n\nA longer note.", {
            "src/main.js": "const a = 1\nconsole.log('hello')\n"
        })
        // DG3: issues on, a label, an issue of the site's owner written in Markdown, and an account with no confirmed address
        f.issuesOn(SITE, state.repo)
        state.label = f.run("mantle.smithy.SmithyIssueServices.store#Label", {
            input: {
                siteId: SITE,
                repositoryId: state.repo,
                name: "bug",
                color: "red",
                description: "Something is wrong",
                operationId: "pass-smg-label-1"
            }
        }).result.labelId
        state.issue = f.issue(SITE, state.repo, {
            title: "Tree page breaks <b>",
            body: "It **breaks** on `main`.\n\n<script>alert(1)</script>\n",
            labelIds: [state.label]
        })
        // the second commit is linked to the issue, as a push that names it would link it
        f.run("mantle.work.GitServices.add#TaskCommit", {
            workEffortId: f.operation("getIssue", {siteId: SITE, repositoryId: state.repo, issueNumber: state.issue.issueNumber}).issue
                .workItemKey,
            repositoryId: state.repo,
            commitId: state.second
        })
        f.account(SITE, PLAIN)
    }
})
feature("the grammar: names, then a section after /-/, with the authority telling a group, a repository and an account apart", {
    when() {
        asked.length = 0
        const out = {
            home: parse(""),
            explore: parse("explore"),
            group: parse("moqui"),
            subgroup: parse("moqui/addons"),
            repository: parse("moqui/mr-moqui"),
            nested: parse("moqui/addons/mantle-usl/-/tags"),
            account: parse("jane"),
            accountSection: parse("jane/-/members"),
            members: parse("moqui/-/members"),
            groupRepositories: parse("moqui/addons/-/repositories"),
            // a ref with a slash is not split here: the authority's read splits refPath
            tree: parse("moqui/mr-moqui/-/tree/feature/login/src/Main%20File.rs"),
            blob: parse("moqui/mr-moqui/-/blob/main/README.md"),
            blobBare: parse("moqui/mr-moqui/-/blob"),
            raw: parse("moqui/mr-moqui/-/raw/v1.0/a.qvue"),
            commits: parse("moqui/mr-moqui/-/commits"),
            commit: parse("moqui/mr-moqui/-/commit/0123ABCdef"),
            commitBad: parse("moqui/mr-moqui/-/commit/main"),
            compare: parse("moqui/mr-moqui/-/compare/main...feature/login"),
            compareFork: parse("moqui/mr-moqui/-/compare/main...jane/mr-moqui:fix"),
            compareHead: parse("moqui/mr-moqui/-/compare/topic"),
            branches: parse("moqui/mr-moqui/-/branches"),
            // a later phase's section is in the grammar, and not routed until its screen is built
            mergeRequest: parse("moqui/mr-moqui/-/merge-requests/7"),
            // DG3: the issue pages of a repository and of a group, and the composer's island
            issues: parse("moqui/mr-moqui/-/issues"),
            issueNew: parse("moqui/mr-moqui/-/issues/new"),
            issue: parse("moqui/mr-moqui/-/issues/12"),
            issueZero: parse("moqui/mr-moqui/-/issues/012"),
            issueDeeper: parse("moqui/mr-moqui/-/issues/12/edit"),
            labels: parse("moqui/mr-moqui/-/labels"),
            milestone: parse("moqui/mr-moqui/-/milestones/M_1"),
            groupIssues: parse("moqui/-/issues"),
            island: parse("-/island/Composer.qvue"),
            islandBad: parse("-/island/composer.html"),
            // redirects: the stored case, a .git suffix, a renamed path (the section kept), a compatibility form
            mixedCase: parse("Moqui/MR-Moqui/-/tree/Main"),
            dotGit: parse("moqui/mr-moqui.git", ""),
            renamed: parse("moqui/old-name/-/commits/main"),
            compatibility: parse("moqui/mr-moqui/pull/7"),
            // a form GitHub has, with a file's path: only the name prefix is checked, the rest keeps its case
            githubBlob: parse("Moqui/mr-moqui/blob/main/Docs/README.md"),
            // one whose rest is all valid names keeps its case too, and a file x.git keeps its name
            githubUpper: parse("moqui/mr-moqui/blob/main/LICENSE"),
            githubGit: parse("moqui/mr-moqui/blob/main/x.git"),
            // an empty segment redirects to the one address of the page, never to another host's
            doubled: parse("//moqui//mr-moqui/-/tree/main/", ""),
            dotFile: parse("moqui/mr-moqui/-/blob/main/.gitignore"),
            archive: parse("moqui/mr-moqui/-/archive/v1.0.tar.gz"),
            // Not Found
            dotDot: parse("moqui/mr-moqui/-/tree/main/../secret"),
            encodedSlash: parse("moqui/mr-moqui/-/tree/main%2Fx"),
            unknownSection: parse("moqui/mr-moqui/-/nothing"),
            emptySection: parse("moqui/mr-moqui/-"),
            groupTree: parse("moqui/-/tree/main"),
            unknownName: parse("moqui/tree"),
            badName: parse("-moqui"),
            sixNames: parse("a1/b1/c1/d1/e1/f1"),
            reserved: parse("explore/moqui"),
            newThing: parse("new/thing"),
            // DG2: the create pages, the site's settings, a form's transition, and the settings of a group and a repository
            newGroup: parse("new/group"),
            newRepository: parse("new/repository"),
            site: parse("-/site"),
            siteTab: parse("-/site/requests"),
            siteBad: parse("-/site/nothing"),
            form: parse("-/do/createRepository"),
            formBad: parse("-/do/Create-repository"),
            groupSettings: parse("moqui/-/settings/delete"),
            repositorySettings: parse("moqui/mr-moqui/-/settings/branch-rules"),
            repositorySettingsBad: parse("moqui/mr-moqui/-/settings/nothing")
        }
        return {out, asked: asked.slice(), built: routes().BUILT}
    },
    then({out, asked, built}) {
        out.home.screenPath === "/Smithy/Home"
        out.explore.screenPath === "/Smithy/Explore"
        out.group.screenPath === "/Smithy/GroupDetail/Overview"
        out.group.screenParameters.groupId === "G1"
        out.subgroup.screenPath === "/Smithy/GroupDetail/Overview"
        out.subgroup.screenParameters.namePath === "moqui/addons"
        out.repository.screenPath === "/Smithy/RepositoryDetail/Files"
        out.repository.screenParameters.repositoryId === "R1"
        out.repository.screenParameters.refPath === ""
        out.nested.screenPath === "/Smithy/RepositoryDetail/Tags"
        out.nested.screenParameters.repositoryId === "R2"
        out.account.screenPath === "/Smithy/AccountDetail"
        out.account.screenParameters.handle === "jane"
        out.accountSection.kind === "NotFound"
        out.members.screenPath === "/Smithy/GroupDetail/Members"
        out.groupRepositories.screenParameters.groupId === "G2"
        out.tree.screenPath === "/Smithy/RepositoryDetail/Files"
        out.tree.screenParameters.refPath === "feature/login/src/Main File.rs"
        out.blob.screenPath === "/Smithy/RepositoryDetail/Blob"
        out.blob.screenParameters.refPath === "main/README.md"
        out.blobBare.kind === "NotFound"
        // a file whose name ends like a render mode is a parameter, never part of the screen path
        out.raw.screenPath === "/Smithy/RepositoryDetail/raw"
        out.raw.screenParameters.refPath === "v1.0/a.qvue"
        out.commits.screenPath === "/Smithy/RepositoryDetail/Commits"
        out.commit.screenPath === "/Smithy/CommitDetail"
        out.commit.screenParameters.commitId === "0123abcdef"
        out.commitBad.kind === "NotFound"
        out.compare.screenPath === "/Smithy/Compare"
        out.compare.screenParameters.base === "main"
        out.compare.screenParameters.head === "feature/login"
        out.compareFork.screenParameters.headRepositoryPath === "jane/mr-moqui"
        out.compareFork.screenParameters.head === "fix"
        out.compareHead.screenParameters.base === ""
        out.compareHead.screenParameters.head === "topic"
        out.branches.screenPath === "/Smithy/RepositoryDetail/Branches"
        out.mergeRequest.screenPath === "/Smithy/MergeRequestDetail/Overview"
        !built.includes("/Smithy/MergeRequestDetail/Overview")
        out.issues.screenPath === "/Smithy/RepositoryDetail/Issues"
        out.issueNew.screenPath === "/Smithy/NewIssue"
        out.issue.screenPath === "/Smithy/IssueDetail"
        out.issue.screenParameters.issueNumber === "12"
        out.issue.screenParameters.repositoryId === "R1"
        built.includes("/Smithy/IssueDetail")
        out.issueZero.kind === "NotFound"
        out.issueDeeper.kind === "NotFound"
        out.labels.screenPath === "/Smithy/RepositoryDetail/Labels"
        out.milestone.screenPath === "/Smithy/RepositoryDetail/Milestones"
        out.milestone.screenParameters.milestoneId === "M_1"
        out.groupIssues.screenPath === "/Smithy/GroupDetail/Issues"
        out.groupIssues.screenParameters.groupId === "G1"
        out.island.screenPath === "/Smithy/Islands/Composer.qvue"
        built.includes(out.island.screenPath)
        out.islandBad.kind === "NotFound"
        out.mixedCase.screenPath === "/Smithy/redirect"
        out.mixedCase.screenParameters.location === "/code/moqui/mr-moqui/-/tree/Main"
        out.dotGit.screenParameters.location === "/moqui/mr-moqui"
        out.renamed.screenParameters.location === "/code/moqui/mr-moqui/-/commits/main"
        out.compatibility.screenParameters.location === "/code/moqui/mr-moqui/-/merge-requests/7"
        out.githubBlob.screenParameters.location === "/code/moqui/mr-moqui/-/blob/main/Docs/README.md"
        out.githubUpper.screenParameters.location === "/code/moqui/mr-moqui/-/blob/main/LICENSE"
        out.githubGit.screenParameters.location === "/code/moqui/mr-moqui/-/blob/main/x.git"
        out.doubled.screenPath === "/Smithy/redirect"
        out.doubled.screenParameters.location === "/moqui/mr-moqui/-/tree/main"
        out.dotFile.screenParameters.refPath === "main/.gitignore"
        // raw and archive are transitions of RepositoryDetail
        out.archive.screenPath === "/Smithy/RepositoryDetail/archive"
        out.archive.screenParameters.ref === "v1.0"
        out.archive.screenParameters.format === "tar.gz"
        out.dotDot.kind === "NotFound"
        out.encodedSlash.kind === "NotFound"
        out.unknownSection.kind === "NotFound"
        out.emptySection.kind === "NotFound"
        // /-/ always starts a section, so a group's section word is never taken for a name, and a name never for a section
        out.groupTree.kind === "NotFound"
        out.unknownName.kind === "NotFound"
        asked.includes("moqui/tree")
        out.badName.kind === "NotFound"
        out.sixNames.kind === "NotFound"
        // a reserved first segment is a fixed form and never asked of the authority as a name
        out.reserved.kind === "NotFound"
        out.newThing.kind === "NotFound"
        !asked.some(name => /^(?:explore|new|-moqui)/.test(name))
        out.newGroup.screenPath === "/Smithy/New/Group"
        out.newRepository.screenPath === "/Smithy/New/Repository"
        out.site.screenPath === "/Smithy/Site"
        out.site.screenParameters.tab == null
        out.siteTab.screenParameters.tab === "requests"
        out.siteBad.kind === "NotFound"
        out.form.screenPath === "/Smithy/Do/createRepository"
        out.formBad.kind === "NotFound"
        out.groupSettings.screenPath === "/Smithy/GroupDetail/Settings"
        out.groupSettings.screenParameters.groupId === "G1"
        out.groupSettings.screenParameters.tab === "delete"
        out.repositorySettings.screenPath === "/Smithy/RepositoryDetail/Settings"
        out.repositorySettings.screenParameters.repositoryId === "R1"
        out.repositorySettings.screenParameters.tab === "branch-rules"
        out.repositorySettingsBad.kind === "NotFound"
    }
})
feature("the resolver routes a Smithy mount by segment, so compare's ... passes and .. does not, here or in another app", {
    when() {
        const f = fixtures()
        return {
            repository: f.route(SITE, HOST, "/code/pass-smg/web"),
            tree: f.route(SITE, HOST, "/code/pass-smg/web/-/tree/feature/login/docs"),
            compare: f.route(SITE, HOST, "/code/pass-smg/web/-/compare/main...feature/login"),
            group: f.route(SITE, HOST, "/code/pass-smg/-/members"),
            stored: f.route(SITE, HOST, "/code/Pass-SMG/web.git"),
            slashes: f.route(SITE, HOST, "/code//pass-smg/web/"),
            later: f.route(SITE, HOST, "/code/pass-smg/web/-/merge-requests"),
            issue: f.route(SITE, HOST, "/code/pass-smg/web/-/issues/3"),
            dotDot: f.route(SITE, HOST, "/code/pass-smg/web/-/tree/main/../x"),
            unknown: f.route(SITE, HOST, "/code/pass-smg/nothing"),
            account: f.route(SITE, HOST, "/account/../code/explore"),
            // DG2's pages are routed; a settings tab of a later phase is not
            created: f.route(SITE, HOST, "/code/new/repository"),
            form: f.route(SITE, HOST, "/code/-/do/createRepository"),
            site: f.route(SITE, HOST, "/code/-/site/quotas"),
            siteLater: f.route(SITE, HOST, "/code/-/site/redirects"),
            groupSettings: f.route(SITE, HOST, "/code/pass-smg/-/settings"),
            webhooks: f.route(SITE, HOST, "/code/pass-smg/web/-/settings/webhooks"),
            mirrors: f.route(SITE, HOST, "/code/pass-smg/web/-/settings/mirrors")
        }
    },
    then({
        repository,
        tree,
        compare,
        group,
        stored,
        slashes,
        later,
        issue,
        dotDot,
        unknown,
        account,
        created,
        form,
        site,
        siteLater,
        groupSettings,
        webhooks,
        mirrors
    }) {
        created.screenPath === "/Smithy/New/Repository"
        form.screenPath === "/Smithy/Do/createRepository"
        site.screenParameters.tab === "quotas"
        siteLater.kind === "NotFound"
        groupSettings.screenPath === "/Smithy/GroupDetail/Settings"
        groupSettings.screenParameters.groupId === state.group
        webhooks.screenPath === "/Smithy/RepositoryDetail/Settings"
        webhooks.screenParameters.tab === "webhooks"
        mirrors.kind === "NotFound"
        repository.screenPath === "/Smithy/RepositoryDetail/Files"
        repository.screenParameters.repositoryId === state.repo
        repository.screenParameters.namePath === "pass-smg/web"
        tree.screenParameters.refPath === "feature/login/docs"
        compare.screenPath === "/Smithy/Compare"
        compare.screenParameters.head === "feature/login"
        group.screenPath === "/Smithy/GroupDetail/Members"
        group.screenParameters.groupId === state.group
        stored.screenPath === "/Smithy/redirect"
        stored.screenParameters.location === "/code/pass-smg/web"
        slashes.screenPath === "/Smithy/redirect"
        slashes.screenParameters.location === "/code/pass-smg/web"
        later.kind === "NotFound"
        // DG3's pages are routed (the page answers Not Found for a number the repository does not have)
        issue.screenPath === "/Smithy/IssueDetail"
        issue.screenParameters.issueNumber === "3"
        dotDot.kind === "NotFound"
        unknown.kind === "NotFound"
        account.kind === "NotFound"
    }
})
feature("Files shows the tree at a branch with a slash, links by the ref's name, the rendered README and the clone box", {
    when() {
        const page = fixtures().render(SITE, HOST, "/code/pass-smg/web/-/tree/feature/login", "Smithy/RepositoryDetail/Files", {
            repositoryId: state.repo,
            namePath: "pass-smg/web",
            refPath: "feature/login"
        })
        return {page, html: page.html}
    },
    then({page, html}) {
        page.errors.length === 0
        // the shell: breadcrumb, clone addresses, tabs
        html.includes('<a href="/code/pass-smg">pass-smg</a>')
        html.includes('id="SmithyClone"')
        html.includes("/git/pass-smg/web.git")
        html.includes('<a href="/code/pass-smg/web" aria-current="page">Files</a>')
        html.includes('<a href="/code/pass-smg/web/-/commits">Commits</a>')
        // the header is Smithy's
        html.includes('<a href="/code/explore">Explore</a>')
        // the tree, by the branch's name
        html.includes('<option value="feature/login" selected>feature/login</option>')
        html.includes('<a href="/code/pass-smg/web/-/tree/feature/login/docs">docs/</a>')
        // the clone box has the page URL only where Smithy is the site's root app; here it mounts at /code
        !html.includes("Page URL")
        html.includes('<a href="/code/pass-smg/web/-/blob/feature/login/README.md">README.md</a>')
        html.includes('href="/code/pass-smg/web/-/commit/' + state.first + '"')
        html.includes("First commit")
        html.includes('href="/code/pass-smg/web/-/commits/feature/login"')
        // the README is rendered by the authority and cleaned: its markup, and none of its script (below)
        html.includes('id="SmithyReadme"')
        html.includes("<em>web</em>")
        html.includes("Web sample</h1>")
        // readable with no JavaScript: the page loads no script
        !html.includes("<script")
    }
})
feature("Blob shows rendered Markdown with its relative links and images made the repository's own pages", {
    when() {
        const page = fixtures().render(
            SITE,
            HOST,
            "/code/pass-smg/web/-/blob/main/docs/Guide.md",
            "Smithy/RepositoryDetail/Blob",
            {
                repositoryId: state.repo,
                namePath: "pass-smg/web",
                refPath: "main/docs/Guide.md"
            }
        )
        const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
        const links = (page.html.match(/<(?:a|img)\b[^>]*>(?=Up<|Out<|Site<)|<img\b[^>]*alt="Logo"[^>]*>/g) || [])
            .map(tag => /(?:href|src)="([^"]*)"/.exec(tag)?.[1])
            .join(" ")
        return {page, links, html: page.html, code: smithy.codeHtml("const a = 1\nif (a < 2) b('<i>')\n")}
    },
    then({page, links, html, code}) {
        page.errors.length === 0
        html.includes('id="SmithyRendered"')
        // a relative link is the file's page at the shown ref, resolved against the file's directory; one that would leave
        // the repository's tree has no address; an absolute one is left alone; an image is its raw file
        links ===
            "/code/pass-smg/web/-/blob/main/README.md # https://example.test/a /code/pass-smg/web/-/raw/main/docs/img/logo.png"
        // its own links are built from what was read, not from the request's path
        html.includes('<a href="/code/pass-smg/web/-/blob/main/docs/Guide.md?plain=1">Source</a>')
        html.includes('<a href="/code/pass-smg/web/-/raw/main/docs/Guide.md">Raw</a>')
        html.includes('<a href="/code/pass-smg/web/-/blame/main/docs/Guide.md">Blame</a>')
        html.includes('<a href="/code/pass-smg/web/-/commits/main/docs/Guide.md">History</a>')
        html.includes('href="/code/pass-smg/web/-/blob/' + state.second + '/docs/Guide.md">Permalink</a>')
        html.includes('<a href="/code/pass-smg/web/-/tree/main/docs">docs</a>')
        !html.includes("<script")
        // a file's text is escaped, with a number and an anchor for each line
        code ===
            '<span id="L1"><a class="n" href="#L1">1</a>const a = 1</span>\n<span id="L2"><a class="n" href="#L2">2</a>if (a &lt; 2) b(&#39;&lt;i&gt;&#39;)</span>'
    }
})
feature("raw serves a file as plain text or a download, never as a page: its type, nosniff, a sandbox and a safe name", {
    when() {
        const f = fixtures()
        const call = (requestHeaders, user) => {
            if (!user) logout()
            try {
                return f.render(
                    SITE,
                    HOST,
                    "/code/pass-smg/web/-/raw/main/docs/n%C3%A9%22w.txt",
                    "Smithy/RepositoryDetail/raw",
                    {repositoryId: state.repo, namePath: "pass-smg/web", refPath: 'main/docs/n\u00e9"w.txt'},
                    requestHeaders
                )
            } finally {
                login("john.doe")
            }
        }
        const raw = call(null, false)
        const session = call({Cookie: "moqui.session=abc"}, false)
        return {
            raw,
            type: raw.header("Content-Type"),
            sniff: raw.header("X-Content-Type-Options"),
            csp: raw.header("Content-Security-Policy"),
            disposition: raw.header("Content-Disposition"),
            cache: raw.header("Cache-Control"),
            vary: raw.header("Vary"),
            sessionCache: session.header("Cache-Control"),
            download: ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js").disposition(false, 'a\r\nb\u00e9".svg')
        }
    },
    then({raw, type, sniff, csp, disposition, cache, vary, sessionCache, download}) {
        raw.errors.length === 0
        raw.html === "plain <b>text</b>\n"
        type.startsWith("text/plain")
        sniff === "nosniff"
        csp === "default-src 'none'; sandbox"
        disposition === "inline; filename=\"n__w.txt\"; filename*=UTF-8''n%C3%A9%22w.txt"
        download === "attachment; filename=\"ab__.svg\"; filename*=UTF-8''ab%C3%A9%22.svg"
        // public for a minute only for a request with no session cookie and no signed-in user
        cache === "public, max-age=60"
        // and that answer is for a request with no cookie: after a sign-in the browser asks again
        vary === "Cookie"
        sessionCache === "no-store"
    }
})
feature("the redirect answers 301 to a path on this site, is never cached, and refuses another host's", {
    when() {
        const f = fixtures()
        const to = location => f.render(SITE, HOST, "/code/Pass-SMG/web", "Smithy/redirect", {location})
        const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
        const good = to("/code/pass-smg/web/-/tree/main")
        const bad = to("//evil.example/x")
        return {
            status: good.status,
            location: good.header("Location"),
            cache: good.header("Cache-Control"),
            bad,
            badLocation: bad.header("Location"),
            guard: ["/a/b?x=1", "//host/a", "/\\host/a", "/a\u0001b", "https://host/a", "a/b", ""]
                .map(l => smithy.siteLocal(l))
                .join(" ")
        }
    },
    then({status, location, cache, bad, badLocation, guard}) {
        status === 301
        location === "/code/pass-smg/web/-/tree/main"
        cache === "no-store"
        // a refusal is the framework's Not Found, with no Location
        bad.errors.length === 1
        bad.errors[0].includes("Page not found")
        badLocation == null
        guard === "true false false false false false false"
    }
})
feature("CommitDetail shows the message, the parent, the changed file and its diff as escaped unified text", {
    when() {
        const page = fixtures().render(SITE, HOST, "/code/pass-smg/web/-/commit/" + state.second, "Smithy/CommitDetail", {
            repositoryId: state.repo,
            namePath: "pass-smg/web",
            commitId: state.second
        })
        return {page, html: page.html}
    },
    then({page, html}) {
        page.errors.length === 0
        html.includes("<h2>Greet everyone &amp; all</h2>")
        html.includes("A longer note.")
        html.includes("<code>" + state.second + "</code>")
        html.includes('href="/code/pass-smg/web/-/commit/' + state.first + '"')
        html.includes('<a href="/code/pass-smg/web/-/commits" aria-current="page">Commits</a>')
        html.includes("1 file changed")
        html.includes('<a href="#file-1">src/main.js</a>')
        // the issue the commit is linked to, by its number and title (one the caller may not see is only counted)
        html.includes('<a href="/code/pass-smg/web/-/issues/1">#1</a> Tree page breaks &lt;b&gt;</p>')
        html.includes('<span class="a">+console.log(&#39;hello&#39;)</span>')
        html.includes('<span class="d">-if (a &lt; 2) console.log(&#39;&lt;script&gt;alert(1)&lt;/script&gt;&#39;)</span>')
        !html.includes("<script")
    }
})
feature(
    "a repository's Settings shows a Maintainer's tabs and the General form, which posts to Smithy/Do with the session token",
    {
        when() {
            const page = fixtures().render(SITE, HOST, "/code/pass-smg/web/-/settings", "Smithy/RepositoryDetail/Settings", {
                repositoryId: state.repo,
                namePath: "pass-smg/web"
            })
            return {page, html: page.html, token: ec.web.sessionToken, cache: page.header("Cache-Control")}
        },
        then({page, html, token, cache}) {
            page.errors.length === 0
            // the shell's tab, and the settings' own: the site's operator is an Owner, so Archive is there
            html.includes('<a href="/code/pass-smg/web/-/settings" aria-current="page">Settings</a>')
            html.includes('<a href="/code/pass-smg/web/-/settings" aria-current="page">General</a>')
            html.includes('<a href="/code/pass-smg/web/-/settings/branch-rules">Branch rules</a>')
            html.includes('<a href="/code/pass-smg/web/-/settings/archive">Archive</a>')
            // a plain form: its transition, the session token, where a refusal returns, the revision it edits
            html.includes('<form method="post" class="card" id="Smithy_updateRepository" action="/code/-/do/updateRepository">')
            token.length > 0
            html.includes('<input type="hidden" name="moquiSessionToken" value="' + token + '">')
            html.includes('<input type="hidden" name="returnTo" value="/code/pass-smg/web/-/settings">')
            html.includes('name="expectedRevision"')
            html.includes('<option value="main" selected>main</option>')
            html.includes('<option value="feature/login">feature/login</option>')
            html.includes('name="mergeRequestsEnabled" value="true" checked')
            // the header's signed-in links, and Sign out as a form
            html.includes('<a href="/code/new/repository">New repository</a>')
            html.includes('<a href="/account/GitAccess">Git access</a>')
            html.includes('id="SmithySignOut"')
            !html.includes("<script")
            cache === "no-store"
        }
    }
)
feature("Git access: a public account makes a token through its form, sees it once on the next page, and it is in no address", {
    when() {
        const f = fixtures()
        const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
        login(KEYS, "moqui1!!")
        try {
            // the form's post: createAccessToken through Smithy/Do, the password given again; the flash stays for the page
            const made = f.post(
                SITE,
                HOST,
                "createAccessToken",
                {name: "spec ci", password: "moqui1!!", operationId: "pass-smg-token-1"},
                true,
                true
            )
            const token = made.flash.token?.token || ""
            const page = f.render(SITE, HOST, "/account/GitAccess", "Account/GitAccess", {})
            return {made, token, page, html: page.html, cache: page.header("Cache-Control"), after: smithy.takeFlash()}
        } finally {
            login("john.doe")
        }
    },
    then({made, token, page, html, cache, after}) {
        made.errors.length === 0
        made.status === 303
        made.location === "/account/GitAccess"
        made.cache === "no-store"
        token.length >= 20
        page.errors.length === 0
        html.includes('id="SmithyNewToken"')
        html.includes(">" + token + "</code>")
        html.split(token).length === 2
        // the page took it: the next page has none
        after.token == null
        cache === "no-store"
        // the token is listed by its name, with Revoke asked again on its own page
        html.includes('<h3 class="wrap">spec ci</h3>')
        html.includes('href="/account/GitAccess?confirm=token&amp;id=')
        // the forms post to Smithy/Do, and the password is asked again
        html.includes('action="/code/-/do/addSshKey"')
        html.includes('action="/code/-/do/createAccessToken"')
        html.includes('name="publicKey"')
        html.includes('<input type="password" name="password" autocomplete="current-password">')
        !html.includes("<script")
    }
})
feature("Blame shows each run of lines with the commit that last changed it, as escaped text", {
    when() {
        const page = fixtures().render(
            SITE,
            HOST,
            "/code/pass-smg/web/-/blame/main/src/main.js",
            "Smithy/RepositoryDetail/Blame",
            {
                repositoryId: state.repo,
                namePath: "pass-smg/web",
                refPath: "main/src/main.js"
            }
        )
        return {page, html: page.html, route: fixtures().route(SITE, HOST, "/code/pass-smg/web/-/blame/main/src/main.js")}
    },
    then({page, html, route}) {
        route.screenPath === "/Smithy/RepositoryDetail/Blame"
        route.screenParameters.refPath === "main/src/main.js"
        page.errors.length === 0
        html.includes('id="SmithyBlame"')
        // the first line is the first commit's, the second the commit that changed it; each is linked once, where its run starts
        html.includes('<tr id="L1" class="s"><td><a href="/code/pass-smg/web/-/commit/' + state.first + '" title="First commit">')
        html.includes(
            '<tr id="L2" class="s"><td><a href="/code/pass-smg/web/-/commit/' +
                state.second +
                '" title="Greet everyone &amp; all">'
        )
        html.includes("<pre>console.log(&#39;hello&#39;)</pre>")
        html.includes('<a href="/code/pass-smg/web/-/blob/main/src/main.js">File</a>')
        !html.includes("<script")
    }
})
feature("archive serves a ref's tree to a signed-in account as an attachment, never cached; a visitor is sent to sign in", {
    when() {
        const f = fixtures()
        const get = () =>
            f.render(SITE, HOST, "/code/pass-smg/web/-/archive/feature/login.zip", "Smithy/RepositoryDetail/archive", {
                repositoryId: state.repo,
                namePath: "pass-smg/web",
                ref: "feature/login",
                format: "zip"
            })
        const signedIn = get()
        logout()
        let visitor
        try {
            visitor = get()
        } finally {
            login("john.doe")
        }
        return {
            signedIn,
            route: f.route(SITE, HOST, "/code/pass-smg/web/-/archive/feature/login.zip"),
            disposition: signedIn.header("Content-Disposition"),
            cache: signedIn.header("Cache-Control"),
            sniff: signedIn.header("X-Content-Type-Options"),
            visitor,
            visitorLocation: visitor.header("Location"),
            visitorCache: visitor.header("Cache-Control")
        }
    },
    then({signedIn, route, disposition, cache, sniff, visitor, visitorLocation, visitorCache}) {
        route.screenPath === "/Smithy/RepositoryDetail/archive"
        route.screenParameters.ref === "feature/login"
        route.screenParameters.format === "zip"
        signedIn.errors.length === 0
        signedIn.html.startsWith("PK")
        disposition === "attachment; filename=\"web-feature-login.zip\"; filename*=UTF-8''web-feature-login.zip"
        cache === "no-store"
        sniff === "nosniff"
        // a visitor who may view the repository gets no file, only the way to sign in and come back
        !visitor.html.startsWith("PK")
        visitorLocation === "/account/Login?returnTo=" + encodeURIComponent("/code/pass-smg/web/-/archive/feature/login.zip")
        visitorCache === "no-store"
    }
})
feature("a form's post answers 303: to its page after a write, back to the form with the refusal; an ending action asks again", {
    when() {
        const f = fixtures()
        const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
        const forms = ec.resource.script("component://mr-pass/screen/Smithy/SmithyForms.js")
        const branches = "/code/pass-smg/web/-/branches"
        const create = (name, operationId, keep) =>
            f.post(
                SITE,
                HOST,
                "createRef",
                {repositoryId: state.repo, refType: "branch", name, fromRevision: "main", operationId, returnTo: branches},
                true,
                keep
            )
        const made = create("topic", "pass-smg-ref-1")
        // the same name again is refused; the flash is kept, as the form's page would find it
        const again = create("topic", "pass-smg-ref-2", true)
        const shell = smithy.repositoryShell(SITE, state.repo, "/code", branches)
        const view = smithy.refs(shell, "branch")
        const shown = forms.refForms(shell, "branch", view, {smithy: "/code", account: "/account"}, {authenticated: true})
        // an ending action without its confirmation page's answer is not run, and a return address off the mount is not used
        const unasked = f.post(SITE, HOST, "deleteRef", {
            repositoryId: state.repo,
            refType: "branch",
            name: "topic",
            returnTo: "//evil.example/x"
        })
        // a test render does not make the framework's request checks, so the session token's is read from the screen: every
        // transition of Do is a post, and none opts out of the token (SmithyWalk posts without one)
        const screen = String(ec.resource.getLocationText("component://mr-pass/screen/Smithy/Do.xml") || "")
        return {
            made,
            again,
            shown: shown.createHtml,
            names: view.rows.map(row => row.name),
            deleteHref: view.rows.find(row => row.name === "topic")?.deleteHref,
            unasked,
            transitions: (screen.match(/<transition /g) || []).length,
            posts: (screen.match(/<transition name="[A-Za-z]+" method="post">/g) || []).length,
            forms: Object.keys(forms.DO).filter(name => screen.includes('<transition name="' + name + '" method="post">')).length,
            optOut: screen.includes("require-session-token")
        }
    },
    then({made, again, shown, names, deleteHref, unasked, transitions, posts, forms, optOut}) {
        made.status === 303
        made.location === "/code/pass-smg/web/-/branches"
        made.cache === "no-store"
        made.flash.notice === "Created topic."
        again.status === 303
        again.location === "/code/pass-smg/web/-/branches"
        again.flash.form === "createRef"
        again.flash.error.message.length > 0
        // the refusal is on the form, with what was typed
        shown.includes('<p role="alert" class="error" id="Smithy_createRef_error">')
        shown.includes('name="name" value="topic"')
        names.includes("topic")
        deleteHref === "/code/pass-smg/web/-/branches?delete=topic"
        unasked.status === 303
        unasked.location === "/code/"
        unasked.flash.error.message === "Confirm this change on its own page first."
        transitions === 45
        posts === 45
        forms === 45
        optOut === false
    }
})
feature("Issues lists a repository's open issues with their counts, labels and filters; the shell has the tab with its count", {
    when() {
        const page = fixtures().render(SITE, HOST, "/code/pass-smg/web/-/issues", "Smithy/RepositoryDetail/Issues", {
            repositoryId: state.repo,
            namePath: "pass-smg/web"
        })
        return {page, html: page.html, cache: page.header("Cache-Control"), n: state.issue.issueNumber}
    },
    then({page, html, cache, n}) {
        page.errors.length === 0
        // the shell's tab has the open count the authority answers for this caller
        html.includes('<a href="/code/pass-smg/web/-/issues" aria-current="page">Issues <small>1</small></a>')
        html.includes('<a href="/code/pass-smg/web/-/issues" aria-current="page">Open <small>1</small></a>')
        html.includes('<a href="/code/pass-smg/web/-/issues?state=closed">Closed <small>0</small></a>')
        html.includes('<a href="/code/pass-smg/web/-/issues/' + n + '">Tree page breaks &lt;b&gt;</a> <small>#' + n + "</small>")
        html.includes('style="border-color:#f44336">bug</small>')
        // the filters are a GET form; "Confidential only" is the Owner's (the site's operator is one)
        html.includes('<form method="get" action="/code/pass-smg/web/-/issues" class="card" role="search" id="SmithyIssueFind">')
        html.includes('<option value="' + state.label + '">bug</option>')
        html.includes('name="confidential" value="only"')
        html.includes('<a href="/code/pass-smg/web/-/issues/new">New issue</a>')
        html.includes('<a href="/code/pass-smg/web/-/labels">Labels</a>')
        !html.includes("<script")
        cache === "no-store"
    }
})
feature("IssueDetail shows the conversation's Markdown rendered and cleaned, and the forms a confirmed viewer may use", {
    when() {
        const f = fixtures()
        const path = "/code/pass-smg/web/-/issues/" + state.issue.issueNumber
        login(KEYS, "moqui1!!")
        try {
            const page = f.render(SITE, HOST, path, "Smithy/IssueDetail", {
                repositoryId: state.repo,
                namePath: "pass-smg/web",
                issueNumber: String(state.issue.issueNumber)
            })
            return {page, html: page.html, cache: page.header("Cache-Control"), n: state.issue.issueNumber}
        } finally {
            login("john.doe")
        }
    },
    then({page, html, cache, n}) {
        page.errors.length === 0
        html.includes("<h2>Tree page breaks &lt;b&gt; <small>#" + n + "</small></h2>")
        html.includes('id="SmithyIssueState">Open</strong>')
        !html.includes('id="SmithyIssueConfidential"')
        // the first post: Markdown rendered by the authority and cleaned, so its script is gone
        html.includes("<strong>breaks</strong>")
        html.includes("<code>main</code>")
        !html.includes("alert(1)")
        // a confirmed viewer reacts and comments; the forms post to Smithy/Do with the session token
        html.includes('action="/code/-/do/setReaction"')
        html.includes('<button aria-pressed="false">like 0</button>')
        html.includes('id="Smithy_publishPost" action="/code/-/do/publishPost"')
        html.includes('<input type="hidden" name="rootCommEventId" value="' + state.issue.rootCommEventId + '">')
        html.includes('<input type="hidden" name="sourceFormat" value="markdown">')
        html.includes('<textarea name="body" rows="8" maxlength="100000" required>')
        html.includes('formaction="/code/-/do/previewPost"')
        // where JavaScript runs, the composer's island takes the textarea's place
        html.includes('<script type="application/json" data-moqui-island="SmithyComposer">')
        html.includes('"basePath":"/code/-/island/Composer"')
        // the label is shown; triage, the state and who reads it are not a viewer's
        html.includes('id="SmithyIssueLabels"')
        html.includes(">bug</small>")
        !html.includes("Smithy_setIssueLabels")
        !html.includes("Smithy_setIssueState")
        !html.includes("SmithyIssueAudience")
        !html.includes("Smithy_updateIssue")
        cache === "no-store"
    }
})
feature("NewIssue has the title, a Markdown text with a preview, and the Confidential mark with who will read it", {
    when() {
        const f = fixtures()
        login(KEYS, "moqui1!!")
        try {
            const page = f.render(SITE, HOST, "/code/pass-smg/web/-/issues/new", "Smithy/NewIssue", {
                repositoryId: state.repo,
                namePath: "pass-smg/web"
            })
            return {page, html: page.html, token: ec.web.sessionToken}
        } finally {
            login("john.doe")
        }
    },
    then({page, html, token}) {
        page.errors.length === 0
        html.includes('<form method="post" class="card" id="Smithy_createIssue" action="/code/-/do/createIssue">')
        html.includes('<input type="hidden" name="moquiSessionToken" value="' + token + '">')
        html.includes('<input type="hidden" name="returnTo" value="/code/pass-smg/web/-/issues/new">')
        html.includes('<input type="text" name="title" value="" maxlength="250" required>')
        html.includes('<textarea name="body" rows="12" maxlength="100000" required>')
        html.includes('<input type="checkbox" name="confidential" value="true"> Confidential</label>')
        html.includes("Only the owners of this repository and of its group")
        html.includes('formaction="/code/-/do/previewPost" formnovalidate name="previewOf" value="createIssue">Preview</button>')
        html.includes('data-moqui-island="SmithyComposer"')
        // labels, assignees and the milestone are a Reporter's
        !html.includes('name="labelIds"')
        !html.includes('name="assigneeHandles"')
    }
})
feature("an issue filed through Smithy/Do goes to its new number; a refusal and a preview return to the form with what was typed", {
    when() {
        const f = fixtures()
        const form = "/code/pass-smg/web/-/issues/new"
        const file = (username, fields) => {
            login(username, "moqui1!!")
            try {
                return f.post(SITE, HOST, fields.previewOf ? "previewPost" : "createIssue", {
                    repositoryId: state.repo,
                    sourceFormat: "markdown",
                    returnTo: form,
                    ...fields
                })
            } finally {
                login("john.doe")
            }
        }
        const made = file(KEYS, {title: "From the form", body: "Filed *here*.", operationId: "pass-smg-issue-form-1"})
        return {
            made,
            number: Number(/\/issues\/([0-9]+)$/.exec(made.location || "")?.[1]),
            first: state.issue.issueNumber,
            refused: file(KEYS, {title: "", body: "Text that is kept", operationId: "pass-smg-issue-form-2"}),
            unconfirmed: file(PLAIN, {title: "No address", body: "Text", operationId: "pass-smg-issue-form-3"}),
            preview: file(KEYS, {previewOf: "createIssue", title: "Kept title", body: "**bold** <script>alert(2)</script>"})
        }
    },
    then({made, number, first, refused, unconfirmed, preview}) {
        made.errors.length === 0
        made.status === 303
        made.cache === "no-store"
        number > first
        made.location === "/code/pass-smg/web/-/issues/" + number
        made.flash.notice.length > 0
        // a refusal is shown on the form, with the text kept
        refused.status === 303
        refused.location === "/code/pass-smg/web/-/issues/new"
        refused.flash.form === "createIssue"
        refused.flash.error.message.length > 0
        refused.flash.values.body === "Text that is kept"
        unconfirmed.location === "/code/pass-smg/web/-/issues/new"
        unconfirmed.flash.error.message === "Confirm your email address to do this."
        // a preview stores nothing: the cleaned rendering and what was typed, for the form's next page
        preview.status === 303
        preview.location === "/code/pass-smg/web/-/issues/new"
        preview.flash.form === "createIssue"
        preview.flash.preview.includes("<strong>bold</strong>")
        !preview.flash.preview.includes("<script")
        preview.flash.values.title === "Kept title"
    }
})
feature("Labels asks again before a delete and shows an organization's label without controls; a group's New issue redirects", {
    when() {
        const f = fixtures()
        const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
        const issues = ec.resource.script("component://mr-pass/screen/Smithy/SmithyIssues.js")
        // a label of the party that owns the repository's project (an organization's, in Projects): shown, and not this
        // repository's to change
        const owner = ec.user.userAccount.partyId
        f.run("update#mantle.work.effort.WorkEffort", {
            workEffortId: ec.entity.find("mantle.smithy.SmithyRepository").condition("repositoryId", state.repo).disableAuthz().one()
                .workEffortId,
            ownerPartyId: owner
        })
        f.run("create#mantle.work.effort.WorkEffortCategory", {
            categoryTypeEnumId: "WcatLabel",
            description: "org-wide",
            colorName: "blue",
            ownerPartyId: owner
        })
        // the list, by the page's own function with no screen rendered; the confirmation is the one render, a GET
        const path = "/code/pass-smg/web/-/labels"
        const shell = smithy.repositoryShell(SITE, state.repo, "/code", path)
        const list = issues.labels(shell, {smithy: "/code", account: "/account"}, {authenticated: true, site: {}}, path).html
        const row = name =>
            (list.split('<article class="card smithy-row"').find(part => part.includes(">" + name + "</small></h3>")) || "").split(
                "</article>"
            )[0]
        const asked = f.render(SITE, HOST, path, "Smithy/RepositoryDetail/Labels", {
            repositoryId: state.repo,
            namePath: "pass-smg/web",
            delete: state.label
        })
        const group = f.render(SITE, HOST, "/code/pass-smg/-/issues", "Smithy/GroupDetail/Issues", {
            groupId: state.group,
            namePath: "pass-smg",
            newIn: state.repo,
            go: "1"
        })
        return {
            own: row("bug"),
            shared: row("org-wide"),
            asked,
            still: f.operation("findLabels", {siteId: SITE, repositoryId: state.repo}).labelList.some(l => l.labelId === state.label),
            group,
            groupLocation: group.header("Location")
        }
    },
    then({own, shared, asked, still, group, groupLocation}) {
        // the repository's own label: Edit and Delete, the delete a link to the page that asks again
        own.includes('href="/code/pass-smg/web/-/labels?delete=' + state.label + '"')
        own.includes('action="/code/-/do/storeLabel"')
        // the organization's: its chip and count, no control
        shared.includes("org-wide")
        !shared.includes("?delete=")
        !shared.includes("<form")
        // the confirmation names the label and posts with confirm=yes; showing it deleted nothing
        asked.errors.length === 0
        asked.html.includes("<h2>Delete the label bug</h2>")
        asked.html.includes('id="Smithy_deleteLabel" action="/code/-/do/deleteLabel"')
        asked.html.includes('<input type="hidden" name="confirm" value="yes">')
        !asked.html.includes('id="SmithyLabelList"')
        still === true
        // New issue in a group goes to the chosen repository's form
        groupLocation === "/code/pass-smg/web/-/issues/new"
    }
})
feature("a post of another conversation is not edited on an issue's page", {
    when() {
        const f = fixtures()
        const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
        const issues = ec.resource.script("component://mr-pass/screen/Smithy/SmithyIssues.js")
        const other = f.issue(SITE, state.repo, {title: "Another issue", body: "Its own text"})
        const path = "/code/pass-smg/web/-/issues/" + state.issue.issueNumber
        const page = postId => {
            try {
                const shell = smithy.repositoryShell(SITE, state.repo, "/code", path)
                const html = issues.issueDetail(
                    shell,
                    String(state.issue.issueNumber),
                    {smithy: "/code", account: "/account"},
                    {authenticated: true, site: {}},
                    path,
                    {edit: postId}
                ).html
                return html.includes('id="Smithy_updatePost"') ? "form" : "none"
            } catch (error) {
                ec.message.clearErrors()
                return error.moquiErrorKind
            }
        }
        // the first post of an issue is its root event
        return {own: page(state.issue.rootCommEventId), other: page(other.rootCommEventId)}
    },
    then({own, other}) {
        own === "form"
        other === "NotFound"
    }
})
feature("Smithy's registrations agree: the app, PASS's copy of Mantle's operations, their routes, and the cache policy", {
    when() {
        const text = location => String(ec.resource.getLocationText(location) || "")
        const pass = "component://mr-pass/service/pass/SmithySchema.js"
        const operations = Object.keys(ec.resource.script(pass))
        const routed = ec.resource.script("component://mr-pass/service/pass/Routes.js").map(r => r[2])
        const forum = ec.resource.script("component://mr-pass/service/pass/Schema.js")
        const headers = ec.resource.script("component://mr-pass/screen/Shared/Headers.js")
        return {
            app: ec.resource.script("component://mr-pass/service/pass/Apps.js").smithy,
            authorityApp: ec.resource.script("component://mr-mantle/service/mantle/public/PublicApps.js").apps.smithy,
            // a remote PASS host has no Mantle and the authority has no PASS, so each keeps a copy; change both together
            schema: text(pass).length > 0 && text(pass) === text("component://mr-mantle/service/mantle/smithy/SmithySchema.js"),
            count: operations.length,
            unrouted: operations.filter(name => !routed.includes(name)),
            // a name is in one of the two schema files
            twice: operations.filter(name => forum[name]),
            anonymous: headers.policyOf("smithy", "/moqui/mr-moqui/-/tree/main", true).cacheControl,
            signedIn: headers.policyOf("smithy", "/moqui/mr-moqui/-/tree/main", false).cacheControl,
            ownPath: headers.policyOf("smithy", "/-/do/createIssue", true).cacheControl,
            commitsList: headers.policyOf("smithy", "/moqui/mr-moqui/-/commits/main", true).cacheControl,
            // an issue page is kept by no cache, for a visitor either (an issue may become confidential)
            issuePages: ["/moqui/mr-moqui/-/issues", "/moqui/mr-moqui/-/issues/12", "/moqui/-/issues", "/moqui/mr-moqui/-/labels", "/moqui/mr-moqui/-/commit/0123abc"]
                .map(path => headers.policyOf("smithy", path, true).cacheControl)
                .join(" ")
        }
    },
    then({app, authorityApp, schema, count, unrouted, twice, anonymous, signedIn, ownPath, issuePages, commitsList}) {
        app.screen === "Smithy"
        app.base === "/code"
        authorityApp.root === true
        schema === true
        count === 68
        unrouted.length === 0
        twice.length === 0
        anonymous === "public, max-age=60"
        signedIn === "no-store"
        ownPath === "no-store"
        // and so is a commit's page, which names its issues; the list of commits is not
        issuePages === "no-store no-store no-store no-store no-store"
        commitsList === "public, max-age=60"
    }
})
feature("every app's default base is refused as a group's path, so a group never takes a mount's place", {
    when() {
        const apps = ec.resource.script("component://mr-pass/service/pass/Apps.js")
        const taken = []
        for (const app of Object.values(apps)) {
            const pathSegment = app.base.slice(1)
            try {
                fixtures().run("mantle.smithy.SmithyServices.create#Group", {siteId: SITE, pathSegment, visibility: "public"})
                taken.push(pathSegment + " was made")
            } catch (error) {
                if (!/nameTaken|nameInvalid|That name is taken/.test(String(error.message)))
                    taken.push(pathSegment + ": " + String(error.message).slice(0, 120))
            }
        }
        return {taken, count: Object.keys(apps).length}
    },
    then({taken, count}) {
        count === 9
        taken.length === 0
    }
})
