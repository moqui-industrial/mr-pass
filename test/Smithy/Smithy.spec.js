// Smithy (Dogfood DG1; plan/design-smithy.md §4.4, §7, §19.1): the route resolver's grammar (service/pass/SmithyRoutes.js, the
// smithy branch of pass.RouteServices.resolve#Route) with the name lookup stubbed, then through the resolver on a site with a
// group and a repository; one render each of Files, Blob and CommitDetail with its checks; and the operations PASS registers
// against Mantle's. Mantle's SmithyPaths, SmithyVisibility and SmithyRoles specs cover the rules behind the reads.
const fixtures = () => ec.resource.script("component://mr-pass/test/Smithy/SmithyFixtures.js")
const routes = () => ec.resource.script("component://mr-pass/service/pass/SmithyRoutes.js")
const SITE = "PASS_SMITHY"
const HOST = "smithy.example.test"
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
        const made = f.repository(SITE, state.group, "web", "public", {
            "README.md": "# Web sample\n\nThe *web* repository.\n\n<script>alert(1)</script>\n",
            "docs/Guide.md": "# Guide\n\n[Up](../README.md) [Out](../../../etc/passwd) [Site](https://example.test/a) ![Logo](img/logo.png)\n",
            'docs/n\u00e9"w.txt': "plain <b>text</b>\n",
            "src/main.js": "const a = 1\nif (a < 2) console.log('<script>alert(1)</script>')\n"
        })
        state.repo = made.repositoryId
        state.first = made.commitId
        // a branch whose name has a slash, with a second commit on main after it
        f.run("org.moqui.git.GitServices.create#GitRef", {repositoryId: state.repo, refName: "feature/login", refType: "branch"})
        state.second = f.commit(state.repo, "Greet everyone & all\n\nA longer note.", {"src/main.js": "const a = 1\nconsole.log('hello')\n"})
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
            issue: parse("moqui/mr-moqui/-/issues/12"),
            issueZero: parse("moqui/mr-moqui/-/issues/012"),
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
            newThing: parse("new/thing")
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
        out.issue.screenPath === "/Smithy/IssueDetail"
        out.issue.screenParameters.issueNumber === "12"
        !built.includes("/Smithy/IssueDetail")
        out.issueZero.kind === "NotFound"
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
            later: f.route(SITE, HOST, "/code/pass-smg/web/-/issues"),
            dotDot: f.route(SITE, HOST, "/code/pass-smg/web/-/tree/main/../x"),
            unknown: f.route(SITE, HOST, "/code/pass-smg/nothing"),
            account: f.route(SITE, HOST, "/account/../code/explore")
        }
    },
    then({repository, tree, compare, group, stored, slashes, later, dotDot, unknown, account}) {
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
        const page = fixtures().render(SITE, HOST, "/code/pass-smg/web/-/blob/main/docs/Guide.md", "Smithy/RepositoryDetail/Blob", {
            repositoryId: state.repo,
            namePath: "pass-smg/web",
            refPath: "main/docs/Guide.md"
        })
        const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
        const links = (page.html.match(/<(?:a|img)\b[^>]*>(?=Up|Out|Site)|<img\b[^>]*alt="Logo"[^>]*>/g) || [])
            .map(tag => /(?:href|src)="([^"]*)"/.exec(tag)?.[1])
            .join(" ")
        return {page, links, html: page.html, code: smithy.codeHtml("const a = 1\nif (a < 2) b('<i>')\n")}
    },
    then({page, links, html, code}) {
        page.errors.length === 0
        html.includes('id="SmithyRendered"')
        // a relative link is the file's page at the shown ref, resolved against the file's directory; one that would leave
        // the repository's tree has no address; an absolute one is left alone; an image is its raw file
        links === '/code/pass-smg/web/-/blob/main/README.md # https://example.test/a /code/pass-smg/web/-/raw/main/docs/img/logo.png'
        // its own links are built from what was read, not from the request's path
        html.includes('<a href="/code/pass-smg/web/-/blob/main/docs/Guide.md?plain=1">Source</a>')
        html.includes('<a href="/code/pass-smg/web/-/raw/main/docs/Guide.md">Raw</a>')
        html.includes('<a href="/code/pass-smg/web/-/commits/main/docs/Guide.md">History</a>')
        html.includes('href="/code/pass-smg/web/-/blob/' + state.second + '/docs/Guide.md">Permalink</a>')
        html.includes('<a href="/code/pass-smg/web/-/tree/main/docs">docs</a>')
        !html.includes("<script")
        // a file's text is escaped, with a number and an anchor for each line
        code === '<span id="L1"><a class="n" href="#L1">1</a>const a = 1</span>\n<span id="L2"><a class="n" href="#L2">2</a>if (a &lt; 2) b(&#39;&lt;i&gt;&#39;)</span>'
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
            sessionCache: session.header("Cache-Control"),
            download: ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js").disposition(false, 'a\r\nb\u00e9".svg')
        }
    },
    then({raw, type, sniff, csp, disposition, cache, sessionCache, download}) {
        raw.errors.length === 0
        raw.html === "plain <b>text</b>\n"
        type.startsWith("text/plain")
        sniff === "nosniff"
        csp === "default-src 'none'; sandbox"
        disposition === "inline; filename=\"n__w.txt\"; filename*=UTF-8''n%C3%A9%22w.txt"
        download === "attachment; filename=\"ab__.svg\"; filename*=UTF-8''ab%C3%A9%22.svg"
        // public for a minute only for a request with no session cookie and no signed-in user
        cache === "public, max-age=60"
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
            guard: ["/a/b?x=1", "//host/a", "/\\host/a", "/a\u0001b", "https://host/a", "a/b", ""].map(l => smithy.siteLocal(l)).join(" ")
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
        html.includes('<span class="a">+console.log(&#39;hello&#39;)</span>')
        html.includes('<span class="d">-if (a &lt; 2) console.log(&#39;&lt;script&gt;alert(1)&lt;/script&gt;&#39;)</span>')
        !html.includes("<script")
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
            ownPath: headers.policyOf("smithy", "/-/do/createIssue", true).cacheControl
        }
    },
    then({app, authorityApp, schema, count, unrouted, twice, anonymous, signedIn, ownPath}) {
        app.screen === "Smithy"
        app.base === "/code"
        authorityApp.root === true
        schema === true
        count === 16
        unrouted.length === 0
        twice.length === 0
        anonymous === "public, max-age=60"
        signedIn === "no-store"
        ownPath === "no-store"
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
                if (!/nameTaken|nameInvalid|That name is taken/.test(String(error.message))) taken.push(pathSegment + ": " + String(error.message).slice(0, 120))
            }
        }
        return {taken, count: Object.keys(apps).length}
    },
    then({taken, count}) {
        count === 9
        taken.length === 0
    }
})
