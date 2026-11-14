/* Smithy's pages (Dogfood DG1, DG2; plan/design-smithy.md §1, §6, §7): the browsing of groups and repositories. The pages
 * that write (DG2: new, settings, members, Git access) and the forms' transitions are SmithyForms.js, which uses this.
 * Each page's view is built here from the authority's reads, every one through pass.Facade.call#Operation (Shared/Portal.js
 * attempt), with the ids the route resolver gave (service/pass/SmithyRoutes.js). What the authority answers Not Found (a path
 * with no row, and what the caller may not view) is the framework's Not Found, the same for both. A page is plain HTML with
 * ordinary links; text from a repository is escaped here (code, a diff) or was cleaned by the authority (a rendered README).
 * CC0 plus patent grant. */
const portal = ec.resource.script("component://mr-pass/screen/Shared/Portal.js")
/* A refusal the framework answers with its own page; never kept by a cache. */
function fail(kind, message) {
    ec.web?.response?.setHeader("Cache-Control", "no-store")
    const error = new Error(message || "Page not found")
    error.moquiErrorKind = kind || "NotFound"
    throw error
}
/* A read the page cannot be shown without: its result, or the framework's page for its refusal (Not Found says no more). */
function need(operation, input) {
    const out = portal.attempt(operation, input)
    if (out.error)
        fail(
            out.error.kind === "NotFound" ? "NotFound" : out.error.kind,
            out.error.kind === "NotFound" ? null : out.error.message
        )
    return out.result
}
/* A read a page shows without when it is refused. */
const maybe = (operation, input) => portal.attempt(operation, input).result || null
/* A parameter's one value (a repeated one's first), or null. */
function param(name) {
    const value = ec.web?.parameters?.[name]
    if (value == null || value === "") return null
    if (typeof value === "object" && value.length != null) return value.length ? String(value[0]) : null
    return String(value)
}
const esc = text =>
    String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
const enc = path =>
    String(path || "")
        .split("/")
        .map(encodeURIComponent)
        .join("/")
const query = values => {
    const text = Object.entries(values || {})
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => k + "=" + encodeURIComponent(v))
        .join("&")
    return text ? "?" + text : ""
}
/* A date as the pages show it: the day in the signed-in account's time zone, or the site's for a visitor (whose page a cache
 * may keep), from a time in milliseconds, an ISO text or a timestamp. */
function dateText(value) {
    if (value == null || value === "") return ""
    const time =
        typeof value === "number"
            ? value
            : typeof value.getTime === "function"
              ? value.getTime()
              : /^[0-9]{9,}$/.test(String(value))
                ? Number(value)
                : (ec.user.timestampMillis(value) ?? Date.parse(String(value)))
    if (!Number.isFinite(time)) return String(value)
    const zone = ec.user.userId ? null : ec.context.get("siteInfo")?.site?.timeZone || null
    return String(ec.l10n.format(new Date(time), "yyyy-MM-dd", null, zone))
}
/* A role's rank (design §5.1), so a page shows a tab to the roles that may use it; the authority checks every write. */
const RANK = {guest: 10, reporter: 20, developer: 30, maintainer: 40, owner: 50}
const holds = (role, minimum) => (RANK[role] || 0) >= RANK[minimum]
/* What a form's transition leaves for the next page of the session (SmithyForms.js run): a notice, or a refusal with what
 * was typed, read once and dropped after two minutes. Only a signed-in request has one, so a visitor's page starts no
 * session and stays one a shared cache may keep. */
const FLASH = "passSmithyFlash"
const FLASH_LIFE = 120000
function setFlash(value) {
    ec.web.sessionAttributes[FLASH] = JSON.stringify({...value, at: Date.now()})
}
function takeFlash() {
    if (!ec.user.userId || !ec.web) return {}
    const attributes = ec.web.sessionAttributes
    const kept = attributes[FLASH]
    if (!kept) return {}
    attributes.remove(FLASH)
    try {
        const value = JSON.parse(String(kept))
        return value && Date.now() - Number(value.at) < FLASH_LIFE ? value : {}
    } catch (error) {
        return {}
    }
}
/* Drops what a form's transition left when no page took it within two minutes (a redirect that was not followed), so a new
 * token does not stay in the session. Pass.xml calls this on every request of a signed-in account, in any app. */
