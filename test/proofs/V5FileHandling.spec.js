// OWASP ASVS 5.0.0 V5 File Handling: PASS's proofs, each feature filed under the requirement its name starts with
// (docs/ASVS-Matrix.md, V5). They go through the Forum's composer as a member does: Compose/upload stages a file
// (mr-mantle service/mantle/forum/Forum.js stageAttachment), Compose/publish puts staged files on a post, and the topic's
// download transition serves a post's file (service/pass/Facade.js download). Publishing writes a topic, so the proofs
// that read a served file need the fixtures; the staging proofs run on a deployment's account and remove what they stage.

// Where the site mounts the Forum app: /forum on the fixtures' PASS_HTTP site, else --param forumPath=/path; and the
// Account app, /account, else --param accountPath=/path.
const FORUM = (params.forumPath ?? "/forum").replace(/\/+$/, "")
const ACCOUNT = (params.accountPath ?? "/account").replace(/\/+$/, "")
// The forum's documented upload rule (mr-moqui docs/security/Attack-Surface-Apps-PASS-Forum-Smithy.md): six types, at
// most 10 MiB (a site may set less), nothing empty.
const MAX_BYTES = 10485760
// The account that uploads: the run's (--param user=NAME, its password in MOQUI_TEST_PASSWORD), else in the fixtures
// profile ClientFixtures' site owner john.doe, who may start topics in the Welcome category.
const account = () => {
    if (params.user) return { username: params.user, password: params.password ?? "" }
    needsFixtures("an account to sign in with (or --param user=NAME and MOQUI_TEST_PASSWORD)")
    return { username: "john.doe", password: "moqui" }
}
// One signed-in composer for the spec: its session and the first category it may start a topic in.
let composer = null
const compose = () => {
    if (composer) return composer
    const { username, password } = account()
    const s = session({
        headers: profile == "fixtures" ? { "X-Moqui-Test-Peer": `127.9.${1 + Math.floor(Math.random() * 254)}.1` } : {},
    })
    s.get(`${ACCOUNT}/Login`)
    const signed = s.post(`${ACCOUNT}/Login/save`, { form: { formAction: "startSession", username, password } })
    assert(signed.status == 302 && !(signed.location ?? "").includes("/Login"),
        `the sign-in of ${username} did not succeed: HTTP ${signed.status} ${signed.text.slice(0, 200)}`)
    const state = s.get(`${FORUM}/Compose/state`, { accept: "json" })
    assert(state.status == 200, `${FORUM}/Compose/state answered ${state.status}`)
    const category = (state.json().categories ?? [])[0]
    if (!category) skip(`${username} may start a topic in no category of ${FORUM}`)
    composer = { s, contactListId: category.contactListId }
    return composer
}
const upload = (fileName, contentType, text) => {
    const { s, contactListId } = compose()
    return s.post(`${FORUM}/Compose/upload`, {
        multipart: { contactListId, file: { fileName, text, contentType } },
        accept: "json",
    })
}
const unstage = (res) => {
    const attachmentId = res.status == 200 ? res.json().attachment?.attachmentId : null
    if (attachmentId) compose().s.post(`${FORUM}/Compose/removeAttachment`, { form: { attachmentId }, accept: "json" })
}
// A topic published once for the spec with a clean text file whose name holds a quote, a backslash, a semicolon and a
// line break: its id, the download path of its topic and the file's id.
let published = null
const publishedFile = () => {
    if (published) return published
    needsFixtures("a forum category the fixtures' owner may publish a topic in (publishing writes to the site)")
    const { s, contactListId } = compose()
    const staged = upload('report"\\;\r\nX-Proof: 1.txt', "text/plain", "A file a proof published.")
    assert(staged.status == 200 && staged.json().attachment.scanState == "clean",
        `the upload was not staged clean: HTTP ${staged.status} ${staged.text.slice(0, 200)}`)
    const attachment = staged.json().attachment
    const posted = s.post(`${FORUM}/Compose/publish`, {
        json: {
            contactListId,
            title: `File proof ${Date.now()}`,
            body: "<p>A file for the file handling proofs.</p>",
            operationId: `file-proof-${Date.now()}`,
            attachmentIds: [attachment.attachmentId],
        },
        accept: "json",
    })
    assert(posted.status == 200, `the topic was not published: HTTP ${posted.status} ${posted.text.slice(0, 200)}`)
    const root = posted.json().rootCommEventId
    published = { s, attachment, root, download: `${FORUM}/t/${root}/proof/download` }
    return published
}

// The forum's upload rule as the maps document it: a file of one of six types (PNG, JPEG, WebP, GIF, PDF, plain text) and
// of 1 byte to the site's limit, at most 10 MiB; anything else is refused before it is stored. A staged file is removed
// after; the refused ones store nothing.
// Does not prove: the other apps' uploads (Support's case files, the Shop's review photos, Supplier's documents), each
// with its own rule in the maps, nor the 10 MiB itself, which the refusal states (a file that size is not sent); a type is
// the one the upload declares, served with nosniff (5.4.1's proof).
feature("v5.0.0-5.1.1: a forum upload of an undocumented type or an empty one is refused", {
    when() {
        const html = upload("page.html", "text/html", "<script>window.ran = 1</script>")
        const svg = upload("drawing.svg", "image/svg+xml", '<svg xmlns="http://www.w3.org/2000/svg"/>')
        const empty = upload("empty.txt", "text/plain", "")
        const allowed = upload("notes.txt", "text/plain", "plain notes")
        unstage(allowed)
        return { html, svg, empty, allowed }
    },
    then({ html, svg, empty, allowed }) {
        html.status == 422
        html.text.includes("Unsupported attachment type")
        svg.status == 422
        empty.status == 422
        const limit = Number((empty.text.match(/Upload must contain 1 byte to (\d+) bytes/) ?? [])[1])
        limit > 0 && limit <= MAX_BYTES
        // the control: a plain text file is staged, and scanned clean
        allowed.status == 200
        allowed.json().attachment.mimeType == "text/plain"
        allowed.json().attachment.scanState == "clean"
    },
})

