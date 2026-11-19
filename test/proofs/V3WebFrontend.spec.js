// OWASP ASVS 5.0.0 V3 Web Frontend Security: PASS's proofs, each feature filed under the requirement its name starts
// with (docs/ASVS-Matrix.md, V3). They go through a PASS site as its visitors do: its Account and Forum pages, and the
// authority's REST API on the same host (/rest/s1/pass/v1/sites/{site}), which a PASS page's scripts call.

// Where the site mounts the Account app: /account on the fixtures' PASS_HTTP site; a deployment that mounts it elsewhere
// passes --param accountPath=/path.
const ACCOUNT = (params.accountPath ?? "/account").replace(/\/+$/, "")
// The site's id, for the authority's API: the fixtures' PASS_HTTP, or a deployment's --param site=ID.
const SITE = params.site ?? (profile == "fixtures" ? "PASS_HTTP" : null)
const TOKEN_ERROR = "Session token is missing or is not valid"

// The account a proof signs in with: the run's (--param user=NAME, its password in MOQUI_TEST_PASSWORD), else in the
// fixtures profile ClientFixtures' member pass.http.reader.
const account = () => {
    if (params.user) return { username: params.user, password: params.password ?? "" }
    needsFixtures("an account to sign in with (or --param user=NAME and MOQUI_TEST_PASSWORD)")
    return { username: "pass.http.reader", password: "moqui1!!" }
}
// A session signed in through the site's sign-in form, which answers a redirect away from it.
const signIn = (username, password) => {
    const s = session()
    const page = s.get(`${ACCOUNT}/Login`)
    assert(page.status == 200, `GET ${ACCOUNT}/Login answered ${page.status}`)
    const res = s.post(`${ACCOUNT}/Login/save`, { form: { formAction: "startSession", username, password } })
    assert(res.status == 302 && !(res.location ?? "").includes("/Login"),
        `the sign-in of ${username} did not succeed: HTTP ${res.status} ${res.text.slice(0, 200)}`)
    return s
}
// One form of a page by its id, the selected option of one of its <select>s, and the value of one of its inputs.
const formOf = (html, id) => (html.match(new RegExp(`<form[^>]*id="${id}"[\\s\\S]*?</form>`)) ?? [])[0] ?? ""
const selected = (form, name) =>
    (((form.match(new RegExp(`<select[^>]*name="${name}"[\\s\\S]*?</select>`)) ?? [])[0] ?? "")
        .match(/<option value="([^"]*)" selected/) ?? [])[1] ?? null
const inputValue = (form, name) => (form.match(new RegExp(`<input[^>]*name="${name}"[^>]*value="([^"]*)"`)) ?? [])[1] ?? null

// Puts the owner's display name back after the 3.2.2 proof, whatever happened.
let restoreName = null

