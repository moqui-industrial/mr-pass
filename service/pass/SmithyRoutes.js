/* Smithy's URL grammar (plan/design-smithy.md §4.4), the smithy branch of pass.RouteServices.resolve#Route: the path after
 * the mount's base to a screen path and its screen parameters. parse() is the grammar alone, with the name path's lookup
 * given as a function; route() asks the authority (resolveSmithyPath, which applies the view check, so what the caller may
 * not see is Not Found exactly as a path with no row) and answers Not Found for a screen, or a settings tab, a later phase
 * builds. A redirect
 * (a path not in its stored case, a .git suffix, a renamed path, a compatibility form) is the Smithy/redirect transition
 * with its location. CC0 plus patent grant. */
function fail() {
    const error = new Error("Page not found")
    error.moquiErrorKind = "NotFound"
    throw error
}
const ID = /^[A-Za-z0-9_-]{1,40}$/
const NUM = /^[1-9][0-9]{0,8}$/
const COMMIT = /^[0-9a-fA-F]{7,40}$/
const DO_NAME = /^[a-z][A-Za-z]{1,60}$/
const ISLAND = /^([A-Z][A-Za-z0-9]{0,60})\.(qvue|qvt|qjs)$/
/* §4.2: a group's or subgroup's segment (a handle is always one), and a repository's slug. */
const GROUP_SEGMENT = /^[a-z0-9][a-z0-9_-]{1,38}$/
const SLUG = /^[a-z0-9_][a-z0-9_.-]{0,99}$/
const slugValid = slug => SLUG.test(slug) && !slug.includes("..") && !/(?:\.|\.git|\.lock|\.atom)$/.test(slug)
const SITE_TABS = ["settings", "requests", "quotas", "redirects"]
const GROUP_TABS = ["general", "agreement", "forum", "pipelines", "quota", "import", "delete"]
const REPOSITORY_TABS = [
    "general",
    "members",
    "branch-rules",
    "webhooks",
    "mirrors",
    "pipelines",
    "agreement",
    "forum",
    "archive"
]
/* The screens built so far (DG1, DG2); a path of the grammar that names another screen is Not Found until its phase. A
 * form's path (-/do/<name>) is a transition of Smithy/Do, which has the ones that are built. */
const BUILT = [
    "/Smithy/Home",
    "/Smithy/Explore",
    "/Smithy/New/Group",
    "/Smithy/New/Repository",
    "/Smithy/Site",
    "/Smithy/AccountDetail",
    "/Smithy/GroupDetail/Overview",
    "/Smithy/GroupDetail/Repositories",
    "/Smithy/GroupDetail/Members",
    "/Smithy/GroupDetail/Settings",
    "/Smithy/RepositoryDetail/Files",
    "/Smithy/RepositoryDetail/Blob",
    "/Smithy/RepositoryDetail/raw",
    "/Smithy/RepositoryDetail/Blame",
    "/Smithy/RepositoryDetail/archive",
    "/Smithy/RepositoryDetail/Commits",
    "/Smithy/RepositoryDetail/Branches",
    "/Smithy/RepositoryDetail/Tags",
    "/Smithy/RepositoryDetail/Settings",
    "/Smithy/CommitDetail",
    "/Smithy/Compare",
    "/Smithy/redirect"
]
/* The tabs built so far of each settings screen; another tab of the grammar is Not Found until its phase. */
const BUILT_TABS = {
    "/Smithy/Site": ["settings", "requests", "quotas"],
    "/Smithy/GroupDetail/Settings": ["general", "quota", "delete"],
    "/Smithy/RepositoryDetail/Settings": ["general", "members", "branch-rules", "webhooks", "archive"]
}
const bytes = text => encodeURIComponent(text).replace(/%[0-9A-F]{2}/g, "x").length
/* Step 1: the segments of a path, each percent-decoded once. A segment that is . or .., holds a slash or a control
 * character, or is over 255 bytes, and a path of over 40 segments, are Not Found. */