function expireFlash() {
    if (!ec.user.userId || !ec.web) return
    const attributes = ec.web.sessionAttributes
    const kept = attributes[FLASH]
    if (!kept) return
    let at = 0
    try {
        at = Number(JSON.parse(String(kept)).at)
    } catch (error) {
        // not ours to keep
    }
    if (!(Date.now() - at < FLASH_LIFE)) attributes.remove(FLASH)
}
const shortId = id => String(id || "").slice(0, 8)
function sizeText(size) {
    const n = Number(size)
    if (!Number.isFinite(n)) return ""
    if (n < 1024) return n + " B"
    if (n < 1048576) return (n / 1024).toFixed(1) + " KiB"
    return (n / 1048576).toFixed(1) + " MiB"
}
/* The name a link carries for a ref: a branch's or tag's name, a commit's id. */
const refName = ref => (ref ? (ref.kind === "commit" ? ref.commitId : ref.name) || "" : "")
const joinRef = (ref, path) => (path ? ref + "/" + path : ref)
/* The addresses of a repository's pages under the mount's base. */
function urls(base, repositoryPath) {
    const root = (base || "") + "/" + enc(repositoryPath)
    const section = (word, refPath) => root + "/-/" + word + (refPath ? "/" + enc(refPath) : "")
    return {
        root,
        section,
        tree: (ref, path) => section("tree", joinRef(ref, path)),
        blame: (ref, path) => section("blame", joinRef(ref, path)),
        archive: (ref, format) => section("archive", ref + "." + format),
        blob: (ref, path) => section("blob", joinRef(ref, path)),
        raw: (ref, path) => section("raw", joinRef(ref, path)),
        commits: (ref, path) => section("commits", joinRef(ref, path)),
        commit: id => section("commit", id),
        compare: (from, to) => section("compare", from + "..." + to)
    }
}
/* The breadcrumb of a name path: each prefix is a group's (or the account's) page. */
const crumbsOf = (base, namePath, lastLabel) => {
    const parts = String(namePath || "").split("/")
    return parts.map((part, i) => ({
        label: i === parts.length - 1 && lastLabel ? lastLabel : part,
        href: (base || "") + "/" + enc(parts.slice(0, i + 1).join("/"))
    }))
}
const visibilityOf = record => String(record?.effectiveVisibility || record?.visibility || "")
const groupRow = (base, g) => ({
    name: g.name || g.pathSegment,
    path: g.groupPath,
    href: (base || "") + "/" + enc(g.groupPath),
    description: g.description || "",
    visibility: visibilityOf(g),
    repositoryCount: g.repositoryCount,
    subgroupCount: g.subgroupCount
})
const repositoryRow = (base, r) => ({
    name: r.name || r.slug,
    path: r.repositoryPath,
    href: (base || "") + "/" + enc(r.repositoryPath),
    description: r.description || "",
    visibility: visibilityOf(r),
    archived: !!r.archived,
    mirror: !!r.mirror,
    forkOf: r.forkOf?.repositoryPath
        ? {path: r.forkOf.repositoryPath, href: (base || "") + "/" + enc(r.forkOf.repositoryPath)}
        : null,
    forkCount: Number(r.forkCount) || 0,
    pushed: dateText(r.lastPushAt)
})
const commitRow = (u, base, c) => ({
    commitId: c.commitId,
    shortId: shortId(c.commitId),
    href: u.commit(c.commitId),
    summary: c.summary || "",
    // DG1 shows the name in the commit; no account is taken from an address
    authorName: c.authorName || "",
    date: dateText(c.authorDate || c.commitDate)
})

/* The section word of a request path (the segment after /-/), or "" for a name's own page. */
const sectionWord = path => /\/-\/([^/?]+)/.exec(String(path || ""))?.[1] || ""

/* The open issues the caller may see of a repository ({repositoryId}) or of a group's repositories ({groupId}), for the
 * Issues tab: the count findIssues answers (design §8), which leaves out what the caller may not see; null when it cannot be
 * read, and for a visitor, whose page a cache may keep for a minute while an issue is made confidential. */