// Vue's text interpolation, as the islands use it: the topic island (Forum/Topics/TopicDetail.qvue) shows each post's
// author by display name, which a member sets to anything on Settings. ClientFixtures' owner john.doe wrote the site's
// Welcome topic; the proof sets his display name to markup and a template expression, then reads the topic in a browser.
// The control: the island has drawn the posts (the server-rendered ones are gone), and the post body, HTML by intent,
// is markup in its frame.
// Does not prove: the other islands (the Shop's, Smithy's) nor the server's escaping of the same name in its own pages
// (V1.2.1); the one v-html, Smithy's composer preview, is HTML by intent.
feature("v5.0.0-3.2.2: the topic island shows a member's display name as text, never markup", {
    given() { needsFixtures("ClientFixtures' site PASS_HTTP, its owner john.doe and its Welcome topic") },
    when() {
        const probe = `pass-probe-${Date.now()}`
        const name = `<img src="/x" id="${probe}">{{7*191}}`
        const s = signIn("john.doe", "moqui")
        const profile = formOf(s.get(`${ACCOUNT}/Settings`).text, "PassSettingsStoreProfile")
        assert(profile, "Settings offers john.doe no profile form")
        const handle = inputValue(profile, "handle") || "passowner"
        const store = (displayName, expectedRevision) => s.post(`${ACCOUNT}/Settings/save`, {
            form: { formAction: "storeProfile", handle, displayName, discoverability: "public", expectedRevision },
            accept: "json",
        })
        const stored = store(name, inputValue(profile, "expectedRevision") ?? "0")
        assert(stored.status == 200, `the profile was not saved: HTTP ${stored.status} ${stored.text.slice(0, 200)}`)
        restoreName = () => store(handle, String(stored.json().profile?.revision ?? ""))
        const topic = (session().get("/forum").text.match(/href="(\/forum\/t\/[^"]+\/welcome-to-the-community)"/) ?? [])[1]
        assert(topic, "the Welcome topic is not on /forum")
        const page = browser.newPage()
        // the post body's frame is sandboxed with no scripts, and Chromium reports each script it blocks there
        page.allowProblems(/Blocked script execution in 'about:srcdoc'/)
        page.goto(topic)
        // the island has loaded the posts from the topic's state and removed the server-rendered ones
        page.waitFor(() => !document.getElementById("pass-ssr-posts") && !!document.querySelector("article[data-post-id]"))
        page.waitFor(() => !!document.querySelector("article[data-post-id] iframe")?.contentDocument?.querySelector("p"))
        const seen = page.evaluate((probe) => {
            const article = document.querySelector("article[data-post-id]")
            return {
                element: !!document.getElementById(probe),
                images: article.querySelectorAll('img[src="/x"]').length,
                text: article.innerText,
                body: article.querySelector("iframe").contentDocument.querySelector("p").textContent,
            }
        }, probe)
        return { name, seen }
    },
    then({ name, seen }) {
        // the control: the body, HTML by intent, is a paragraph in the island's frame
        seen.body == "Public server-rendered discussion."
        seen.text.includes(name)
        !seen.element
        seen.images == 0
        !seen.text.includes("1337")
    },
    cleanup() {
        if (restoreName) restoreName()
        restoreName = null
    },
})

// The Account app's forms post to the screen's save transition, which keeps the framework's session token check; the
// delivery preferences form stands for them. The value is put back after.
// Does not prove: the forms of the other PASS apps, which post to transitions with the same check, nor calls a header
// authenticates (a bearer link, a login key), which carry no session token by design.
feature("v5.0.0-3.5.1: a PASS settings form saves only with the session's anti-forgery token", {
    when() {
        const { username, password } = account()
        const s = signIn(username, password)
        const read = () => formOf(s.get(`${ACCOUNT}/Settings`).text, "PassSettingsSetPreferences")
        const form = read()
        if (!form) skip(`${username} is not a member of the site: Settings offers no delivery preferences`)
        const was = selected(form, "emailMode")
        const target = was == "Digest" ? "None" : "Digest"
        const post = (csrf, emailMode, expectedRevision) => s.post(`${ACCOUNT}/Settings/save`, {
            form: Object.assign(
                {
                    formAction: "setPreferences", emailMode, expectedRevision,
                    watchLevel: selected(form, "watchLevel") ?? "Normal",
                    digestPeriod: selected(form, "digestPeriod") ?? "daily",
                },
                /<input[^>]*name="includeOwn"[^>]*checked/.test(form) ? { includeOwn: "true" } : {},
            ),
            accept: "json",
            csrf,
        })
        const refused = post(false, target, inputValue(form, "expectedRevision"))
        const unchanged = selected(read(), "emailMode")
        const allowed = post(true, target, inputValue(form, "expectedRevision"))
        const after = read()
        if (allowed.status == 200) post(true, was, inputValue(after, "expectedRevision"))
        return { was, target, refused, unchanged, allowed, changed: selected(after, "emailMode") }
    },
    then({ was, target, refused, unchanged, allowed, changed }) {
        refused.status == 401
        refused.text.includes(TOKEN_ERROR)
        unchanged == was
        // the control: the same post with the token saves
        allowed.status == 200
        changed == target
    },
})

