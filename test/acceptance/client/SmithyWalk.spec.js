// Smithy's golden-path walk (plan/design-smithy.md §19.1), at the desktop width, on SmithyWalkFixtures' group and repository
// of the HTTP test community: a visitor browses from the home page to a group, its repository, a file and a commit; then a
// Maintainer of the group signs in, creates a repository in it and sees the empty repository's page, which says how to push
// a first commit and downloads a tree as a zip. It then files an issue (DG3): the new-issue form's text is the composer's
// island, whose preview shows the Markdown rendered, and the issue's page shows it with its conversation. A form's post
// without the session token is refused, and the pages that write fit a phone's width (390 px). It is an acceptance spec: the regression client suite has no room for it in its budget (it takes about five
// seconds). The rules are the server specs' (mr-mantle test/smithy, mr-pass Smithy and SmithyAccess). DG6: the forum inside
// the group's shell at a phone's width: a visitor reads a scoped topic (the enhanced stream takes the server's posts' place,
// its links the scope's, its canonical address the site forum's), an account with no role writes a topic in the scope's
// composer and opens the report form; the scope's moderation pages are Not Found to it.
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
feature("a visitor browses a group, a repository, a file and a commit; a Maintainer signs in and creates a repository", {
    when() {
        const page = browser.newPage({viewport: {width: 1200, height: 900}})
        const opened = page.goto("/code")
        const home = page.text()
        page.getByRole("link", {name: "walk", exact: true}).click()
        page.waitForURL("/code/walk")
        const group = page.text()
        page.getByRole("link", {name: "All repositories"}).click()
        page.waitForURL("/code/walk/-/repositories")
        page.getByRole("link", {name: "walk/guide", exact: true}).click()
        page.waitForURL("/code/walk/guide")
        const repository = page.text()
        page.getByRole("link", {name: "src/", exact: true}).click()
        page.waitForURL("/code/walk/guide/-/tree/main/src")
        page.getByRole("link", {name: "hello.txt", exact: true}).click()
        page.waitForURL("/code/walk/guide/-/blob/main/src/hello.txt")
        const file = page.text()
        page.getByRole("link", {name: "Commits", exact: true}).click()
        page.waitForURL("/code/walk/guide/-/commits")
        page.getByRole("link", {name: "First commit", exact: true}).click()
        page.waitForURL(/\/code\/walk\/guide\/-\/commit\/[0-9a-f]{40}$/)
        const commit = page.text()
        // signed in: the group's New repository, its form, and the page of what it made
        page.goto("/account/Login")
        page.getByLabel("Email or username", {exact: true}).fill("pass.smithy.walker")
        page.getByLabel("Password", {exact: true}).fill("moqui1!!")
        page.getByRole("button", {name: "Sign in", exact: true}).click()
        page.waitFor(() => !location.pathname.startsWith("/account/Login"), {timeout: 15})
        page.goto("/code/walk/-/repositories")
        page.locator("#SmithyGroupNew").getByRole("link", {name: "New repository"}).click()
        page.waitForURL("/code/new/repository?namespace=walk")
        const slug = "walk-" + Date.now().toString(36)
        page.getByLabel("Path").fill(slug)
        page.getByRole("button", {name: "Create repository"}).click()
        page.waitForURL("/code/walk/" + slug)
        const created = page.text()
        // an issue, written in the composer's island over the plain form: its preview in the page, then the issue's page
        page.goto("/code/walk/guide/-/issues/new")
        page.waitFor(() => !!document.querySelector(".smithy-composer textarea"), {timeout: 20})
        const title = "Walk issue " + slug
        page.getByLabel("Title").fill(title)
        // the toggle: rich text is m-rich-text, with the form's sourceFormat following and the page's headings kept their size
        page.locator('.smithy-composer input[value="html"]').click()
        page.waitFor(() => !!document.querySelector(".smithy-composer .m-rich-text"), {timeout: 20})
        const rich = page.evaluate(() =>
            [
                document.querySelector('#Smithy_createIssue input[name="sourceFormat"]').value,
                parseFloat(getComputedStyle(document.querySelector("h1")).fontSize) < 40
            ].join(" ")
        )
        page.locator('.smithy-composer input[value="markdown"]').click()
        page.waitFor(() => !!document.querySelector(".smithy-composer textarea"), {timeout: 15})
        page.locator(".smithy-composer textarea").fill("The guide **works** for `main`.")
        page.locator(".smithy-composer").getByRole("button", {name: "Preview"}).click()
        page.waitFor(() => !!document.querySelector(".smithy-composer .smithy-preview strong"), {timeout: 15})
        const previewed = page.evaluate(() => document.querySelector(".smithy-composer .smithy-preview").innerHTML)
        page.getByRole("button", {name: "Create issue"}).click()
        page.waitForURL(/\/code\/walk\/guide\/-\/issues\/[0-9]+$/)
        const issue = page.text()
        const issuePath = page.evaluate(() => location.pathname)
        const issueBody = page.evaluate(() => document.querySelector("#SmithyConversation .smithy-body")?.innerHTML || "")
        // the text's edit (its Markdown source comes back to the editor), and Close
        // the island has taken the plain textarea's place: one editor is shown
        page.waitFor(() => !!document.querySelector(".smithy-composer textarea"), {timeout: 20})
        const editors = page.evaluate(() => Array.from(document.querySelectorAll("textarea")).filter(area => area.offsetParent).length)
        page.locator("#SmithyConversation").getByRole("link", {name: "Edit", exact: true}).first().click()
        page.waitFor(() => !!document.querySelector(".smithy-composer textarea"), {timeout: 20})
        const source = page.evaluate(() => document.querySelector(".smithy-composer textarea").value)
        page.locator(".smithy-composer textarea").fill("The guide **works** for `main` and for tags.")
        page.getByLabel("Why you changed it").fill("More exact")
        page.getByRole("button", {name: "Save", exact: true}).click()
        page.waitFor(() => /for tags/.test(document.querySelector("#SmithyConversation .smithy-body")?.textContent || ""), {timeout: 15})
        const edited = page.evaluate(() => document.querySelector("#SmithyConversation .post-meta").textContent)
        page.getByRole("button", {name: "Close as completed"}).click()
        page.waitFor(() => /Closed/.test(document.querySelector("#SmithyIssueState")?.textContent || ""), {timeout: 15})
        const closed = page.evaluate(() => document.querySelector("#SmithyIssueState").textContent)
        // the pages that write, at a phone's width: none scrolls sideways
        page.setViewport(390, 844)
        const wide = []
        for (const path of [
            "/code/walk/" + slug,
            "/code/new/repository",
            "/code/new/group",
            "/code/walk/" + slug + "/-/settings",
            "/code/walk/" + slug + "/-/settings/branch-rules",
            "/code/walk/" + slug + "/-/settings/webhooks",
            "/code/walk/guide/-/branches",
            "/code/walk/guide/-/blame/main/README.md",
            "/code/walk/-/members",
            "/account/GitAccess",
            "/code/walk/guide/-/issues",
            "/code/walk/guide/-/issues/new",
            issuePath,
            "/code/walk/guide/-/labels",
            "/code/walk/guide/-/milestones",
            "/code/walk/-/issues"
        ]) {
            const shown = page.goto(path)
            if (shown.status !== 200 || overflow(page)) wide.push(path + " " + shown.status)
        }
        // the signed-in account downloads the tree; a visitor's request for it is sent to sign in
        const archive = page.evaluate(async () => {
            const answer = await fetch("/code/walk/guide/-/archive/main.zip")
            const bytes = new Uint8Array(await answer.arrayBuffer())
            return [
                answer.status,
                answer.headers.get("content-disposition"),
                answer.headers.get("cache-control"),
                String.fromCharCode(bytes[0], bytes[1])
            ].join(" | ")
        })
        const visitorArchive = session().get("/code/walk/guide/-/archive/main.zip")
        // a form's post from a session that does not send its token is refused before its transition runs
        const other = session()
        other.get("/account/Login")
        const untokened = other.post("/code/-/do/createRepository", {
            form: {slug: "untokened", returnTo: "/code/new/repository"},
            csrf: false
        })
        return {
            status: opened.status,
            home,
            group,
            repository,
            file,
            commit,
            created,
            title,
            rich,
            previewed,
            issue,
            issueBody,
            editors,
            source,
            edited,
            closed,
            wide,
            slug,
            untokened: untokened.status,
            archive,
            visitorArchive: visitorArchive.status + " " + visitorArchive.location
        }
    },
    then({status, home, group, repository, file, commit, created, title, rich, previewed, issue, issueBody, editors, source, edited, closed, wide, slug, untokened, archive, visitorArchive}) {
        rich === "html true"
        previewed.includes("<strong>works</strong>")
        issue.includes(title)
        issue.includes("Open")
        issueBody.includes("<strong>works</strong>")
        issueBody.includes("<code>main</code>")
        editors === 1
        source === "The guide **works** for `main`."
        edited.includes("edited")
        closed === "Closed as completed"
        archive === "200 | attachment; filename=\"guide-main.zip\"; filename*=UTF-8''guide-main.zip | no-store | PK"
        visitorArchive === "302 /account/Login?returnTo=%2Fcode%2Fwalk%2Fguide%2F-%2Farchive%2Fmain.zip"
        wide.join(", ") === ""
        untokened === 401
        status === 200
        home.includes("Explore")
        home.includes("walk/guide")
        group.includes("Group walk")
        repository.includes("Read me first.")
        file.includes("hello walker")
        commit.includes("First commit")
        commit.includes("2 files changed")
        created.includes("The repository walk/" + slug + " was created.")
        created.includes("This repository is empty")
        created.includes("git push -u origin main")
        created.includes("/git/walk/" + slug + ".git")
        created.includes("Sign out")
    }
})
feature("the forum inside a group's shell at a phone's width: a scoped topic, the scope's composer, and the report form", {
    when() {
        const page = browser.newPage({viewport: {width: 390, height: 844}})
        page.allowProblems(/Blocked script execution in 'about:srcdoc'/)
        const opened = page.goto("/code/walk/-/forum")
        const list = page.text()
        const listWide = overflow(page)
        page.getByRole("link", {name: "Walk topic", exact: true}).click()
        page.waitForURL(/\/code\/walk\/-\/forum\/t\/[A-Za-z0-9_-]+\/walk-topic$/)
        // the enhanced stream takes the server's posts' place (a post's text is in its frame); its links are the scope's,
        // its canonical the site forum's
        page.waitFor(() => !document.getElementById("pass-ssr-posts"), {timeout: 30})
        const topic = page.waitFor(
            () => Array.from(document.querySelectorAll("iframe")).some(frame => frame.contentDocument?.body?.textContent.includes("Talk about the guide here.")),
            {timeout: 20}
        )
        const shown = page.evaluate(() => {
            const links = Array.from(document.querySelectorAll("main a"))
            return [
                document.documentElement.scrollWidth > innerWidth,
                (document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "").replace(
                    /[A-Za-z0-9_-]+\/walk-topic$/,
                    "ID/walk-topic"
                ),
                links.filter(a => (a.getAttribute("href") || "").startsWith("/forum")).length,
                (links.find(a => a.textContent.trim() === "Link to this post")?.getAttribute("href") || "").replace(/[^/]+$/, "ID")
            ].join(" | ")
        })
        // an account with no role (an account's own posts are ten seconds apart, so not the first feature's): the scope's
        // composer has the group's category chosen, and the new topic's page is the scope's
        page.goto("/account/Login")
        if (!page.evaluate(() => !!document.querySelector('input[type="password"]'))) {
            page.goto("/code/walk")
            page.getByRole("button", {name: "Sign out"}).click()
            page.goto("/account/Login")
        }
        page.getByLabel("Email or username", {exact: true}).fill("pass.smithy.reader")
        page.getByLabel("Password", {exact: true}).fill("moqui1!!")
        page.getByRole("button", {name: "Sign in", exact: true}).click()
        page.waitFor(() => !location.pathname.startsWith("/account/Login"), {timeout: 15})
        page.goto("/code/walk/-/forum/Compose")
        page.waitFor(() => !!document.querySelector('[contenteditable="true"]'), {timeout: 30})
        const composer = page.evaluate(() => {
            const select = document.querySelector("select")
            return [select.value !== "", select.options.length, document.documentElement.scrollWidth > innerWidth].join(" ")
        })
        const title = "Scoped walk " + Date.now().toString(36)
        page.getByLabel("Title", {exact: true}).fill(title)
        page.locator('[contenteditable="true"]').fill("Written in the group's forum.")
        page.waitFor(() => document.body.innerText.includes("Draft saved."), {timeout: 20})
        page.getByRole("button", {name: "Publish", exact: true}).click()
        page.waitForURL(/\/code\/walk\/-\/forum\/t\/[A-Za-z0-9_-]+\/scoped-walk-/, {timeout: 30})
        const written = page.text()
        // Report: a short form with a reason, reached from the repository's page (its post is the server spec's)
        page.goto("/code/walk/guide")
        page.getByRole("link", {name: "Report this repository"}).click()
        page.waitForURL("/code/walk/guide/-/moderation/report")
        const report = page.text()
        const reportWide = overflow(page)
        // an account that is no Owner: the scope's moderation pages are Not Found, as the settings' Forum tab is
        page.allowProblems(/404 Not Found/)
        const queue = page.goto("/code/walk/-/moderation")
        const settings = page.goto("/code/walk/-/settings/forum")
        return {
            status: opened.status,
            list,
            listWide,
            topic,
            shown,
            composer,
            title,
            written,
            report,
            reportWide,
            queue: queue.status,
            settings: settings.status
        }
    },
    then({status, list, listWide, topic, shown, composer, title, written, report, reportWide, queue, settings}) {
        status === 200
        list.includes("Walk topic")
        list.includes("Repositories")
        listWide === false
        topic === true
        shown === "false | /forum/t/ID/walk-topic | 0 | /code/walk/-/forum/p/ID"
        // the scope's category is chosen, and it is the scope's alone
        composer === "true 2 false"
        written.includes(title)
        report.includes("Send report")
        reportWide === false
        queue === 404
        settings === 404
    }
})