function openIssueCount(siteId, scope) {
    // not on a page a shared cache may keep: a visitor's shell has the tab without a count
    if (!ec.user.userId) return null
    const counts = maybe("findIssues", {siteId, ...scope, state: "open", limit: 1})?.counts
    return counts && Number.isFinite(Number(counts.open)) ? Number(counts.open) : null
}
/* A group's shell (design §1): its record, breadcrumb, visibility and the tabs the caller may use. */
function groupShell(siteId, groupId, base, path) {
    const found = need("getGroup", {siteId, groupId})
    const group = found.group
    const root = (base || "") + "/" + enc(group.groupPath)
    const word = sectionWord(path)
    return {
        group,
        siteId,
        base: base || "",
        capabilities: found.capabilities || {},
        myRole: found.myRole || null,
        root,
        flash: takeFlash(),
        visibility: visibilityOf(group),
        crumbs: crumbsOf(base, group.groupPath, group.name),
        // a tab the caller may not use is absent: Settings is an Owner's
        tabs: [
            {label: "Overview", href: root, current: !word},
            {label: "Repositories", href: root + "/-/repositories", current: word === "repositories"},
            // the open issues of its repositories that the caller may see
            {
                label: "Issues",
                href: root + "/-/issues",
                current: word === "issues",
                count: openIssueCount(siteId, {groupId: group.groupId})
            },
            {label: "Members", href: root + "/-/members", current: word === "members"},
            ...(holds(found.myRole, "owner")
                ? [{label: "Settings", href: root + "/-/settings", current: word === "settings"}]
                : [])
        ]
    }
}
/* A group's Overview (before DG7: its description, pinned repositories and subgroups); Home shows it for the home group. */
function overview(siteId, shell, base) {
    const groupId = shell.group.groupId
    const pinned = maybe("findRepositories", {siteId, groupId, pinned: true, limit: 30})
    const subgroups = maybe("findGroups", {siteId, parentGroupId: groupId, limit: 30})
    return {
        description: shell.group.description || "",
        pinned: (pinned?.repositoryList || []).map(r => repositoryRow(base, r)),
        subgroups: (subgroups?.groupList || []).map(g => groupRow(base, g)),
        repositoriesHref: shell.root + "/-/repositories"
    }
}
/* Home (design §6): the home group's Overview when the site has one the caller may view, else Explore. */
function home(siteId, base) {
    const found = maybe("getSmithyHome", {siteId})
    if (!found?.homeGroupId) return {explore: explore(siteId, base)}
    const shell = groupShell(siteId, found.homeGroupId, base, "")
    return {shell, overview: overview(siteId, shell, base)}
}
/* Explore (design §6): groups and repositories the caller may view, with one search field and a kind filter. */
function explore(siteId, base) {
    const path = (base || "") + "/explore"
    const q = param("q")
    const flash = takeFlash()
    const kind = ["groups", "repositories"].includes(param("kind")) ? param("kind") : "all"
    const groupCursor = param("gc")
    const repositoryCursor = param("rc")
    const groups =
        kind === "repositories"
            ? null
            : need("findGroups", {siteId, limit: 30, ...(q ? {query: q} : {}), ...(groupCursor ? {cursor: groupCursor} : {})})
    const repositories =
        kind === "groups"
            ? null
            : need("findRepositories", {
                  siteId,
                  limit: 30,
                  sort: "pushed",
                  ...(q ? {query: q} : {}),
                  ...(repositoryCursor ? {cursor: repositoryCursor} : {})
              })
    const filters = {q, kind: kind === "all" ? null : kind}
    return {
        action: path,
        notice: flash.notice || null,
        q: q || "",
        kind,
        groups: groups ? groups.groupList.map(g => groupRow(base, g)) : null,
        repositories: repositories ? repositories.repositoryList.map(r => repositoryRow(base, r)) : null,
        moreGroupsHref: groups?.nextCursor ? path + query({...filters, gc: groups.nextCursor}) : null,
        moreRepositoriesHref: repositories?.nextCursor ? path + query({...filters, rc: repositories.nextCursor}) : null
    }
}
/* GroupRepositories (design §6): subgroups first, then the group's repositories with a filter and a sort. */
function groupRepositories(siteId, shell, base) {
    const path = shell.root + "/-/repositories"
    const groupId = shell.group.groupId
    const q = param("q")
    const sort = param("sort") === "pushed" ? "pushed" : "name"
    const cursor = param("cursor")
    const subgroups = cursor ? null : maybe("findGroups", {siteId, parentGroupId: groupId, limit: 100})
    const found = need("findRepositories", {
        siteId,
        groupId,
        sort,
        limit: 30,
        ...(q ? {query: q} : {}),
        ...(cursor ? {cursor} : {})
    })
    return {
        action: path,
        q: q || "",
        sort,
        subgroups: (subgroups?.groupList || []).map(g => groupRow(base, g)),
        repositories: found.repositoryList.map(r => repositoryRow(base, r)),
        moreHref: found.nextCursor ? path + query({q, sort: sort === "name" ? null : sort, cursor: found.nextCursor}) : null,
        // New repository and New subgroup, by capability
        newRepositoryHref: shell.capabilities.canCreateRepository
            ? (base || "") + "/new/repository" + query({namespace: shell.group.groupPath})
            : null,
        newSubgroupHref: shell.capabilities.canCreateSubgroup
            ? (base || "") + "/new/group" + query({parent: shell.group.groupPath})
            : null
    }
}
/* GroupMembers (design §6): the members the caller may see, with the role and where it comes from. */
function groupMembers(siteId, shell, base) {
    const path = shell.root + "/-/members"
    const cursor = param("cursor")
    const found = need("findGroupMembers", {siteId, groupId: shell.group.groupId, limit: 30, ...(cursor ? {cursor} : {})})
    return {
        members: found.memberList.map(m => ({
            handle: m.handle,
            href: m.handle ? (base || "") + "/" + enc(m.handle) : null,
            displayName: m.displayName || m.handle || "Member",
            role: m.role,
            fromPath: m.fromPath && m.fromPath !== shell.group.groupPath ? m.fromPath : null,
            // a role of this group itself is the one its Owner changes here
            own: !m.fromPath || m.fromPath === shell.group.groupPath,
            revision: m.revision,
            since: dateText(m.fromDate),
            until: dateText(m.thruDate)
        })),
        moreHref: found.nextCursor ? path + query({cursor: found.nextCursor}) : null
    }
}
/* AccountDetail (design §6): a personal namespace, the profile card and the repositories the caller may view. */
function account(siteId, handle, base) {
    const path = (base || "") + "/" + enc(handle)
    const cursor = param("cursor")
    const profile = maybe("getProfile", {siteId, handle})
    const found = need("findRepositories", {siteId, ownerHandle: handle, sort: "name", limit: 30, ...(cursor ? {cursor} : {})})
    if (!profile && !found.repositoryList.length) fail()
    const card = profile?.profile || profile || {}
    return {
        handle,
        displayName: card.displayName || handle,
        bio: card.bio || "",
        repositories: found.repositoryList.map(r => repositoryRow(base, r)),
        moreHref: found.nextCursor ? path + query({cursor: found.nextCursor}) : null
    }
}