// The authority's REST API takes a write with the session's cookie only with the session token in a header
// (mr-mantle script/PassApi.js); a cross-site form can send the cookie and the body, not the header. A draft stands for
// the writes: the one the token allows is discarded after.
// Does not prove: the account routes and a registered client's token writes, which a PASS frontend sends with its
// client secret, nor a deployment whose authority is on another host than its pages.
feature("v5.0.0-3.5.1: the authority API refuses a cookie-borne form post without the token header", {
    when() {
        if (!SITE) skip("the site's id is not known: pass --param site=ID to reach its authority API")
        const { username, password } = account()
        const s = signIn(username, password)
        const api = `/rest/s1/pass/v1/sites/${encodeURIComponent(SITE)}`
        const category = (s.get(`${api}/categories`, { accept: "json" }).json().categoryList ?? [])[0]
        if (!category) skip(`the site ${SITE} has no category ${username} can see`)
        const stamp = Date.now()
        const draft = (csrf, title) => s.post(`${api}/me/drafts`, {
            form: { mode: "topic", contactListId: category.contactListId, title, body: "<p>anti-forgery proof</p>" },
            accept: "json",
            csrf,
        })
        const refused = draft(false, `refused ${stamp}`)
        const allowed = draft(true, `allowed ${stamp}`)
        const drafts = (s.get(`${api}/me/drafts`, { accept: "json" }).json().draftList ?? []).map((d) => d.title)
        if (allowed.status == 200)
            s.delete(`${api}/me/drafts/${allowed.json().draftId}`, { params: { expectedRevision: allowed.json().revision } })
        return { stamp, refused, allowed, drafts }
    },
    then({ stamp, refused, allowed, drafts }) {
        refused.status == 403
        refused.json().code == "Unauthorized"
        !drafts.includes(`refused ${stamp}`)
        // the control: with the header the same post stores the draft
        allowed.status == 200
        drafts.includes(`allowed ${stamp}`)
    },
})

// Level 2 (P5). Where the site mounts the Forum app: /forum on the fixtures' site, else --param forumPath=/path.
const FORUM = (params.forumPath ?? "/forum").replace(/\/+$/, "")
// In the fixtures profile each session names an address of its own in 127.0.0.0/8 (X-Moqui-Test-Peer, which only the
// project's test server reads), so PASS's sign-in limit per client counts these proofs apart from the rest of the run.
const peerHeaders = () =>
    profile == "fixtures"
        ? { "X-Moqui-Test-Peer": `127.5.${1 + Math.floor(Math.random() * 254)}.${1 + Math.floor(Math.random() * 254)}` }
        : {}

// Configuration in the matrix: each site has a host of its own whose root screen refuses the framework's routes
// (root-screen@framework-routes="refuse", as runtime/conf/MoquiSitesConf.xml gives each site host), and the authority's
// REST stays on the business host. In the fixtures profile the site is ClientFixtures' PASS_HTTP on pass.sites.localhost,
// which test/MoquiConf.xml gives that rule; in the deployment profile the server named is the site's host, or the host
// --param siteHost=NAME names (sent as the Host header, for a server reached by its address).
// Does not prove: that the business apps answer on another host (a proof reaches only the host it is given), nor what a
// proxy in front serves; the session cookie is the host's alone (no Domain), so a browser sends it to no other host.
feature("v5.0.0-3.5.4: a site's own host serves its apps and none of the framework's routes", {
    when() {
        const host = params.siteHost ?? (profile == "fixtures" ? "pass.sites.localhost" : null)
        const s = session({ headers: host ? { Host: `${host}:${server.port}` } : {} })
        const page = s.get(`${ACCOUNT}/Login`)
        const refused = ["/Login", "/apps", `/rest/s1/pass/v1/sites/${encodeURIComponent(SITE ?? "none")}/site`,
            "/rest/e1/moqui.basic.Enumeration"].map((path) => ({ path, status: s.get(path).status }))
        return { page, refused }
    },
    then({ page, refused }) {
        // the control: the site's own sign-in page answers on its host
        page.status == 200
        page.text.includes('id="PassLoginStartSession"')
        page.cookies.length > 0 && page.cookies.every((cookie) => !cookie.domain)
        refused.every(({ status }) => status == 404)
    },
})

