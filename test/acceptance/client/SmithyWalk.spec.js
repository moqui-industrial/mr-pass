// Smithy's golden-path walk (plan/design-smithy.md §19.1), at the desktop width, on SmithyWalkFixtures' group and repository
// of the HTTP test community: a visitor browses from the home page to a group, its repository, a file and a commit; then a
// Maintainer of the group signs in, creates a repository in it and sees the empty repository's page, which says how to push
// a first commit and downloads a tree as a zip. A form's post without the session token is refused, and the pages that write fit a phone's width (390
// px). It is an acceptance spec: the regression client suite has no room for it in its budget (it takes about five
// seconds). The rules are the server specs' (mr-mantle test/smithy, mr-pass Smithy and SmithyAccess).
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
            "/account/GitAccess"
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
            wide,
            slug,
            untokened: untokened.status,
            archive,
            visitorArchive: visitorArchive.status + " " + visitorArchive.location
        }
    },
    then({status, home, group, repository, file, commit, created, wide, slug, untokened, archive, visitorArchive}) {
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
