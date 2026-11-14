// Smithy's contribution walk (Dogfood DG4; plan/design-smithy.md §19.3), in a browser at the desktop width, on
// SmithyContributionFixtures' repository contrib/project, which requires the contributor agreement. An outside account
// forks it, changes a file and uploads one in its fork, opens a merge request from the fork, is told to sign, signs on the page (AUTHORS.md
// edited in the merge request's source), and a Maintainer merges it. Another account's merge request pushed for review
// shows with how to fetch it. A third account fixes a line of the docs on its page, in the code editor's island, and its
// merge request opens with no fork. Then the redirects a page answers before it renders (the ref picker, a tree path that
// is a file, the Compare form), over real HTTP.
// A client spec is a pure client with no git: the fork's commit is made on the fork's own page (Mantle's commitFile to the
// branch, the framework's commit#GitFiles), not by a real push, and the pushed merge request is the fixtures' proposal
// (commit#GitFiles asProposal, which is what a push to refs/for/main does).
const P = "/code/contrib/project"
function signedIn(username) {
    const page = browser.newPage({viewport: {width: 1200, height: 900}})
    page.goto("/account/Login")
    page.getByLabel("Email or username", {exact: true}).fill(username)
    page.getByLabel("Password", {exact: true}).fill("moqui1!!")
    page.getByRole("button", {name: "Sign in", exact: true}).click()
    page.waitFor(() => !location.pathname.startsWith("/account/Login"), {timeout: 15})
    return page
}
// the edit page's text, set in the plain form's own field (the island keeps it as the form's field), then Continue and Commit
function saveText(page, change) {
    page.waitFor(() => !!document.querySelector('#Smithy_editFile textarea[name="content"]'), {timeout: 20})
    page.evaluate(code => {
        const area = document.querySelector('#Smithy_editFile textarea[name="content"]')
        area.value = new Function("text", code)(area.value)
    }, change)
    page.locator('#Smithy_editFile button[value="save"]').click()
    page.waitFor(() => !!document.querySelector("#Smithy_commitFile"), {timeout: 15})
    const destinations = page.evaluate(() =>
        Array.from(document.querySelectorAll('#SmithyDestinations input[name="destination"]'))
            .map(radio => radio.value + (radio.checked ? "*" : ""))
            .join(",")
    )
    page.locator("#Smithy_commitFile").getByRole("button", {name: "Commit", exact: true}).click()
    return destinations
}
feature("an outside account forks, changes its fork, opens a merge request, signs on the page, and a Maintainer merges it", {
    when() {
        const page = signedIn("pass.smithy.outsider")
        page.goto(P)
        page.locator("#SmithyForks").getByRole("link", {name: "Fork", exact: true}).click()
        page.waitForURL(P + "/-/fork")
        page.locator("#Smithy_forkRepository").getByRole("button", {name: "Fork", exact: true}).click()
        page.waitForURL("/code/outsider/project")
        const fork = page.text()
        // a change in the fork, saved to its branch
        page.goto("/code/outsider/project/-/blob/main/README.md?plain=1")
        page.locator("#SmithyBlobHeader").getByRole("link", {name: "Edit", exact: true}).click()
        page.waitForURL("/code/outsider/project/-/edit/main/README.md")
        const ownDestinations = saveText(page, 'return text + "\\nForks are welcome.\\n"')
        page.waitForURL("/code/outsider/project/-/blob/main/README.md")
        const committed = page.text()
        // an upload in the fork: the step stages the file, the save commits it
        page.goto("/code/outsider/project/-/upload/main/docs")
        page.evaluate(() => {
            const files = new DataTransfer()
            files.items.add(new File(["Uploaded on its page.\n"], "notes.txt", {type: "text/plain"}))
            document.querySelector('#Smithy_editFile input[type="file"]').files = files.files
        })
        page.locator('#Smithy_editFile button[value="save"]').click()
        page.waitFor(() => !!document.querySelector("#Smithy_commitFile"), {timeout: 15})
        const uploading = page.locator("#SmithySaveWhat").text()
        page.locator("#Smithy_commitFile").getByRole("button", {name: "Commit", exact: true}).click()
        page.waitForURL("/code/outsider/project/-/blob/main/docs/notes.txt")
        const uploaded = page.text()
        // the merge request, from the fork's branch to the parent
        page.goto(P + "/-/merge-requests/new?head=" + encodeURIComponent("outsider/project:main"))
        page.waitFor(() => !!document.querySelector("#Smithy_createMergeRequest"), {timeout: 20})
        const compared = page.locator("#SmithyMergeRequestCompare").text()
        page.getByLabel("Title").fill("Welcome forks")
        page.getByRole("button", {name: "Open merge request"}).click()
        page.waitForURL(/\/code\/contrib\/project\/-\/merge-requests\/[0-9]+$/)
        const requestPath = page.evaluate(() => location.pathname)
        const opened = page.text()
        const unsigned = page.locator("#SmithyAgreement").text()
        // Sign: the agreement's file in the merge request's source, a line of its own under both lists
        page.locator("#SmithySign").click()
        page.waitForURL(/\/code\/outsider\/project\/-\/edit\/main\/AUTHORS\.md\?sign=[0-9]+$/)
        const help = page.locator("#SmithySignHelp").text()
        const prefilled = page.evaluate(() => document.querySelector('#Smithy_editFile textarea[name="content"]').value.includes("outsider"))
        saveText(
            page,
            'const line = "- Written in 2026 by Olive Outsider - outsider"; return text.replace(/(## Copyright Waiver\\n\\n(?:- .*\\n)+)/, "$1" + line + "\\n").replace(/\\n*$/, "\\n" + line + "\\n")'
        )
        page.waitForURL("/code/outsider/project/-/blob/main/AUTHORS.md")
        page.goto(requestPath)
        const signed = page.locator("#SmithyAgreement").text()
        const commits = page.goto(requestPath + "/commits").status + " " + page.locator("#SmithyMergeRequestCommits").text()
        // the diff, with the island's side by side view of a file
        page.goto(requestPath + "/changes")
        const diff = page.locator("#SmithyChanges").text()
        page.waitFor(() => !!document.querySelector("[data-smithy-tools] button"), {timeout: 20})
        // a Maintainer comments on a line in place (the island's form under the line), sees a file side by side, and merges
        // after the page asks again
        const keeper = signedIn("pass.smithy.keeper")
        keeper.goto(requestPath + "/changes")
        keeper.waitFor(() => !!document.querySelector("[data-smithy-tools] button"), {timeout: 20})
        keeper.locator(".smithy-lines .l.a a.n[data-line]").first().click()
        keeper.waitFor(() => !!document.querySelector(".smithy-lines form.smithy-thread textarea"), {timeout: 10})
        const inPlace = keeper.evaluate(() => location.search)
        keeper.locator(".smithy-lines form.smithy-thread textarea").fill("Thanks, this **reads** well.")
        keeper.locator(".smithy-lines form.smithy-thread").getByRole("button", {name: "Comment", exact: true}).click()
        keeper.waitFor(() => /reads/.test(document.querySelector(".smithy-lines .smithy-thread .smithy-body")?.textContent || ""), {timeout: 15})
        const thread = keeper.locator(".smithy-lines .smithy-thread .smithy-body").first().evaluate(element => element.innerHTML)
        keeper.waitFor(() => !!document.querySelector("[data-smithy-tools] button"), {timeout: 20})
        keeper.locator("[data-smithy-tools] button").first().click()
        keeper.waitFor(() => !!document.querySelector("[data-smithy-side] .m-diff-view .cm-content"), {timeout: 30})
        const side = keeper.evaluate(() => document.querySelector("[data-smithy-side] .m-diff-view").textContent.length > 0)
        keeper.goto(requestPath)
        keeper.locator("#SmithyMerge").getByRole("button", {name: /Merge/}).click()
        keeper.waitFor(() => !!document.querySelector("#Smithy_mergeMergeRequest"), {timeout: 15})
        const asked = keeper.locator("#Smithy_mergeMergeRequest").text()
        keeper.locator("#Smithy_mergeMergeRequest").getByRole("button", {name: "Merge", exact: true}).click()
        keeper.waitFor(() => /Merged/.test(document.querySelector("#SmithyMergeRequestState")?.textContent || ""), {timeout: 20})
        const merged = keeper.goto(P + "/-/blob/main/README.md?plain=1").status + " " + keeper.text()
        // the other account's merge request, pushed for review: listed, and its page says how to fetch it
        keeper.goto(P + "/-/merge-requests")
        const listed = keeper.locator("#SmithyMergeRequestList").text()
        keeper.locator("#SmithyMergeRequestList").getByRole("link", {name: "Say how the README came"}).click()
        keeper.waitForURL(/\/-\/merge-requests\/[0-9]+$/)
        const pushed = keeper.text()
        return {fork, uploading, uploaded, ownDestinations, committed, compared, opened, unsigned, help, prefilled, signed, commits, diff, asked, merged, listed, pushed, inPlace, thread, side}
    },
    then({fork, uploading, uploaded, ownDestinations, committed, compared, opened, unsigned, help, prefilled, signed, commits, diff, asked, merged, listed, pushed, inPlace, thread, side}) {
        // the form opened in the page, with no navigation, and its comment is at the line
        inPlace === ""
        thread.includes("<strong>reads</strong>")
        side === true
        fork.includes("Forked from contrib/project")
        fork.includes("The fork outsider/project was created.")
        // its own fork: the commit goes to the branch
        ownDestinations.startsWith("branch*")
        committed.includes("Committed to main.")
        committed.includes("Forks are welcome.")
        uploading.includes("docs/notes.txt")
        uploaded.includes("Uploaded on its page.")
        compared.includes("outsider/project:main")
        compared.includes("2 commits")
        opened.includes("Welcome forks")
        opened.includes("outsider/project")
        // told to sign
        unsigned.includes("Not signed")
        unsigned.includes("outsider")
        help.includes("both")
        help.includes("<your legal name>")
        prefilled === false
        signed.includes("Signed")
        !signed.includes("Not signed")
        commits.startsWith("200 ")
        commits.includes("Update AUTHORS.md")
        diff.includes("Forks are welcome.")
        diff.includes("Olive Outsider")
        asked.includes("into main")
        merged.startsWith("200 ")
        merged.includes("Forks are welcome.")
        listed.includes("pushed for review")
        pushed.includes("git fetch origin refs/merge-requests/")
        pushed.includes("pushed for review")
    }
})
feature("a third account fixes a line of the docs on its page, in the editor, and the merge request opens with no fork", {
    when() {
        const page = signedIn("pass.smithy.fixer")
        page.goto(P + "/-/blob/main/docs/Guide.md?plain=1")
        page.locator("#SmithyBlobHeader").getByRole("link", {name: "Edit", exact: true}).click()
        page.waitForURL(P + "/-/edit/main/docs/Guide.md")
        // the island: the framework's code editor over the plain textarea, which it keeps in step
        page.waitFor(() => !!document.querySelector(".smithy-editor-island .cm-content"), {timeout: 30})
        const plainHidden = page.evaluate(() => !document.querySelector('#Smithy_editFile textarea[name="content"]').offsetParent)
        page.locator(".smithy-editor-island .cm-content").click()
        page.keyboard.press("Control+End")
        page.keyboard.type("Fixed on its page.")
        page.waitFor(() => document.querySelector('#Smithy_editFile textarea[name="content"]').value.includes("Fixed on its page."), {timeout: 10})
        const destinations = saveText(page, 'return text.replace("frist", "first")')
        page.waitForURL(/\/code\/contrib\/project\/-\/merge-requests\/[0-9]+$/)
        const opened = page.text()
        page.goto(page.evaluate(() => location.pathname) + "/changes")
        const diff = page.locator("#SmithyChanges").text()
        // the pages of this phase at a phone's width: none scrolls sideways
        page.setViewport(390, 844)
        const wide = []
        const request = page.evaluate(() => location.pathname.replace(/\/changes$/, ""))
        for (const path of [
            P + "/-/merge-requests",
            request,
            request + "/commits",
            request + "/changes",
            request + "/checks",
            P + "/-/merge-requests/new",
            P + "/-/fork",
            P + "/-/forks",
            P + "/-/edit/main/docs/Guide.md",
            P + "/-/new/main/docs",
            P + "/-/upload/main/docs",
            P + "/-/delete/main/docs/Guide.md"
        ]) {
            const shown = page.goto(path)
            if (shown.status !== 200 || page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) wide.push(path + " " + shown.status)
        }
        return {plainHidden, destinations, opened, diff, wide}
    },
    then({plainHidden, destinations, opened, diff, wide}) {
        plainHidden === true
        // it may view and not push: a proposal is the one destination
        destinations === "proposal*"
        opened.includes("Update docs/Guide.md")
        opened.includes("pushed for review")
        diff.includes("The first step")
        diff.includes("Fixed on its page.")
        wide.join(", ") === ""
    }
})
feature("a page's redirect is answered before it renders: the ref picker, a tree path that is a file, the Compare form", {
    when() {
        const visitor = session()
        const picked = visitor.get("/code/walk/guide/-/tree?ref=main&path=src")
        const file = visitor.get("/code/walk/guide/-/tree/main/src/hello.txt")
        const compared = visitor.get("/code/walk/guide/-/compare?from=main&to=main")
        return {
            picked: picked.status + " " + picked.location,
            file: file.status + " " + file.location,
            compared: compared.status + " " + compared.location,
            // a redirect is kept by no cache
            caches: [picked, file, compared].map(answer => answer.header("Cache-Control")).join(" | ")
        }
    },
    then({picked, file, compared, caches}) {
        caches === "no-store | no-store | no-store"
        picked === "302 /code/walk/guide/-/tree/main/src"
        file === "302 /code/walk/guide/-/blob/main/src/hello.txt"
        compared === "302 /code/walk/guide/-/compare/main...main"
    }
})