function segments(path) {
    const parts = String(path || "")
        .split("/")
        .filter(Boolean)
        .map(part => {
            try {
                return decodeURIComponent(part)
            } catch (error) {
                return fail()
            }
        })
    if (parts.length > 40) fail()
    if (parts.some(p => p === "." || p === ".." || p.includes("/") || /[\u0000-\u001f\u007f]/.test(p) || bytes(p) > 255)) fail()
    return parts
}
const one = (rest, pattern) => (rest.length === 1 && pattern.test(rest[0]) ? rest[0] : fail())
const tabOf = (rest, tabs) => (rest.length === 0 ? null : rest.length === 1 && tabs.includes(rest[0]) ? rest[0] : fail())
const page = (screenPath, screenParameters) => ({screenPath, screenParameters: screenParameters || {}})
/* Step 2: the fixed forms, by the first segment; null when the first segment is a name. */
function fixed(parts) {
    const [first, second] = parts
    const exact = (count, screenPath, parameters) => (parts.length === count ? page(screenPath, parameters) : fail())
    if (!parts.length) return page("/Smithy/Home")
    if (first === "explore") return exact(1, "/Smithy/Explore")
    if (first === "search") return exact(1, "/Smithy/Search")
    if (first === "new")
        return second === "group"
            ? exact(2, "/Smithy/New/Group")
            : second === "repository"
              ? exact(2, "/Smithy/New/Repository")
              : fail()
    if (first === "import")
        return parts.length === 1 ? page("/Smithy/Import") : page("/Smithy/Import", {importId: one(parts.slice(1), ID)})
    if (first === "robots.txt") return exact(1, "/Smithy/robots")
    if (first === "sitemap.xml") return exact(1, "/Smithy/sitemap")
    if (first !== "-") return null
    const rest = parts.slice(2)
    if (second === "site") {
        const tab = tabOf(rest, SITE_TABS)
        return page("/Smithy/Site", tab ? {tab} : {})
    }
    if (second === "do") return page("/Smithy/Do/" + one(rest, DO_NAME))
    if (second === "island") {
        const found = rest.length === 1 ? ISLAND.exec(rest[0]) : null
        return found ? page("/Smithy/Islands/" + found[1] + "." + found[2]) : fail()
    }
    return fail()
}
/* compare/<spec>: the segments joined and split at the first "...", the head perhaps <repositoryPath>:<ref> (a fork's ref);
 * with no "..." the spec is the head and the base is the default branch. Neither side is split into a path. */
function compareSpec(rest) {
    const spec = rest.join("/")
    const at = spec.indexOf("...")
    const base = at < 0 ? "" : spec.slice(0, at)
    let head = at < 0 ? spec : spec.slice(at + 3)
    const out = {base, head}
    if (at >= 0 && (!base || !head)) fail()
    const colon = head.indexOf(":")
    if (colon >= 0) {
        out.headRepositoryPath = head.slice(0, colon)
        head = head.slice(colon + 1)
        if (!out.headRepositoryPath || !head) fail()
        out.head = head
    }
    return out
}
/* Step 5 for a group. */
function groupSection(section, parameters) {
    const [word, ...rest] = section
    const exact = screenPath => (rest.length ? fail() : page(screenPath, parameters))
    if (!section.length) return page("/Smithy/GroupDetail/Overview", parameters)
    if (word === "repositories") return exact("/Smithy/GroupDetail/Repositories")
    if (word === "issues") return exact("/Smithy/GroupDetail/Issues")
    if (word === "members") return exact("/Smithy/GroupDetail/Members")
    if (word === "addons.xml") return exact("/Smithy/GroupDetail/addons")
    if (word === "settings") {
        const tab = tabOf(rest, GROUP_TABS)
        return page("/Smithy/GroupDetail/Settings", tab ? {...parameters, tab} : parameters)
    }
    if (word === "forum") return page("/Smithy/GroupDetail/Forum", {...parameters, forumPath: rest.join("/")})
    if (word === "moderation") return page("/Smithy/Moderation", {...parameters, moderationPath: rest.join("/")})
    return fail()
}
/* Step 5 for a repository. refPath is every segment after the section word, a ref name followed by a path in the tree, which
 * the authority's read splits (the resolver does not read git). */