/* A repository's shell (design §1): its record, breadcrumb, chips, clone addresses and the tabs of what is built. */
function repositoryShell(siteId, repositoryId, base, path) {
    const found = need("getRepository", {siteId, repositoryId})
    const word = sectionWord(path)
    const repository = found.repository
    const u = urls(base, repository.repositoryPath)
    const clone = found.cloneUrls || {}
    return {
        repository,
        // the repository's group (null in a personal namespace): what is inside it is no wider than it
        group: found.group || null,
        siteId,
        // plain data only: the shell is kept in the screen's context between the shell's script and the page's
        base: base || "",
        capabilities: found.capabilities || {},
        flash: takeFlash(),
        visibility: visibilityOf(repository),
        crumbs: crumbsOf(base, repository.repositoryPath, repository.name),
        forkOf: repository.forkOf?.repositoryPath
            ? {path: repository.forkOf.repositoryPath, href: (base || "") + "/" + enc(repository.forkOf.repositoryPath)}
            : null,
        // where Smithy is the site's root app the page's URL is a clone address too, and comes first
        cloneUrls: [
            ["Page URL", clone.page],
            ["HTTPS", clone.https],
            ["SSH", clone.ssh]
        ]
            .filter(([, url]) => url)
            .map(([label, url]) => ({label, url})),
        // the addresses a first commit is pushed to (the page's own only where there is no other HTTPS one)
        pushUrls: [
            ["HTTPS", clone.https || clone.page],
            ["SSH", clone.ssh]
        ]
            .filter(([, url]) => url)
            .map(([label, url]) => ({label, url})),
        tabs: [
            {label: "Files", href: u.root, current: ["", "tree", "blob"].includes(word)},
            {label: "Commits", href: u.section("commits"), current: ["commits", "commit"].includes(word)},
            {label: "Branches", href: u.section("branches"), current: word === "branches"},
            {label: "Tags", href: u.section("tags"), current: word === "tags"},
            // a feature turned off has no tab (and its pages are Not Found)
            ...(repository.features?.issues
                ? [
                      {
                          label: "Issues",
                          href: u.section("issues"),
                          current: ["issues", "labels", "milestones"].includes(word),
                          count: openIssueCount(siteId, {repositoryId: repository.repositoryId})
                      }
                  ]
                : []),
            // a tab the caller may not use is absent: Settings is a Maintainer's
            ...(holds(found.capabilities?.role, "maintainer")
                ? [{label: "Settings", href: u.section("settings"), current: word === "settings"}]
                : [])
        ]
    }
}
/* The branches and tags of the ref picker (a GET form; the Files page redirects its choice to the tree's address). */
function refChoices(shell) {
    const found = maybe("findRefs", {
        siteId: shell.siteId,
        repositoryId: shell.repository.repositoryId,
        namesOnly: true,
        limit: 100
    })
    const list = found?.refList || []
    return {
        branches: list.filter(r => r.refType === "branch").map(r => r.name),
        tags: list.filter(r => r.refType === "tag").map(r => r.name)
    }
}
/* Rendered Markdown's relative links and images, made to work on the page: a link to the file's page (-/blob/<ref>/<path>,
 * or the tree for a path that ends in a slash) and an image to its raw file (-/raw/<ref>/<path>), each resolved against
 * directory, the file's directory at the shown ref. A link with a scheme, a protocol-relative one and an anchor are left
 * alone; one that would leave the repository's tree (.. above its root) loses its address. html is the authority's cleaned
 * markup. */
function rewriteLinks(html, u, ref, directory) {
    const unescape = text =>
        text
            .replace(/&quot;/g, '"')
            .replace(/&#39;|&#x27;/gi, "'")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&")
    const resolve = target => {
        const parts = target.startsWith("/")
            ? []
            : String(directory || "")
                  .split("/")
                  .filter(Boolean)
        for (const part of target.split("/")) {
            if (part === "" || part === ".") continue
            if (part === "..") {
                if (!parts.length) return null
                parts.pop()
            } else {
                let name = part
                try {
                    name = decodeURIComponent(part)
                } catch (error) {
                    // kept as written
                }
                if (name === "." || name === ".." || name.includes("/")) return null
                parts.push(name)
            }
        }
        return parts.join("/")
    }
    return String(html || "").replace(/<(a|img)\b([^>]*?)\s(href|src)="([^"]*)"/gi, (whole, tag, before, attribute, value) => {
        const isImage = tag.toLowerCase() === "img"
        if ((attribute.toLowerCase() === "src") !== isImage) return whole
        const target = unescape(value).trim()
        if (!target || target.startsWith("#") || target.startsWith("//") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)) return whole
        const cut = target.search(/[?#]/)
        const path = resolve(cut < 0 ? target : target.slice(0, cut))
        const rest = cut < 0 ? "" : target.slice(cut)
        const address =
            path == null
                ? "#"
                : isImage
                  ? u.raw(ref, path)
                  : (!path || /\/$/.test(cut < 0 ? target : target.slice(0, cut)) ? u.tree(ref, path) : u.blob(ref, path)) +
                    (rest.startsWith("#") ? rest : "")
        return "<" + tag + before + " " + attribute + '="' + esc(address) + '"'
    })
}
/* The breadcrumb of a path in the tree at a ref. */
function pathCrumbs(u, ref, path, repositoryLabel) {
    const parts = String(path || "")
        .split("/")
        .filter(Boolean)
    return [
        {label: repositoryLabel, href: u.tree(ref, "")},
        ...parts.map((part, i) => ({
            label: part,
            href: i === parts.length - 1 ? null : u.tree(ref, parts.slice(0, i + 1).join("/"))
        }))
    ]
}
/* Files (design §7): the tree at a ref and a path, its last commit and the directory's rendered README; an empty repository's
 * push instructions; {redirect} for the ref picker's choice and for a path that is a file. */
