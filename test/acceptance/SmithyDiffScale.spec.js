// Smithy's diffs at scale (plan/design-smithy.md §9, §11): one merge request of more than 100,000 changed lines over
// many kinds of file (many small files, a large file rewritten in part, a large file added, a large file deleted, a
// minified file of one long line, a file over the host's diff size, CRLF, tabs, Unicode, a rename, an image) renders its
// Changes, its split view and one large file within a time and size budget, and so do the commit and the comparison.
// Each page says what it leaves out and links to it.
const fixtures = () => ec.resource.script("component://mr-pass/test/Smithy/SmithyFixtures.js")
const SITE = "PASS_SMITHY_SCALE"
const HOST = "smithy-scale.example.test"
const R = "/code/pass-sms/scale"
const s = {}
// the most a page may take to render here, and the most markup it may send
const BUDGET_MS = 20000
const BUDGET_BYTES = 12 * 1024 * 1024
const SMALL = 1500

// a file's text of count lines, line i from make(i)
const text = (count, make) => {
    const out = []
    for (let i = 0; i < count; i++) out.push(make(i))
    return out.join("\n") + "\n"
}
const small = (n, changed) =>
    text(40, i => (changed && i % 2 === 1 ? "    const value" + i + " = compute(" + n + ", " + i + ") // changed" : "    const value" + i + " = compute(" + n + ", " + i + ")"))
const big = changed => text(25000, i => (changed && i % 2 === 0 ? "line " + i + " was rewritten <here> & there" : "line " + i + " of the large file <b>"))
const minified = seed => "var a=" + seed + ";" + text(1, () => "") + Array.from({length: 20000}, (_, i) => "f" + i + "(" + (i * seed) % 97 + ")").join(";")
const huge = seed => text(60000, i => "row " + i + " seed " + seed + " padding padding padding")
// one render, timed, with what the page says
function timed(path, screen, params) {
    const started = Date.now()
    const page = fixtures().render(SITE, HOST, path, screen, params)
    const html = page.html || ""
    return {ms: Date.now() - started, bytes: html.length, errors: page.errors, html}
}

spec({
    requires: ["git"],
    setupSpec() {
        login("john.doe")
        const f = fixtures()
        f.site(SITE, HOST)
        s.group = f.group(SITE, "pass-sms", "public")
        const base = {
            "big.txt": big(false),
            "gone.txt": text(10000, i => "deleted line " + i),
            "app.min.js": minified(3),
            "huge.log": huge(1),
            "crlf.txt": "one\r\ntwo\r\nthree\r\n",
            "tabs.go": "func main() {\n\tif x {\n\t\treturn\n\t}\n}\n",
            "unicode.md": "# Größe\n\nemoji 🎉 and 中文\n",
            "old/name.txt": "renamed file\nsame text\n"
        }
        for (let n = 0; n < SMALL; n++) base["src/m" + Math.floor(n / 100) + "/f" + n + ".js"] = small(n, false)
        const made = f.repository(SITE, s.group, "scale", "public", base)
        s.repo = made.repositoryId
        s.first = made.commitId
        f.run("org.moqui.git.GitServices.create#GitRef", {repositoryId: s.repo, refName: "big/change", refType: "branch"})
        const fileMap = {
            "big.txt": big(true),
            "added.txt": text(20000, i => "added line " + i + " é"),
            "app.min.js": minified(5),
            "huge.log": huge(2),
            "crlf.txt": "one\r\nTWO\r\nthree\r\n",
            "tabs.go": "func main() {\n\tif y {\n\t\treturn nil\n\t}\n}\n",
            "unicode.md": "# Größe\n\nemoji 🎉🎉 and 中文字\n"
        }
        for (let n = 0; n < SMALL; n++) fileMap["src/m" + Math.floor(n / 100) + "/f" + n + ".js"] = small(n, true)
        s.head = f.run("org.moqui.git.GitServices.commit#GitFiles", {
            repositoryId: s.repo,
            branch: "big/change",
            message: "A change of more than 100,000 lines",
            fileMap,
            removePaths: ["gone.txt"],
            renameMap: {"old/name.txt": "new/name.txt"}
        }).commitId
        s.request = f.operation("createMergeRequest", {
            siteId: SITE,
            repositoryId: s.repo,
            sourceRef: "big/change",
            targetRef: "main",
            title: "Large change",
            body: "Many files.",
            sourceFormat: "markdown",
            operationId: "pass-sms-request-1"
        })
    },
    cleanup() {
        login("john.doe")
    }
})
const changes = extra =>
    timed(R + "/-/merge-requests/1/changes", "Smithy/MergeRequestDetail/Changes", {
        repositoryId: s.repo,
        namePath: "pass-sms/scale",
        mergeRequestNum: "1",
        ...extra
    })