// The pages a visitor sees, an island's among them: a topic, which loads Vue's runtime build and Quasar from the site's
// own /libs (the islands are compiled on the server, so no eval); the policy has object-src 'none', so no plugin content
// runs even if markup named one. The versions are read from the libraries' own headers.
// Does not prove: a shop theme's markup (the theme check refuses scripts and plugin elements: mr-mantle ThemeAuthoring),
// nor that a visitor's browser is current.
feature("v5.0.0-3.7.1: PASS pages load only their own scripts, current Vue and Quasar, no plugins", {
    when() {
        const s = session()
        const topic = (s.get(FORUM).text.match(/href="(\/[^"]*\/t\/[^"]+)"/) ?? [])[1]
        if (!topic) skip(`no topic is listed on ${FORUM} to read an island from: --param forumPath=/path`)
        const pages = [`${ACCOUNT}/Login`, FORUM, topic].map((path) => {
            const res = s.get(path)
            return {
                path,
                status: res.status,
                csp: res.header("content-security-policy") ?? "",
                scripts: (res.text.match(/<script\b[^>]*\bsrc="[^"]*"/g) ?? []).map((tag) => tag.match(/src="([^"]*)"/)[1]),
                plugins: (res.text.match(/<(?:object|embed|applet)\b/gi) ?? []).length,
            }
        })
        const banner = (pattern) => {
            const src = pages.flatMap((p) => p.scripts).find((s) => pattern.test(s))
            return src ? s.get(src, { headers: { Range: "bytes=0-299" } }).text.slice(0, 300) : ""
        }
        return { pages, vue: banner(/\/libs\/vue\//), quasar: banner(/\/libs\/quasar\/quasar\./) }
    },
    then({ pages, vue, quasar }) {
        pages.every((p) => p.status == 200)
        pages.every((p) => /(^|;)\s*object-src 'none'/.test(p.csp) && /(^|;)\s*script-src 'self'(;|$)/.test(p.csp))
        pages.every((p) => p.plugins == 0)
        pages.every((p) => p.scripts.every((src) => src.startsWith("/") && !src.startsWith("//")))
        // the control: the topic page loads the island's scripts
        pages[2].scripts.length > 0
        /\bvue v3\.\d+\.\d+/.test(vue)
        /Quasar Framework v2\.\d+\.\d+/.test(quasar)
    },
})

// The site's sign-in form keeps a returnTo only when it is a local path (service/pass/Account.js safeReturnPath: one
// leading slash, not two, no backslash, white space or control character) and sends a visitor there after signing in;
// anything else (here a host-relative //host, the form a browser reads as another site) lands on the site's own page.
// Does not prove: a tracking link's destination (checked when saved, store#TrackingLink) nor the SSO callback (the
// client's configured one); the framework's own sign-in is the framework's proof.
feature("v5.0.0-3.7.2: PASS's sign-in follows a returnTo on the site, never one off it", {
    when() {
        const { username, password } = account()
        const signInTo = (returnTo) => {
            const s = session({ headers: peerHeaders() })
            s.get(`${ACCOUNT}/Login`, { params: { returnTo } })
            return s.post(`${ACCOUNT}/Login/save`, { form: { formAction: "startSession", username, password, returnTo } })
        }
        return { schemeless: signInTo("//evil.example/phish"), on: signInTo(`${ACCOUNT}/Settings?from=proof`) }
    },
    then({ schemeless, on }) {
        schemeless.status == 302
        !/evil\.example|\/phish/.test(schemeless.location ?? "")
        (schemeless.location ?? "").startsWith("/") && !(schemeless.location ?? "").startsWith("//")
        // the control: a local path is followed
        on.status == 302
        on.location == `${ACCOUNT}/Settings?from=proof`
    },
})