function files(shell, refPath) {
    const u = urls(shell.base, shell.repository.repositoryPath)
    const picked = param("ref")
    if (picked) return {redirect: u.tree(picked, param("path") || "")}
    const offset = /^[0-9]{1,6}$/.test(param("offset") || "") ? Number(param("offset")) : 0
    const tree = need("getTree", {
        siteId: shell.siteId,
        repositoryId: shell.repository.repositoryId,
        refPath: refPath || "",
        ...(offset ? {offset} : {})
    })
    if (tree.empty) return {empty: true}
    if (tree.isFile) return {redirect: u.section("blob", refPath)}
    const ref = refName(tree.ref)
    const treePath = tree.path || ""
    const entries = (tree.entryList || []).map(e => ({
        name: e.name,
        // the framework's entry types: dir, file, executable, link, submodule
        directory: e.type === "dir",
        submodule: e.type === "submodule",
        href: e.type === "dir" ? u.tree(ref, e.path) : e.type === "submodule" ? null : u.blob(ref, e.path),
        size: e.type === "dir" || e.type === "submodule" ? "" : sizeText(e.size),
        summary: e.lastCommit?.summary || "",
        commitHref: e.lastCommit?.commitId ? u.commit(e.lastCommit.commitId) : null,
        date: dateText(e.lastCommit?.authorDate || e.lastCommit?.commitDate)
    }))
    return {
        ref,
        refKind: tree.ref?.kind || "",
        path: treePath,
        choices: refChoices(shell),
        pickerAction: u.section("tree"),
        crumbs: pathCrumbs(u, ref, treePath, shell.repository.slug || shell.repository.name),
        parentHref: treePath ? u.tree(ref, treePath.split("/").slice(0, -1).join("/")) : null,
        entries,
        lastCommit: tree.lastCommit ? commitRow(u, shell.base, tree.lastCommit) : null,
        historyHref: u.commits(ref, treePath),
        // the whole tree at this ref as a file, for a signed-in account (the authority serves no archive to a visitor)
        archives: shell.capabilities.signedIn && !treePath ? archiveLinks(u, ref) : null,
        // the page's own address is built from what was read, never from the request's path
        moreHref: tree.hasMore ? u.tree(ref, treePath) + query({offset: offset + entries.length}) : null,
        readme: tree.readme?.html ? {path: tree.readme.path, html: rewriteLinks(tree.readme.html, u, ref, treePath)} : null
    }
}
/* A text's lines as escaped markup with a number and an anchor each (#L10); no highlighting in DG1. */
function codeHtml(text) {
    const lines = String(text ?? "").split("\n")
    if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop()
    return lines
        .map(
            (line, i) =>
                '<span id="L' +
                (i + 1) +
                '"><a class="n" href="#L' +
                (i + 1) +
                '">' +
                (i + 1) +
                "</a>" +
                esc(line.replace(/\r$/, "")) +
                "</span>"
        )
        .join("\n")
}
const IMAGE = /\.(?:png|jpe?g|gif|webp)$/i
/* Blob (design §7): a file's text with line anchors, rendered Markdown with a Source toggle (?plain=1), an image, or a
 * download link for a binary, LFS or too large file. */
function blob(shell, refPath) {
    const u = urls(shell.base, shell.repository.repositoryPath)
    const plain = param("plain") === "1"
    const found = need("getBlob", {
        siteId: shell.siteId,
        repositoryId: shell.repository.repositoryId,
        refPath,
        ...(plain ? {plain: true} : {})
    })
    const ref = refName(found.ref)
    const filePath = found.path || ""
    const rendered = !plain && !!found.html
    const showText = !rendered && !found.binary && !found.lfs && !found.tooLarge && found.text != null
    return {
        ref,
        path: filePath,
        name: filePath.split("/").pop(),
        size: sizeText(found.size),
        binary: !!found.binary,
        lfs: !!found.lfs,
        tooLarge: !!found.tooLarge,
        image: !!found.binary && !found.lfs && IMAGE.test(filePath),
        html: rendered ? rewriteLinks(found.html, u, ref, filePath.split("/").slice(0, -1).join("/")) : null,
        codeHtml: showText ? codeHtml(found.text) : null,
        lineCount: showText ? String(found.text).split("\n").length : 0,
        hasRendered: !!found.html || (plain && /\.(?:md|markdown)$/i.test(filePath)),
        plain,
        sourceHref: u.blob(ref, filePath) + "?plain=1",
        renderedHref: u.blob(ref, filePath),
        crumbs: pathCrumbs(u, ref, filePath, shell.repository.slug || shell.repository.name),
        rawHref: u.raw(ref, filePath),
        // each line's commit, for a file shown as text
        blameHref: !found.binary && !found.lfs && !found.tooLarge ? u.blame(ref, filePath) : null,
        historyHref: u.commits(ref, filePath),
        permalink: found.ref?.commitId ? u.blob(found.ref.commitId, filePath) : null,
        lastCommit: found.lastCommit ? commitRow(u, shell.base, found.lastCommit) : null
    }
}
/* The downloads of the tree at a ref (design §7): a zip and a tar.gz. */
const archiveLinks = (u, ref) => [
    {label: "zip", href: u.archive(ref, "zip")},
    {label: "tar.gz", href: u.archive(ref, "tar.gz")}
]
/* Blame (design §7): a file's lines, each run of them with the commit that last changed it (getBlame's hunks). A file that
 * has no blame (binary, in Git LFS, too large, a history past the limit) shows the refusal's text. */
