// Smithy's merge request, fork and file editing pages (Dogfood DG4; plan/design-smithy.md §9, §19.1): one render each of
// MergeRequests, a merge request's Overview (the conversation, the agreement box and the merge box of who may merge) and
// Changes (the diff escaped, a line comment at its line, a line's comment form), of the Edit page and of its save step; and
// a save through Smithy/Do for each destination (the branch, a new branch with a merge request, a proposal) and its
// conflict (the conflict view, a path that is taken, a text's first newline and its line endings); and the pages' own
// rules with no screen rendered (the confirmations, a check's target, Sign's link). The routes are in Smithy's spec and the access rules in SmithyAccess; the rules behind the operations are
// Mantle's (SmithyMergeRequests, SmithyAgreement, SmithyForks, SmithyEdit).
const fixtures = () => ec.resource.script("component://mr-pass/test/Smithy/SmithyFixtures.js")
const SITE = "PASS_SMITHY_REVIEW"
const HOST = "smithy-review.example.test"
const VIEWER = "pass.smr.viewer"
const R = "/code/pass-smr/review"
const s = {}
const AUTHORS =
    "# Authors\n\n## Contributing\n\n- Written in YEAR by NAME - LOGIN\n\n## Copyright Waiver\n\n- Written in 2026 by Someone Else - someone\n\n## Grant of Patent License\n\n- Written in 2026 by Someone Else - someone\n"