function repositorySection(section, parameters) {
    const [word, ...rest] = section
    const refPath = rest.join("/")
    const R = "/Smithy/RepositoryDetail/"
    const with_ = (screenPath, more) => page(screenPath, {...parameters, ...(more || {})})
    const exact = screenPath => (rest.length ? fail() : with_(screenPath))
    const needRef = (screenPath, more) => (rest.length ? with_(screenPath, {refPath, ...(more || {})}) : fail())
    if (!section.length) return with_(R + "Files", {refPath: ""})
    switch (word) {
        case "tree":
            return with_(R + "Files", {refPath})
        case "blob":
            return needRef(R + "Blob")
        case "raw":
            return needRef(R + "raw")
        case "blame":
            return needRef(R + "Blame")
        case "edit":
        case "new":
        case "upload":
        case "delete":
            return needRef(R + "Edit", {editAction: word})
        case "commits":
            return with_(R + "Commits", {refPath})
        case "commit":
            return with_("/Smithy/CommitDetail", {commitId: one(rest, COMMIT).toLowerCase()})
        case "compare":
            return with_("/Smithy/Compare", rest.length ? compareSpec(rest) : {base: "", head: ""})
        case "branches":
            return exact(R + "Branches")
        case "tags":
            return exact(R + "Tags")
        case "archive": {
            // a transition of RepositoryDetail, as raw is; the part before the format is a ref only, never a path
            const found = /^(.+?)\.(zip|tar\.gz)$/.exec(refPath)
            return found ? with_(R + "archive", {ref: found[1], format: found[2]}) : fail()
        }
        case "issues":
            if (!rest.length) return with_(R + "Issues")
            if (rest.length === 1 && rest[0] === "new") return with_("/Smithy/NewIssue")
            return with_("/Smithy/IssueDetail", {issueNumber: one(rest, NUM)})
        case "labels":
            return exact(R + "Labels")
        case "milestones":
            return rest.length ? with_(R + "Milestones", {milestoneId: one(rest, ID)}) : with_(R + "Milestones")
        case "merge-requests": {
            if (!rest.length) return with_(R + "MergeRequests")
            if (rest.length === 1 && rest[0] === "new") return with_("/Smithy/NewMergeRequest")
            if (!NUM.test(rest[0]) || rest.length > 2) fail()
            const tab = rest.length === 1 ? "Overview" : {commits: "Commits", changes: "Changes", checks: "Checks"}[rest[1]]
            return tab ? with_("/Smithy/MergeRequestDetail/" + tab, {mergeRequestNum: rest[0]}) : fail()
        }
        case "fork":
        case "forks":
            return exact(R + "Fork")
        case "pipelines":
            if (!rest.length) return with_(R + "Pipelines")
            if (!NUM.test(rest[0])) fail()
            if (rest.length === 1) return with_("/Smithy/PipelineDetail", {runNum: rest[0]})
            return rest.length === 3 && rest[1] === "jobs" && ID.test(rest[2])
                ? with_("/Smithy/PipelineDetail", {runNum: rest[0], jobRunId: rest[2]})
                : fail()
        case "releases":
            return rest.length ? with_("/Smithy/ReleaseDetail", {tag: refPath}) : with_(R + "Releases")
        case "release-assets":
            return rest.length === 2 && ID.test(rest[0]) ? with_("/Smithy/ReleaseDetail/asset", {assetId: rest[0]}) : fail()
        case "artifacts":
            return rest.length === 2 && ID.test(rest[0])
                ? with_("/Smithy/PipelineDetail/artifact", {artifactId: rest[0]})
                : fail()
        case "docs":
            return with_(R + "Docs", {refPath})
        case "forum":
            return with_(R + "Forum", {forumPath: refPath})
        case "moderation":
            return with_("/Smithy/Moderation", {moderationPath: refPath})
        case "settings": {
            const tab = tabOf(rest, REPOSITORY_TABS)
            return with_(R + "Settings", tab ? {tab} : {})
        }
        default:
            return fail()
    }
}
const encodePath = path =>
    String(path || "")
        .split("/")
        .map(encodeURIComponent)
        .join("/")
/* The grammar: suffix is the path after the mount's base, base the mount's base path ("" at /), resolve(namePath) the
 * authority's answer for a name path as typed ({kind, groupId, repositoryId, handle, canonicalPath, redirectPath}, or null). */