function blame(shell, refPath) {
    const u = urls(shell.base, shell.repository.repositoryPath)
    const found = portal.attempt("getBlame", {siteId: shell.siteId, repositoryId: shell.repository.repositoryId, refPath})
    if (found.error) {
        if (!["Unprocessable", "Conflict"].includes(found.error.kind))
            fail(found.error.kind === "NotFound" ? "NotFound" : found.error.kind, found.error.message)
        // the file is there (the refusal is of its blame): the page says why, with the way back to the file
        return {failure: found.error.message, fileHref: u.section("blob", refPath), lines: [], crumbs: []}
    }
    const b = found.result
    const ref = refName(b.ref)
    const filePath = b.path || ""
    const texts = String(b.text ?? "").split("\n")
    if (texts.length > 1 && texts[texts.length - 1] === "") texts.pop()
    const starts = new Map((b.hunkList || []).map(hunk => [Number(hunk.startLine), hunk]))
    return {
        failure: null,
        ref,
        path: filePath,
        name: filePath.split("/").pop(),
        crumbs: pathCrumbs(u, ref, filePath, shell.repository.slug || shell.repository.name),
        fileHref: u.blob(ref, filePath),
        historyHref: u.commits(ref, filePath),
        // a line that starts a run carries the run's commit
        lines: texts.map((line, i) => {
            const hunk = starts.get(i + 1)
            return {
                number: i + 1,
                text: line.replace(/\r$/, ""),
                commit: hunk
                    ? {
                          shortId: shortId(hunk.commitId),
                          href: u.commit(hunk.commitId),
                          summary: hunk.summary || "",
                          authorName: hunk.authorName || "",
                          date: dateText(hunk.date)
                      }
                    : null
            }
        })
    }
}
/* archive (design §7): the tree at a branch, a tag or a commit as a zip or a tar.gz (downloadArchive), streamed by the
 * facade as PASS's other downloads are, as an attachment with a safe name and never kept by a cache. The authority serves it
 * to a signed-in account: a visitor who may view the repository is sent to sign in, and one who may not gets Not Found. */
function archive(siteId, repositoryId, ref, format, base, accountBase) {
    const repository = need("getRepository", {siteId, repositoryId}).repository
    const u = urls(base, repository.repositoryPath)
    if (!["zip", "tar.gz"].includes(format) || !ref) fail()
    if (!ec.user.userId)
        return redirect((accountBase ?? "/account") + "/Login?returnTo=" + encodeURIComponent(u.archive(ref, format)))
    // the headers go before the body: an attachment with a safe name, never kept by a cache
    const name = (repository.slug || "repository") + "-" + String(ref).replace(/[^A-Za-z0-9._-]+/g, "-") + "." + format
    try {
        ec.resource
            .script("component://mr-pass/service/pass/Facade.js")
            .downloadFile(
                siteId,
                "downloadArchive",
                {repositoryId, refPath: ref, format},
                {disposition: disposition(false, name), streamed: true}
            )
    } catch (error) {
        ec.message.clearErrors()
        // what is not there (a ref the repository does not have) and what is refused (a tree too large) are both no file
        fail(
            error.moquiErrorKind === "NotFound" ? "NotFound" : error.moquiErrorKind || "NotFound",
            portal.refusal(error.message).text
        )
    }
}
/* The Content-Disposition of a file: an ASCII fallback name and the name itself, percent-encoded (RFC 6266), with no
 * control character, quote or backslash in either. */