// Configuration in the matrix: pass@scanner-service names the scanner every forum upload goes through before it can be
// posted (none ships; an upload is refused while it is empty). A file the scanner does not call clean is kept in
// quarantine: a post may not name it, and it is never downloaded. The probe is a file the run's scanner flags: in the
// fixtures profile the test scanner's marker (pass@test-scanner, test/MoquiConf.xml), in a deployment the EICAR test
// file, which antivirus scanners flag by agreement (put together here, so no file of the repository holds it).
// Does not prove: that a deployment's scanner finds real malware (its own vendor's claim), nor the other apps' uploads,
// which call the same setting.
feature("v5.0.0-5.4.3: an upload the scanner flags stays in quarantine, never posted or served", {
    when() {
        const marker = profile == "fixtures"
            ? "quarantine fixture"
            : ["X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR", "-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"].join("")
        const flagged = upload("probe.txt", "text/plain", marker)
        let posted = null, served = null, clean = null
        // a post that names it is refused (before the spec's topic is published: a member waits between posts)
        if (profile == "fixtures" && flagged.status == 200) {
            const { s, contactListId } = compose()
            posted = s.post(`${FORUM}/Compose/publish`, {
                json: {
                    contactListId,
                    title: `Quarantine proof ${Date.now()}`,
                    body: "<p>A flagged file.</p>",
                    operationId: `quarantine-proof-${Date.now()}`,
                    attachmentIds: [flagged.json().attachment.attachmentId],
                },
                accept: "json",
            })
            const { attachment, download } = publishedFile()
            served = s.get(download, { params: { attachmentId: flagged.json().attachment.attachmentId } })
            clean = s.get(download, { params: { attachmentId: attachment.attachmentId } })
        }
        unstage(flagged)
        // in a deployment the control is a plain file the scanner passes, removed after
        let passed = null
        if (profile != "fixtures") {
            const plain = upload("plain.txt", "text/plain", "a plain file")
            passed = plain.status == 200 ? plain.json().attachment.scanState : `HTTP ${plain.status}`
            unstage(plain)
        }
        return { flagged, posted, served, clean, passed }
    },
    then({ flagged, posted, served, clean, passed }) {
        // staged in quarantine, or refused outright by the scanner
        (flagged.status == 200 && flagged.json().attachment.scanState == "quarantined") || flagged.status >= 400
        posted == null || (posted.status == 422 && posted.text.includes("has not passed scanning"))
        served == null || served.status == 404
        // the control: the clean file of the same topic is served, or in a deployment a plain file is scanned clean
        clean == null || clean.status == 200
        passed == null || passed == "clean"
    },
})

// The download names the file by the name stored with it, which the upload cleaned to letters, digits, dot, dash,
// underscore and space; a name or a type the request gives is not read. The file goes as an attachment, with nosniff and
// no-store, of the type the upload declared (one of the six).
// Does not prove: the remote transports' downloads (the authority names them the same way: mr-mantle PassApi.js), nor
// the other apps' files.
feature("v5.0.0-5.4.1: a download's file name is the server's, whatever the request names", {
    when() {
        const { s, attachment, download } = publishedFile()
        const res = s.get(download, {
            params: { attachmentId: attachment.attachmentId, filename: "evil.html", fileName: "evil.html", contentType: "text/html" },
        })
        return { attachment, res }
    },
    then({ attachment, res }) {
        res.status == 200
        res.text == "A file a proof published."
        const disposition = res.header("content-disposition") ?? ""
        disposition.startsWith("attachment;")
        disposition.includes(`filename="${attachment.filename}"`)
        !disposition.includes("evil")
        /^[A-Za-z0-9._ -]+$/.test(attachment.filename)
        (res.header("content-type") ?? "").startsWith("text/plain")
        res.header("x-content-type-options") == "nosniff"
        res.header("cache-control") == "no-store"
    },
})

// A name uploaded with a quote, a backslash, a semicolon and a line break is served inside one quoted
// Content-Disposition parameter: the upload cleaned it, and the download replaces a quote, backslash, CR and LF again; no
// header of the name's own appears.
// Does not prove: the mail attachments PASS sends (a digest carries no files), nor a name of letters outside ASCII,
// which the upload makes underscores.
feature("v5.0.0-5.4.2: a file's uploaded name cannot add a header or a parameter to its download", {
    when() {
        const { s, attachment, download } = publishedFile()
        return { attachment, res: s.get(download, { params: { attachmentId: attachment.attachmentId } }) }
    },
    then({ attachment, res }) {
        res.status == 200
        res.headers("content-disposition").length == 1
        res.header("x-proof") == null
        const disposition = res.header("content-disposition") ?? ""
        /^attachment; filename="[^"\\\r\n;]*"$/.test(disposition)
        // the control: the stored name keeps the letters, digits and dots the upload sent last
        attachment.filename.endsWith("1.txt")
        !/["\\;\r\n]/.test(attachment.filename)
    },
})