function parse(suffix, base, resolve) {
    const parts = segments(suffix)
    // one address a page: an empty segment (//group, a trailing slash) redirects to the path without it, so no page is
    // served at an address whose links would read as another host's
    const given = String(suffix || "").split("/")
    if (given.length > 2 && given.slice(1).some(part => part === ""))
        return page("/Smithy/redirect", {location: (base || "") + "/" + given.filter(Boolean).join("/")})
    const fixedForm = fixed(parts)
    if (fixedForm) return fixedForm
    // Step 3: the name segments before the first segment that is exactly "-", the section segments after it. Only the name
    // prefix is validated and lowered; what follows it is kept as it came (a file's path, a ref)
    const dash = parts.indexOf("-")
    const names = dash < 0 ? parts.slice() : parts.slice(0, dash)
    const section = dash < 0 ? [] : parts.slice(dash + 1)
    if (dash >= 0 && !section.length) fail()
    if (!names.length) fail()
    const nameValid = (name, i, count) => GROUP_SEGMENT.test(name) || (i === count - 1 && i > 0 && slugValid(name))
    const allNames = list => list.length <= 5 && list.every((name, i) => nameValid(name.toLowerCase(), i, list.length))
    // Step 4: the authority tells a repository, a group and an account apart, and names a redirect; it has checked that the
    // caller may view the target before it answers anything, so a redirect never tells of what the caller may not see. The
    // path goes as typed: the authority lowers the name prefix itself and keeps the case of what follows it
    const tail = section.length ? "/-/" + encodePath(section.join("/")) : ""
    const redirect = path => page("/Smithy/redirect", {location: (base || "") + "/" + encodePath(path) + tail})
    // a clone address typed as a page's (<group>/<repository>.git): when the names without the suffix are a repository or a
    // group the page redirects there; else the path is read as it came (a file x.git of a form GitHub has)
    const last = names[names.length - 1]
    if (/\.git$/i.test(last) && last.length > 4) {
        const stripped = names.slice(0, -1).concat(last.slice(0, -4))
        const bare = allNames(stripped) ? resolve(stripped.join("/")) : null
        if (bare && ["repository", "group"].includes(bare.kind) && bare.canonicalPath) return redirect(bare.canonicalPath)
    }
    const named = allNames(names)
    // with no section a path may be a form GitHub has (<group>/<repository>/blob/main/docs/README.md), which the authority
    // finds (the longest prefix that is a repository) and only a redirect answers; a path that is not all names can be
    // nothing else, and its group and repository at least are names
    if (!named) {
        const lowered = names.map(name => name.toLowerCase())
        if (
            dash >= 0 ||
            names.length < 3 ||
            !GROUP_SEGMENT.test(lowered[0]) ||
            !(GROUP_SEGMENT.test(lowered[1]) || slugValid(lowered[1]))
        )
            fail()
    }
    const found = resolve(names.join("/"))
    if (!found || !found.kind) fail()
    if (found.kind === "redirect") return found.redirectPath ? redirect(found.redirectPath) : fail()
    if (!named) fail()
    const canonical = String(found.canonicalPath || names.join("/").toLowerCase())
    if (names.join("/") !== canonical) return redirect(canonical)
    if (found.kind === "group") return groupSection(section, {groupId: found.groupId, namePath: canonical})
    if (found.kind === "account")
        return section.length ? fail() : page("/Smithy/AccountDetail", {handle: found.handle || canonical})
    if (found.kind === "repository") return repositorySection(section, {repositoryId: found.repositoryId, namePath: canonical})
    return fail()
}
/* The route of a request in a Smithy mount: the grammar with the authority's lookup through the facade. */
function route(siteId, suffix, base) {
    const resolve = path => {
        try {
            return ec.service
                .sync()
                .throwOnError(true)
                .name("pass.Facade.call#Operation")
                .parameters({operation: "resolveSmithyPath", input: {siteId, path}})
                .call().result
        } catch (error) {
            if (error.moquiErrorKind !== "NotFound") throw error
            ec.message.clearErrors()
            return null
        }
    }
    const out = parse(suffix, base, resolve)
    if (!BUILT.includes(out.screenPath) && !out.screenPath.startsWith("/Smithy/Do/")) fail()
    const tab = out.screenParameters.tab
    if (tab && BUILT_TABS[out.screenPath] && !BUILT_TABS[out.screenPath].includes(tab)) fail()
    return out
}
;({parse, route, segments, BUILT, BUILT_TABS})