feature("a merge request of more than 100,000 changed lines renders its Changes within the budget, and says what it leaves out", {
    when() {
        const page = changes({})
        ec.logger.info("scale: changes " + page.ms + " ms, " + page.bytes + " bytes")
        const counted = /([0-9]+) files changed <small>\+([0-9]+) −([0-9]+)<\/small>/.exec(page.html)
        return {page, counted: counted ? counted.slice(1).map(Number) : null}
    },
    then({page, counted}) {
        page.errors.length === 0
        page.ms < BUDGET_MS
        page.bytes < BUDGET_BYTES
        // the host finds no renames: old/name.txt is deleted and new/name.txt added
        counted[0] === SMALL + 10
        // every file's lines are counted (the host counts 3,000 files), the huge.log over its diff size not
        counted[1] + counted[2] > 100000
        // every file is in the file tree, the ones not shown link to their own diff
        page.html.includes('href="#file-' + (SMALL + 10) + '"')
        page.html.includes("only part of its diff is shown")
        page.html.includes("Load diff")
        !page.html.includes("<script>alert")
    }
})
feature("the split view of the same merge request renders within the budget", {
    when() {
        const page = changes({view: "split"})
        ec.logger.info("scale: split " + page.ms + " ms, " + page.bytes + " bytes")
        return {page}
    },
    then({page}) {
        page.errors.length === 0
        page.ms < BUDGET_MS
        page.bytes < BUDGET_BYTES
        page.html.includes('class="smithy-split"')
    }
})
// a row's id names the file by its place in the whole list, so the tests look for any file's row
const row = (html, side, line) => new RegExp('id="F[0-9]+' + side + line + '"').test(html)
feature("one large file (25,000 lines, half rewritten) shows on its own page in parts, unified and split", {
    when() {
        const unified = changes({path: "big.txt"})
        const last = changes({path: "big.txt", part: "4"})
        const split = changes({path: "big.txt", view: "split", part: "4"})
        ec.logger.info("scale: big.txt " + unified.ms + " ms, " + unified.bytes + " bytes; last part " + last.ms + " ms; split " + split.ms + " ms, " + split.bytes + " bytes")
        return {unified, last, split}
    },
    then({unified, last, split}) {
        unified.errors.length === 0
        last.errors.length === 0
        split.errors.length === 0
        unified.ms < BUDGET_MS
        last.ms < BUDGET_MS
        split.ms < BUDGET_MS
        unified.bytes < BUDGET_BYTES
        // 12,500 lines rewritten and 12,500 kept: 37,500 lines of diff, in 4 parts
        unified.html.includes("Part 1 of 4")
        unified.html.includes("Next part")
        row(unified.html, "R", 1)
        !row(unified.html, "R", 25000)
        // the changed words are marked, the text escaped
        unified.html.includes('<span class="x">rewritten</span> &lt;<span class="x">here</span>&gt;<span class="x"> &amp; there</span>')
        // the last part has the file's last line, and the part before it a link back
        last.html.includes("Part 4 of 4")
        row(last.html, "R", 25000)
        last.html.includes("Previous part")
        row(split.html, "R", 25000)
    }
})
feature("an added 20,000-line file, a minified one-line file, a file over the host's diff size and a deleted file each show on their own page", {
    when() {
        return {
            added: changes({path: "added.txt", part: "2"}),
            minified: changes({path: "app.min.js"}),
            huge: changes({path: "huge.log"}),
            gone: changes({path: "gone.txt"})
        }
    },
    then({added, minified, huge, gone}) {
        added.errors.length === 0
        added.html.includes("Part 2 of 2")
        row(added.html, "R", 20000)
        minified.errors.length === 0
        minified.ms < BUDGET_MS
        minified.html.includes("f19999(")
        huge.errors.length === 0
        huge.html.includes("too large")
        gone.errors.length === 0
        row(gone.html, "L", 10000)
    }
})
feature("the small odd files keep their text: CRLF, tabs, Unicode, a rename", {
    when() {
        return {
            crlf: changes({path: "crlf.txt"}).html,
            tabs: changes({path: "tabs.go"}).html,
            unicode: changes({path: "unicode.md"}).html,
            all: changes({}).html
        }
    },
    then({crlf, tabs, unicode, all}) {
        crlf.includes("</span>+TWO</div>")
        !crlf.includes("\r")
        tabs.includes("\tif ")
        unicode.includes("🎉")
        unicode.includes("中文")
        all.includes("new/name.txt")
    }
})
feature("the commit's and the comparison's Changes render within the budget", {
    when() {
        const commit = timed(R + "/-/commit/" + s.head, "Smithy/CommitDetail", {repositoryId: s.repo, namePath: "pass-sms/scale", commitId: s.head})
        const compare = timed(R + "/-/compare/main...big/change", "Smithy/Compare", {repositoryId: s.repo, namePath: "pass-sms/scale", base: "main", head: "big/change"})
        ec.logger.info("scale: commit " + commit.ms + " ms, " + commit.bytes + " bytes; compare " + compare.ms + " ms, " + compare.bytes + " bytes")
        return {commit, compare}
    },
    then({commit, compare}) {
        commit.errors.length === 0
        compare.errors.length === 0
        commit.ms < BUDGET_MS
        compare.ms < BUDGET_MS
        commit.bytes < BUDGET_BYTES
        compare.bytes < BUDGET_BYTES
        commit.html.includes('id="SmithyFileList"')
        compare.html.includes('id="SmithyFileList"')
        // the commit's diff shows its first files, not none
        commit.html.includes('class="smithy-lines"')
    }
})
feature("the commit's and the comparison's large file shows on its own page in parts, and a file past the host's first 300 has its diff there", {
    when() {
        const commit = path => timed(R + "/-/commit/" + s.head, "Smithy/CommitDetail", {repositoryId: s.repo, namePath: "pass-sms/scale", commitId: s.head, ...path})
        const compare = path =>
            timed(R + "/-/compare/main...big/change", "Smithy/Compare", {repositoryId: s.repo, namePath: "pass-sms/scale", base: "main", head: "big/change", ...path})
        return {
            commitBig: commit({path: "big.txt", part: "4"}),
            compareBig: compare({path: "big.txt", part: "4", view: "split"}),
            commitLate: commit({path: "unicode.md"}),
            compareLate: compare({path: "tabs.go"})
        }
    },
    then({commitBig, compareBig, commitLate, compareLate}) {
        commitBig.errors.length === 0
        compareBig.errors.length === 0
        commitBig.ms < BUDGET_MS
        compareBig.ms < BUDGET_MS
        commitBig.html.includes("Part 4 of 4")
        commitBig.html.includes("line 24999 of the large file &lt;b&gt;")
        compareBig.html.includes("Part 4 of 4")
        compareBig.html.includes('class="smithy-split"')
        // unicode.md and tabs.go sort after the 1,500 src/ files
        commitLate.html.includes('emoji 🎉<span class="x">🎉</span>')
        compareLate.html.replace(/<[^>]*>/g, "").includes("\t\treturn nil")
    }
})
