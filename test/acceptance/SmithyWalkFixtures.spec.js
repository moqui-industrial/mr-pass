// Smithy's golden-path walk's data (plan/design-smithy.md §19.1; test/acceptance/client/SmithyWalk): on the HTTP test community
// (PASS_HTTP, from ClientFixtures), Smithy mounted at /code beside the mounts the other fixtures made, a public group with a
// repository of two files with issues on, and a public account with a confirmed address that is a Maintainer of the group. It runs after
// the fixtures that store the site's mounts, which keep only the mounts they name. DG6: the group's forum is on, with a
// topic in its category, and a second public account with a confirmed address and no role writes in it (an account's own
// posts are ten seconds apart, so the walk's two writers are two accounts). Each record is made once.
const fixtures = () => ec.resource.script("component://mr-pass/test/Smithy/SmithyFixtures.js")
const SITE = "PASS_HTTP"
spec({
    dependsOn: ["ClientFixtures", "PortalFixtures"],
    requires: ["git"],
    setupSpec() {
        login("john.doe")
        ec.artifactExecution.disableAuthz()
    },
    cleanupSpec() {
        ec.artifactExecution.enableAuthz()
    }
})
feature("provision PASS_HTTP's Smithy with a group, a repository and its Maintainer", {
    when() {
        const f = fixtures()
        const mounted = () => ec.entity.find("mantle.public.PublicSiteApp").condition({siteId: SITE, app: "smithy"}).one()
        if (!mounted()) {
            const site = ec.entity.find("mantle.public.PublicSite").condition("siteId", SITE).one()
            const mounts = Array.from(ec.entity.find("mantle.public.PublicSiteApp").condition("siteId", SITE).list()).map(
                row => ({
                    appMountId: row.appMountId,
                    app: row.app,
                    pathPrefix: row.pathPrefix,
                    ...(row.targetId ? {targetId: row.targetId} : {})
                })
            )
            f.run("mantle.public.SiteServices.store#Mounts", {
                input: {
                    siteId: SITE,
                    expectedRevision: Number(site.policyRevision),
                    mounts: [...mounts, {app: "smithy", pathPrefix: "/code"}]
                }
            })
        }
        if (!ec.entity.find("mantle.smithy.SmithyGroup").condition({siteId: SITE, groupPath: "walk"}).one()) {
            const groupId = f.group(SITE, "walk", "public")
            f.repository(SITE, groupId, "guide", "public", {
                "README.md": "# Walk guide\n\nRead me first.\n",
                "src/hello.txt": "hello walker\n"
            })
            f.account(SITE, "pass.smithy.walker", {confirmed: true, role: "SmrMaintainer", groupId})
        }
        // DG3: the guide repository has issues on
        const guide = ec.entity.find("mantle.smithy.SmithyRepository").condition({siteId: SITE, repositoryPath: "walk/guide"}).one()
        if (guide.issuesEnabled !== "Y") f.issuesOn(SITE, guide.repositoryId)
        // DG6: the group's forum on (its Owner, the site's), with one topic in the group's category
        const walk = ec.entity.find("mantle.smithy.SmithyGroup").condition({siteId: SITE, groupPath: "walk"}).one()
        const scope = () => ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js").groupShell(SITE, walk.groupId, "/code", "/code/walk").forumScope
        const category = scope()?.enabled ? scope().contactListId : f.forumOn(SITE, {groupId: walk.groupId})
        const topics = f.operation("findTopics", {siteId: SITE, scopeContactListId: category, limit: 30}).topicList || []
        if (!topics.some(topic => topic.title === "Walk topic")) f.topic(SITE, category, "Walk topic", "Talk about the **guide** here.")
        if (!ec.entity.find("moqui.security.UserAccount").condition("username", "pass.smithy.reader").one())
            f.account(SITE, "pass.smithy.reader", {confirmed: true, settled: true})
        return {
            forum: f.route(SITE, "127.0.0.1", "/code/walk/-/forum"),
            mount: mounted(),
            repository: f.route(SITE, "127.0.0.1", "/code/walk/guide"),
            issues: f.route(SITE, "127.0.0.1", "/code/walk/guide/-/issues")
        }
    },
    then({mount, repository, issues, forum}) {
        forum.screenPath === "/Smithy/GroupDetail/Forum"
        issues.screenPath === "/Smithy/RepositoryDetail/Issues"
        mount.pathPrefix === "/code"
        mount.enabled === "Y"
        repository.screenPath === "/Smithy/RepositoryDetail/Files"
    }
})