const as = (username, work) => {
    login(username, "moqui1!!")
    try {
        return work()
    } finally {
        login("john.doe")
    }
}
const id = () => ec.user.randomString(32)
const BASES = {smithy: "/code", account: "/account"}
const INFO = {authenticated: true, site: {}, profile: {}}
const scripts = () => ({
    smithy: ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js"),
    review: ec.resource.script("component://mr-pass/screen/Smithy/SmithyReview.js")
})
/* The Edit page's own view for the current user, with no screen rendered: it takes what the last step left in the session. */
function editPage(refPath, action) {
    const {smithy, review} = scripts()
    const self = R + "/-/" + action + "/" + refPath
    return review.edit(smithy.repositoryShell(SITE, s.repo, "/code", self), refPath, action, BASES, INFO, self).html
}
spec({
    requires: ["git"],
    setupSpec() {
        login("john.doe")
        const f = fixtures()
        f.site(SITE, HOST)
        s.group = f.group(SITE, "pass-smr", "public")
        const made = f.repository(SITE, s.group, "review", "public", {
            "README.md": "# Review sample\n",
            "AUTHORS.md": AUTHORS,
            "docs/Guide.md": "# Guide\n\nRead it.\n",
            "docs/Blank.md": "\nStarts after a blank line\n",
            "src/main.js": "const a = 1\nconsole.log(a)\n"
        })
        s.repo = made.repositoryId
        // a confirmed account with no role: it may view, comment and propose
        f.account(SITE, VIEWER, {confirmed: true})
        // a branch with a commit main does not have, and a merge request from it with a comment on its second line
        f.run("org.moqui.git.GitServices.create#GitRef", {repositoryId: s.repo, refName: "fix/greeting", refType: "branch"})
        s.head = f.run("org.moqui.git.GitServices.commit#GitFiles", {
            repositoryId: s.repo,
            branch: "fix/greeting",
            message: "Greet <everyone>\n\nA longer note.",
            fileMap: {"src/main.js": "const a = 1\nconsole.log('<script>alert(1)</script>', a)\n"}
        }).commitId
        // the agreement is required here: the merge request's authors have not signed
        const agreement = f.operation("getAgreement", {siteId: SITE, repositoryId: s.repo})
        s.agreement = f.operation("setAgreement", {
            siteId: SITE,
            repositoryId: s.repo,
            setting: "required",
            agreementPath: "AUTHORS.md",
            expectedRevision: agreement.revision
        })
        s.request = f.operation("createMergeRequest", {
            siteId: SITE,
            repositoryId: s.repo,
            sourceRef: "fix/greeting",
            targetRef: "main",
            title: "Greet & thank everyone",
            body: "It greets **all**.\n\n<script>alert(2)</script>\n",
            sourceFormat: "markdown",
            operationId: "pass-smr-request-1"
        })
        // a branch whose name needs encoding in a path, with a merge request of its own
        f.run("org.moqui.git.GitServices.create#GitRef", {repositoryId: s.repo, refName: "fix#1%2", refType: "branch"})
        f.run("org.moqui.git.GitServices.commit#GitFiles", {
            repositoryId: s.repo,
            branch: "fix#1%2",
            message: "A branch with a hash",
            fileMap: {"README.md": "# Review sample, again\n"}
        })
        s.odd = f.operation("createMergeRequest", {
            siteId: SITE,
            repositoryId: s.repo,
            sourceRef: "fix#1%2",
            targetRef: "main",
            title: "From an odd branch",
            body: "Text",
            sourceFormat: "markdown",
            operationId: "pass-smr-request-2"
        })
        s.comment = f.operation("createReviewComment", {
            siteId: SITE,
            repositoryId: s.repo,
            mergeRequestNum: s.request.mergeRequestNum,
            commitId: s.head,
            path: "src/main.js",
            newLine: 2,
            body: "Why a `script` here?\n\n<script>alert(3)</script>\n",
            sourceFormat: "markdown",
            operationId: "pass-smr-comment-1"
        })
    },
    cleanup() {
        login("john.doe")
    }
})
feature("MergeRequests lists a repository's open merge requests with their counts; the shell has the tab with its count", {
    when() {
        const page = fixtures().render(SITE, HOST, R + "/-/merge-requests", "Smithy/RepositoryDetail/MergeRequests", {
            repositoryId: s.repo,
            namePath: "pass-smr/review"
        })
        return {page, html: page.html, cache: page.header("Cache-Control"), setup: s}
    },
    then({page, html, cache, setup}) {
        setup.agreement.effective === "required"
        setup.request.mergeRequestNum === 1
        setup.comment.threadId != null
        page.errors.length === 0
        cache === "no-store"
        html.includes('<a href="' + R + '/-/merge-requests" aria-current="page">Merge requests <small>2</small></a>')
        html.includes('id="SmithyMergeRequestStates"')
        html.includes("Open <small>2</small>")
        // the title is text
        html.includes('<a href="' + R + '/-/merge-requests/1">Greet &amp; thank everyone</a> <small>!1</small>')
        html.includes('<a href="' + R + '/-/tree/fix/greeting">fix/greeting</a> → main')
        html.includes("Agreement not signed")
        html.includes('<a href="' + R + '/-/merge-requests/new">New merge request</a>')
        !html.includes("<script")
    }
})
feature("a merge request's Overview shows the conversation cleaned, the agreement box with Sign, and the merge box of who may merge", {
    when() {
        const page = fixtures().render(SITE, HOST, R + "/-/merge-requests/1", "Smithy/MergeRequestDetail/Overview", {
            repositoryId: s.repo,
            namePath: "pass-smr/review",
            mergeRequestNum: "1"
        })
        return {page, html: page.html, cache: page.header("Cache-Control")}
    },
    then({page, html, cache}) {
        page.errors.length === 0
        cache === "no-store"
        html.includes("<h2>Greet &amp; thank everyone <small>!1</small></h2>")
        html.includes('id="SmithyMergeRequestState">Open</strong>')
        html.includes('<a href="' + R + '/-/merge-requests/1/changes">Changes</a>')
        // the text is the authority's rendered Markdown, cleaned: none of its script
        html.includes("<strong>all</strong>")
        !html.includes("alert(2)")
        // the agreement: not signed, who is missing what, and Sign opens the edit page of the file the authority names
        html.includes('id="SmithyAgreement"')
        html.includes("Not signed")
        html.includes('id="SmithyAgreementMissing"')
        html.includes('<a href="' + R + '/-/edit/fix/greeting/AUTHORS.md?sign=1" id="SmithySign">')
        html.includes('<a href="' + R + '/-/blob/main/AUTHORS.md#contributing">How to sign</a>')
        // the site's owner may merge: the methods, asked again on the next page, and why it is not ready
        html.includes('<form method="get" action="' + R + '/-/merge-requests/1" id="SmithyMerge">')
        html.includes('<option value="merge"')
        html.includes('<li class="wrap">The contributor agreement is not signed</li>')
        html.includes('href="' + R + '/-/merge-requests/1?confirm=close"')
        html.includes("git fetch origin refs/merge-requests/1/head")
        // a comment's form with a preview, and the review form with Approve only for who may (not the author)
        html.includes('id="Smithy_publishPost"')
        html.includes('id="SmithyReview"')
        !html.includes('value="approve"')
    }
})
feature("Changes shows the diff as escaped text with an anchor a line, a line's thread at its line, and a line's comment form", {
    when() {
        const page = fixtures().render(SITE, HOST, R + "/-/merge-requests/1/changes", "Smithy/MergeRequestDetail/Changes", {
            repositoryId: s.repo,
            namePath: "pass-smr/review",
            mergeRequestNum: "1",
            // the link of the first line's number
            line: "F1R1"
        })
        const html = page.html
        const review = ec.resource.script("component://mr-pass/screen/Smithy/SmithyReview.js")
        return {
            page,
            html,
            at: ['id="F1R2"', 'id="thread-' + s.comment.threadId + '"'].map(text => html.indexOf(text)),
            scripts: ["/js/WebrootCode.js", "/js/WebrootPublic.qvt.js"].map(src => html.indexOf('<script src="' + src + '">')),
            lines: review
                .diffLines("--- a/x\n+++ b/x\n@@ -3,2 +3,3 @@ fn\n same\n-old\n+new\n+--- more\n")
                .map(line => line.kind + (line.oldNo ?? "") + ":" + (line.newNo ?? ""))
                .join(" ")
        }
    },
    then({page, html, at, scripts, lines}) {
        page.errors.length === 0
        html.includes("1 file changed")
        // the pushed text is escaped, each line with its number, its anchor and the link to its comment form
        html.includes("console.log(&#39;&lt;script&gt;alert(1)&lt;/script&gt;&#39;, a)</div>")
        html.includes('<div class="l a" id="F1R2"><a class="n" href="' + R + '/-/merge-requests/1/changes?line=F1R2#F1R2" data-line="F1R2"')
        html.includes('<div class="l d" id="F1L2">')
        // the thread is under its line, its Markdown rendered and cleaned, with a reply form and Resolve
        at[0] > 0
        at[1] > at[0]
        html.includes("<code>script</code>")
        !html.includes("alert(3)")
        html.includes('id="Smithy_createReviewComment_' + s.comment.threadId + '"')
        html.includes("Resolve thread")
        // the form of the line asked for
        html.includes('<input type="hidden" name="newLine" value="1">')
        html.includes("Comment on line 1 of src/main.js")
        // the island's scripts: the diff widget before the public shell mounts it
        html.includes('data-moqui-island="SmithyDiffReview"')
        scripts[0] > 0
        scripts[1] > scripts[0]
        // a hunk's lines are numbered on both sides, and a line of the text that begins like a header is text
        lines === "m: m: h: c3:3 d4: a:4 a:5"
    }
})
feature("the Edit page has the file's text, the blob it starts from and, for the agreement's file, how to sign; its save step asks where", {
    when() {
        const f = fixtures()
        const path = R + "/-/edit/main/AUTHORS.md"
        const page = f.render(SITE, HOST, path, "Smithy/RepositoryDetail/Edit", {
            repositoryId: s.repo,
            namePath: "pass-smr/review",
            refPath: "main/AUTHORS.md",
            editAction: "edit"
        })
        const blob = /name="baseBlobId" value="([0-9a-f]{40})"/.exec(page.html)?.[1]
        const step = (fields, keep) =>
            f.post(
                SITE,
                HOST,
                "editFile",
                {repositoryId: s.repo, branch: "main", action: "update", path: "AUTHORS.md", newPath: "AUTHORS.md", baseBlobId: blob, stage: "save", returnTo: path, ...fields},
                true,
                keep
            )
        // Continue: the text goes to the save step, kept for that one page (the page's own view, with no second render)
        const kept = step({content: AUTHORS + "- Written in 2026 by A <Name> - john\n"}, true)
        const save = editPage("main/AUTHORS.md", "edit")
        // what a step kept is another page's only: the page of another file starts from its own text
        step({content: "not this file's\n"}, true)
        const other = editPage("main/docs/Blank.md", "edit")
        // a text over the site's edit size is refused and not kept; a repository that is not there keeps nothing either
        const large = step({content: "x".repeat(1048577)}, true)
        ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js").takeFlash()
        const unseen = step({repositoryId: "pass-smr-none"}, true)
        const forms = ec.resource.script("component://mr-pass/screen/Smithy/SmithyForms.js")
        return {
            page,
            html: page.html,
            blob,
            kept,
            save,
            other,
            large,
            unseen,
            area: forms.textarea(forms.formOf({flash: {}}, "x"), "body", "Text", {value: "\nfirst line blank"}).html
        }
    },
    then({page, html, blob, kept, save, other, large, unseen, area}) {
        page.errors.length === 0
        blob.length === 40
        html.includes('<form method="post" class="card" id="Smithy_editFile" action="/code/-/do/editFile">')
        html.includes('name="newPath" value="AUTHORS.md"')
        html.includes("## Copyright Waiver")
        // how to sign: the account's own line under both lists, with no legal name written for it
        html.includes('id="SmithySignHelp"')
        html.includes("by &lt;your legal name&gt; - ")
        html.includes("Continue to save")
        html.includes('data-moqui-island="SmithyEditor"')
        kept.status === 303
        kept.location === R + "/-/edit/main/AUTHORS.md"
        kept.flash.stage === "save"
        // the save step: the message, the text carried, and the destinations with the default first
        save.includes('id="Smithy_commitFile" action="/code/-/do/commitFile"')
        save.includes('name="message" value="Update AUTHORS.md"')
        save.includes("- Written in 2026 by A &lt;Name&gt; - john")
        save.includes('<input type="hidden" name="baseBlobId" value="' + blob + '">')
        save.includes('id="SmithyDestinations"')
        save.includes('name="destination" value="newBranch"')
        save.includes("Back to the text")
        // the other file's page is its editor, with its own text; a file's first newline survives the HTML parser, which
        // drops one right after the tag, here and in every text field
        !other.includes('id="Smithy_commitFile"')
        !other.includes("not this file")
        other.includes('class="smithy-editor">\n\nStarts after a blank line')
        area.includes(">\n\nfirst line blank</textarea>")
        large.status === 303
        large.flash.error.field === "content"
        large.flash.values.content == null
        unseen.errors.length === 1
        unseen.flash.form == null
    }
})
feature("a save through Smithy/Do goes to the branch, to a new branch with a merge request, or as a proposal; a stale one is a conflict", {
    when() {
        const f = fixtures()
        const guide = branch =>
            f.operation("getEditContext", {siteId: SITE, repositoryId: s.repo, refPath: branch + "/docs/Guide.md", editAction: "update"})
        const save = (branch, fields) =>
            f.post(
                SITE,
                HOST,
                "commitFile",
                {
                    repositoryId: s.repo,
                    branch,
                    action: "update",
                    path: "docs/Guide.md",
                    message: "Update docs/Guide.md",
                    operationId: id(),
                    returnTo: R + "/-/edit/" + branch + "/docs/Guide.md",
                    ...fields
                },
                true,
                true
            )
        const start = guide("fix/greeting")
        const onMain = guide("main")
        // the branch: an Owner on a branch with no rule
        const branch = save("fix/greeting", {content: "# Guide\n\nRead it twice.\n", baseBlobId: start.blobId, destination: "branch"})
        // the same base again: the file has changed since
        const stale = save("fix/greeting", {content: "# Guide\n\nMine.\n", baseBlobId: start.blobId, destination: "branch"})
        // the page then shows both texts and asks (its own view, with no screen rendered)
        const conflict = editPage("fix/greeting/docs/Guide.md", "edit")
        // a new file at a path that has one is told so on the save step, never as a conflict of texts
        const taken = save("fix/greeting", {action: "create", content: "Another\n", destination: "branch", returnTo: R + "/-/new/fix/greeting/docs"})
        const takenPage = editPage("fix/greeting/docs", "new")
        // a form posts its lines with CRLF: the file keeps the line endings it is given by the authority's rule (LF here)
        const lines = save("fix/greeting", {
            action: "create",
            path: "docs/lines.txt",
            content: "a\r\nb\r\n",
            destination: "branch",
            returnTo: R + "/-/new/fix/greeting/docs"
        })
        const written = f.operation("getEditContext", {siteId: SITE, repositoryId: s.repo, refPath: "fix/greeting/docs/lines.txt", editAction: "update"})
        // a new branch with a merge request, to main
        const fresh = save("main", {
            content: "# Guide\n\nRead it on a branch.\n",
            baseBlobId: onMain.blobId,
            destination: "newBranch",
            newBranchName: "john-patch-1",
            mergeRequestTitle: "Guide: a branch"
        })
        // a proposal, from an account that may view and not push
        const viewer = as(VIEWER, () => ({
            context: guide("main"),
            proposal: save("main", {content: "# Guide\n\nRead it, proposed.\n", baseBlobId: onMain.blobId, destination: "proposal"})
        }))
        // an upload: the file staged with the authority for this repository (as the Upload page's step does), then saved
        const text = "Uploaded <notes>\n"
        // (the authority's script is called as the facade's service calls it; a file's writer does not cross a service call)
        const staged = ec.resource.script("component://mr-mantle/service/mantle/forum/Forum.js").execute("stageAttachment", {
            siteId: SITE,
            purpose: "repositoryFile",
            repositoryId: s.repo,
            file: {
                name: "notes.txt",
                size: text.length,
                contentType: "text/plain",
                write(location) {
                    ec.resource.getLocationReference(location).putText(text)
                }
            }
        })
        const upload = f.post(
            SITE,
            HOST,
            "commitFile",
            {
                repositoryId: s.repo,
                branch: "fix/greeting",
                action: "upload",
                path: "docs/notes.txt",
                attachmentId: staged.attachment?.attachmentId,
                message: "Upload docs/notes.txt",
                destination: "branch",
                operationId: id(),
                returnTo: R + "/-/upload/fix/greeting/docs"
            },
            true,
            true
        )
        const uploaded = f.operation("getEditContext", {
            siteId: SITE,
            repositoryId: s.repo,
            refPath: "fix/greeting/docs/notes.txt",
            editAction: "update"
        })
        const proposed = /\/merge-requests\/([0-9]+)$/.exec(viewer.proposal.location || "")?.[1]
        return {
            start,
            branch,
            stale,
            fresh,
            viewer,
            staged,
            upload,
            uploaded,
            conflict,
            taken,
            takenPage,
            lines,
            written,
            after: guide("fix/greeting"),
            proposed: proposed
                ? f.operation("getMergeRequest", {siteId: SITE, repositoryId: s.repo, mergeRequestNum: Number(proposed)}).mergeRequest
                : null
        }
    },
    then({start, branch, stale, fresh, viewer, staged, upload, uploaded, conflict, taken, takenPage, lines, written, after, proposed}) {
        conflict.includes('id="SmithyConflict"')
        conflict.includes("Read it twice.")
        conflict.includes("Mine.")
        conflict.includes("Save my text over the file as it is now")
        taken.status === 303
        ["nameTaken", "fileChanged"].includes(taken.flash.error.reason)
        takenPage.includes("A file is at that path.")
        !takenPage.includes('id="SmithyConflict"')
        takenPage.includes('id="Smithy_commitFile"')
        lines.location === R + "/-/blob/fix/greeting/docs/lines.txt"
        written.text === "a\nb\n"
        staged.attachment.filename === "notes.txt"
        upload.status === 303
        upload.location === R + "/-/blob/fix/greeting/docs/notes.txt"
        uploaded.text === "Uploaded <notes>\n"
        start.editable === true
        start.destinationList.some(d => d.destination === "branch")
        branch.status === 303
        branch.location === R + "/-/blob/fix/greeting/docs/Guide.md"
        branch.flash.notice === "Committed to fix/greeting."
        after.text === "# Guide\n\nRead it twice.\n"
        // nothing was saved, and the form's page shows both texts: the refusal names its reason and keeps what was typed
        stale.status === 303
        stale.location === R + "/-/edit/fix/greeting/docs/Guide.md"
        stale.flash.error.reason === "fileChanged"
        stale.flash.values.content === "# Guide\n\nMine.\n"
        fresh.status === 303
        fresh.location.startsWith(R + "/-/merge-requests/")
        fresh.flash.notice.startsWith("Your change is in merge request !")
        // the viewer is offered the proposal alone, and its save opens a merge request with no fork
        viewer.context.destinationList.map(d => d.destination).join(",") === "proposal"
        viewer.proposal.status === 303
        proposed.pushedForReview === true
        proposed.targetRef === "main"
    }
})
feature("page rules: a merge and a close ask again, a check's target is a link only when it is https, and Sign's link encodes its branch", {
    when() {
        const f = fixtures()
        const {smithy, review} = scripts()
        const self = R + "/-/merge-requests/" + s.odd.mergeRequestNum
        const key = {repositoryId: s.repo, mergeRequestNum: s.request.mergeRequestNum, returnTo: R + "/-/merge-requests/1"}
        // without the answer of its confirmation page neither runs
        const merge = f.post(SITE, HOST, "mergeMergeRequest", {...key, mergeMethod: "merge"})
        const close = f.post(SITE, HOST, "setMergeRequestState", {...key, state: "closed"})
        const shell = smithy.repositoryShell(SITE, s.repo, "/code", self)
        const request = review.requestShell(shell, String(s.odd.mergeRequestNum), BASES, INFO, self)
        return {
            merge,
            close,
            state: f.operation("getMergeRequest", {siteId: SITE, repositoryId: s.repo, mergeRequestNum: 1}).mergeRequest.state,
            // a status is reported by whoever holds the right: its target is never a script's or a plain http address
            checks: review.checks(shell, {
                found: {
                    checkList: [
                        {context: "ci/a", state: "success", targetUrl: "javascript:alert(1)"},
                        {context: "ci/b", state: "success", targetUrl: "http://example.test/b"},
                        {context: "ci/c", state: "success", targetUrl: "https://example.test/c"}
                    ]
                }
            }).html,
            // the author's Sign goes to the source branch, whose name has a # and a %
            sign: /<a href="([^"]*)" id="SmithySign">/.exec(review.overview(shell, request, BASES, INFO, self, {}).html)?.[1]
        }
    },
    then({merge, close, state, checks, sign}) {
        merge.status === 303
        merge.flash.error.message === "Confirm this change on its own page first."
        close.flash.error.message === "Confirm this change on its own page first."
        state === "open"
        !checks.includes("javascript:")
        !checks.includes('href="http://')
        checks.includes('<a href="https://example.test/c" rel="nofollow noopener">ci/c</a>')
        sign === R + "/-/edit/fix%231%252/AUTHORS.md?sign=" + s.odd.mergeRequestNum
    }
})