function disposition(inline, filename) {
    // eslint-disable-next-line no-control-regex
    const name = String(filename || "").replace(/[\u0000-\u001f\u007f-\u009f]/g, "") || "file"
    const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\%]/g, "_")
    const encoded = encodeURIComponent(name).replace(/['()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    return (inline ? "inline" : "attachment") + '; filename="' + ascii + "\"; filename*=UTF-8''" + encoded
}
/* Raw (design §7): the file downloadBlob answers ({file: {filename, mimeType}, text or bytes}) as text/plain, a still image
 * or an octet stream, never as a page of the site: nosniff, a sandboxing CSP, and an attachment for anything but plain text
 * and those images. */
function raw(siteId, repositoryId, refPath) {
    const result = need("downloadBlob", {siteId, repositoryId, refPath})
    const file = result.file
    const content = result.bytes ?? result.text
    if (!file || content == null) fail()
    const declared = String(file.mimeType || "")
        .split(";")[0]
        .trim()
        .toLowerCase()
    const inline = declared === "text/plain" || /^image\/(?:png|jpeg|gif|webp)$/.test(declared)
    const response = ec.web.response
    response.setContentType(
        inline ? (declared === "text/plain" ? "text/plain; charset=utf-8" : declared) : "application/octet-stream"
    )
    response.setHeader("X-Content-Type-Options", "nosniff")
    response.setHeader("Content-Security-Policy", "default-src 'none'; sandbox")
    response.setHeader("Content-Disposition", disposition(inline, file.filename))
    response.write(content)
}
/* Commits (design §7): the history of a ref, or of a path at a ref, by day, 30 to a page (Older by the last commit's id). */
function commits(shell, refPath) {
    const u = urls(shell.base, shell.repository.repositoryPath)
    const after = /^[0-9a-f]{7,40}$/.test(param("after") || "") ? param("after") : null
    const found = need("findCommits", {
        siteId: shell.siteId,
        repositoryId: shell.repository.repositoryId,
        refPath: refPath || "",
        limit: 30,
        ...(after ? {afterCommitId: after} : {})
    })
    const rows = (found.commitList || []).map(c => commitRow(u, shell.base, c))
    const days = []
    for (const row of rows) {
        const day = days[days.length - 1]
        if (day && day.date === row.date) day.commits.push(row)
        else days.push({date: row.date, commits: [row]})
    }
    const ref = refName(found.ref)
    const self = ref ? u.commits(ref, found.path || "") : u.section("commits")
    return {
        ref,
        path: found.path || "",
        days,
        treeHref: ref ? u.tree(ref, found.path || "") : u.root,
        newestHref: after ? self : null,
        olderHref: found.hasMore && rows.length ? self + query({after: rows[rows.length - 1].commitId}) : null
    }
}
/* Branches and Tags (design §7): the refs of one kind; a branch with its distance from the default branch and Compare. */
function refs(shell, refType) {
    const path = urls(shell.base, shell.repository.repositoryPath).section(refType === "branch" ? "branches" : "tags")
    const u = urls(shell.base, shell.repository.repositoryPath)
    const cursor = param("cursor")
    const found = need("findRefs", {
        siteId: shell.siteId,
        repositoryId: shell.repository.repositoryId,
        refType,
        limit: 30,
        ...(cursor ? {cursor} : {})
    })
    const defaultBranch = found.defaultBranch || shell.repository.defaultBranch || ""
    const rows = (found.refList || []).map(r => ({
        name: r.name,
        href: u.tree(r.name, ""),
        isDefault: refType === "branch" && r.name === defaultBranch,
        protected: !!r.protected,
        shortId: shortId(r.commitId),
        commitHref: r.commitId ? u.commit(r.commitId) : null,
        summary: r.summary || "",
        date: dateText(r.date),
        ahead: r.aheadBy,
        behind: r.behindBy,
        compareHref: refType === "branch" && defaultBranch && r.name !== defaultBranch ? u.compare(defaultBranch, r.name) : null,
        archives: refType === "tag" && shell.capabilities.signedIn ? archiveLinks(u, r.name) : null
    }))
    // the default branch first
    rows.sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
    return {rows, path, defaultBranch, moreHref: found.nextCursor ? path + query({cursor: found.nextCursor}) : null}
}
/* A unified diff's lines as escaped markup, each marked added, deleted or a hunk header. */
function diffHtml(unifiedDiff) {
    const lines = String(unifiedDiff ?? "").split("\n")
    if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop()
    return lines
        .map(line => {
            const mark = line.startsWith("@@")
                ? "h"
                : line.startsWith("+") && !line.startsWith("+++")
                  ? "a"
                  : line.startsWith("-") && !line.startsWith("---")
                    ? "d"
                    : ""
            return mark ? '<span class="' + mark + '">' + esc(line) + "</span>" : esc(line)
        })
        .join("\n")
}
/* The changed files of a commit or a comparison, each with its counts and its diff as unified text. */
function changedFiles(fileList, fileDiffList) {
    const diffs = new Map((fileDiffList || []).map(d => [d.path, d]))
    return (fileList || []).map((f, i) => {
        const diff = diffs.get(f.path)
        const text = diff?.unifiedDiff ?? diff?.diff ?? null
        return {
            anchor: "file-" + (i + 1),
            path: f.path,
            oldPath: f.oldPath && f.oldPath !== f.path ? f.oldPath : null,
            status: f.status || f.changeType || "",
            insertions: Number(f.insertions) || 0,
            deletions: Number(f.deletions) || 0,
            binary: !!f.binary,
            diffHtml: text != null && text !== "" ? diffHtml(text) : null
        }
    })
}
/* CommitDetail (design §7): the message, author and committer, parents, the refs that contain it, its statuses, the file list
 * with counts and the diff, rendered here as unified text. */
function commit(shell, commitId) {
    const u = urls(shell.base, shell.repository.repositoryPath)
    const found = need("getCommit", {siteId: shell.siteId, repositoryId: shell.repository.repositoryId, commitId})
    const c = found.commit
    const message = String(c.message || c.summary || "")
    const body = message.includes("\n") ? message.slice(message.indexOf("\n") + 1).replace(/^\n+/, "") : ""
    return {
        ...commitRow(u, shell.base, c),
        body,
        committerName: c.committerName && c.committerName !== c.authorName ? c.committerName : null,
        commitDate: dateText(c.commitDate),
        parents: (c.parentIds || []).map(id => ({shortId: shortId(id), href: u.commit(id)})),
        browseHref: u.tree(c.commitId, ""),
        statuses: (found.statusList || []).map(s => ({
            context: s.context || "default",
            state: s.state || "",
            description: s.description || "",
            href: /^https:\/\//.test(String(s.targetUrl || "")) ? s.targetUrl : null
        })),
        // the issues it names that the caller may see; one the caller may not see is in the count alone
        issues: (found.linkedIssues || (c.issueNumbers || []).map(issueNumber => ({issueNumber}))).map(issue => ({
            number: issue.issueNumber,
            title: issue.title || "",
            closed: issue.state === "closed",
            href: u.section("issues") + "/" + encodeURIComponent(issue.issueNumber)
        })),
        hiddenItemCount: Number(found.hiddenItemCount) || 0,
        insertions: Number(found.insertions) || 0,
        deletions: Number(found.deletions) || 0,
        truncated: !!found.truncated,
        files: changedFiles(found.fileList, found.fileDiffList)
    }
}
/* Compare (design §7): two refs, ahead and behind, the commits and the diff; {redirect} for the form's choice. */
function compare(shell, base, head, headRepositoryPath) {
    const u = urls(shell.base, shell.repository.repositoryPath)
    const formBase = param("from")
    const formHead = param("to")
    if (formHead) return {redirect: formBase ? u.compare(formBase, formHead) : u.section("compare", formHead)}
    const headText = (headRepositoryPath ? headRepositoryPath + ":" : "") + (head || "")
    const view = {
        action: u.section("compare"),
        base: base || shell.repository.defaultBranch || "",
        head: headText,
        result: null,
        failure: null
    }
    if (!head) return view
    const found = portal.attempt("getCompare", {
        siteId: shell.siteId,
        repositoryId: shell.repository.repositoryId,
        head,
        withDiffs: true,
        // the page says whether it merges cleanly
        checkMergeable: true,
        ...(base ? {base} : {}),
        ...(headRepositoryPath ? {headRepositoryPath} : {})
    })
    if (found.error) {
        // the repository is viewable (the shell read it); a ref it does not have is said on the page
        view.failure =
            found.error.kind === "NotFound"
                ? "One of these branches, tags or commits was not found in this repository."
                : found.error.message
        return view
    }
    const r = found.result
    view.result = {
        aheadBy: Number(r.aheadBy) || 0,
        behindBy: Number(r.behindBy) || 0,
        mergeable: r.mergeable,
        conflictPaths: r.conflictPaths || [],
        commits: (r.commitList || []).map(c => commitRow(u, shell.base, c)),
        commitsTruncated: !!r.commitsTruncated,
        insertions: Number(r.insertions) || 0,
        deletions: Number(r.deletions) || 0,
        files: changedFiles(r.fileList, r.fileDiffList)
    }
    return view
}
/* Whether a location is a path on this site: one leading slash, and no backslash or control character (a browser reads
 * //host and /\host as another host). */
// eslint-disable-next-line no-control-regex
const siteLocal = location => /^\/(?![/\\])[^\\\u0000-\u001f\u007f]*$/.test(String(location || ""))
/* A redirect a page's actions answer before anything renders, never kept by a cache; only to a path on this site. */
function redirect(location, status) {
    if (!siteLocal(location)) fail()
    const response = ec.web.response
    response.setHeader("Cache-Control", "no-store")
    if (status === 301) {
        response.setStatus(301)
        response.setHeader("Location", location)
        response.write("")
    } else response.sendRedirect(location)
}
/* The answer to a form's post (303 See Other), never kept by a cache; only to a path on this site. */
function seeOther(location) {
    if (!siteLocal(location)) fail()
    const response = ec.web.response
    response.setHeader("Cache-Control", "no-store")
    response.setStatus(303)
    response.setHeader("Location", location)
    response.write("")
}
/* The resolver's redirect (Smithy.xml redirect): 301 to its location with the request's query. */
function redirectRoute(location) {
    const asked = ec.web.request.getQueryString?.()
    redirect(String(location || "") + (asked ? "?" + asked : ""), 301)
}
;({
    portal,
    fail,
    need,
    param,
    esc,
    enc,
    query,
    urls,
    dateText,
    sizeText,
    holds,
    setFlash,
    takeFlash,
    expireFlash,
    maybe,
    openIssueCount,
    seeOther,
    codeHtml,
    diffHtml,
    groupShell,
    overview,
    home,
    explore,
    groupRepositories,
    groupMembers,
    account,
    repositoryShell,
    files,
    blob,
    raw,
    blame,
    archive,
    commits,
    refs,
    commit,
    compare,
    redirect,
    redirectRoute,
    siteLocal,
    disposition,
    rewriteLinks
})
