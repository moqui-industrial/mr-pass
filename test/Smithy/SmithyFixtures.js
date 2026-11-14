/* Smithy's spec fixtures (Dogfood DG1 to DG3): a published site with Smithy mounted at /code, groups, repositories with a commit
 * (Mantle's create#Group and create#Repository, a db repository committed through
 * org.moqui.git.GitServices.commit#GitFiles), public accounts, with a confirmed address and a role when given, a
 * repository's issues turned on and an issue filed (Mantle's update#Repository and create#Issue), and a form's post to its
 * transition of Smithy/Do. CC0 plus patent grant. */
function run(name, parameters) {
    const out = ec.service.sync().name(name).parameters(parameters).disableAuthz().call()
    if (ec.message.hasError()) {
        const text = ec.message.getErrorsString()
        ec.message.clearErrors()
        throw new Error("Smithy fixture " + name + " failed: " + text)
    }
    return out
}
/* A published site whose owner is the current user, with Account and Smithy (at /code) mounted on host. */
function site(siteId, host) {
    run("create#mantle.public.PublicSite", {
        siteId,
        name: "Smithy spec " + siteId,
        state: "published",
        registrationMode: "invitation",
        locale: "en",
        timeZone: "UTC",
        policyRevision: 1,
        generation: 1
    })
    run("create#mantle.public.PublicSiteParty", {
        siteId,
        partyId: ec.user.userAccount.partyId,
        state: "active",
        role: "owner",
        revision: 1
    })
    run("mantle.public.SiteServices.store#Mounts", {
        input: {
            siteId,
            expectedRevision: 1,
            mounts: [
                {app: "account", pathPrefix: "/account"},
                {app: "smithy", pathPrefix: "/code"}
            ],
            hosts: [{hostname: host, canonical: true}]
        }
    })
}
/* A public account that is an active member of the site: its partyId. options.confirmed gives it a confirmed address (design
 * §5.5), options.handle a profile with that handle, options.settled a forum state past its first posts, options.role a role (SmrReporter, ...) on options.groupId or options.repositoryId. */
function account(siteId, username, options) {
    const partyId = run("mantle.party.PartyServices.create#Person", {firstName: username, lastName: "Smithy"}).partyId
    run("mantle.party.PartyServices.create#PartyUserAccount", {
        partyId,
        username,
        emailAddress: username + "@example.test",
        newPassword: "moqui1!!",
        newPasswordVerify: "moqui1!!"
    })
    run("create#mantle.public.PublicSiteParty", {
        siteId,
        partyId,
        state: "active",
        role: "member",
        joinedAt: Date.now(),
        revision: 1
    })
    if (options?.confirmed) {
        const userId = ec.entity.find("moqui.security.UserAccount").condition("username", username).disableAuthz().one().userId
        run("create#moqui.security.public.VerifiedAddress", {
            userId,
            emailAddress: username + "@example.test",
            verifiedAt: ec.user.nowTimestamp
        })
    }
    // a handle is the account's namespace (its own repositories and forks)
    if (options?.handle)
        run("create#mantle.public.PublicSiteProfile", {
            siteId,
            partyId,
            handle: options.handle,
            displayName: username,
            discoverability: "public",
            revision: 1
        })
    // an account whose first posts are past: the post gate neither holds its text as a first one nor asks it to wait
    if (options?.settled)
        run("create#mantle.forum.ForumMemberState", {
            siteId,
            partyId,
            trustLevel: "basic",
            approvedContributions: 5,
            dailyTopics: 0,
            dailyReplies: 0,
            revision: 1
        })
    if (options?.role)
        role(siteId, options.groupId ? {groupId: options.groupId} : {repositoryId: options.repositoryId}, partyId, options.role)
    return partyId
}
/* A role row on a group ({groupId}) or a repository ({repositoryId}). */
function role(siteId, target, partyId, roleEnumId) {
    run("create#mantle.smithy." + (target.groupId ? "SmithyGroupParty" : "SmithyRepositoryParty"), {
        ...target,
        partyId,
        siteId,
        roleEnumId,
        fromDate: Date.now() - 1000,
        revision: 1
    })
}
/* An active group through Mantle's create#Group (the current user, the site's owner, becomes its Owner): its groupId.
 * visibility is public, members or private. */
function group(siteId, pathSegment, visibility, parentGroupId) {
    return run("mantle.smithy.SmithyServices.create#Group", {
        siteId,
        pathSegment,
        name: "Group " + pathSegment,
        description: "The " + pathSegment + " group & more",
        visibility,
        ...(parentGroupId ? {parentGroupId} : {})
    }).groupId
}
/* A db repository of a group through Mantle's create#Repository, with one commit of files when given:
 * {repositoryId, repositoryPath, commitId}. */
function repository(siteId, groupId, slug, visibility, files) {
    const made = run("mantle.smithy.SmithyServices.create#Repository", {siteId, groupId, slug, visibility, repositoryKind: "db"})
    return {
        repositoryId: made.repositoryId,
        repositoryPath: made.repositoryPath,
        commitId: files ? commit(made.repositoryId, "First commit", files) : null
    }
}
function commit(repositoryId, message, fileMap) {
    return run("org.moqui.git.GitServices.commit#GitFiles", {repositoryId, message, fileMap}).commitId
}
/* Turns a repository's issues on, as the current user (a Maintainer of it). */
function issuesOn(siteId, repositoryId) {
    const revision = operation("getRepository", {siteId, repositoryId}).repository.revision
    run("mantle.smithy.SmithyServices.update#Repository", {
        input: {siteId, repositoryId, issuesEnabled: true, expectedRevision: revision}
    })
}
/* An issue the current user files (Mantle's create#Issue), in Markdown: {issueNumber, rootCommEventId, state}. */
function issue(siteId, repositoryId, fields) {
    return run("mantle.smithy.SmithyIssueServices.create#Issue", {
        input: {siteId, repositoryId, sourceFormat: "markdown", operationId: ec.user.randomString(32), ...fields}
    }).result
}
/* Turns the forum of a group ({groupId}) or a repository ({repositoryId}) on, as the current user (its Owner), through the
 * facade's setScopeForum: the scope's category. */
function forumOn(siteId, target) {
    const read = target.groupId
        ? operation("getGroup", {siteId, ...target}).group
        : operation("getRepository", {siteId, ...target}).repository
    const out = operation("setScopeForum", {siteId, ...target, enabled: true, expectedRevision: read.revision})
    if (!out.contactListId) throw new Error("Smithy fixture setScopeForum failed: " + (out.message || "no category"))
    return out.contactListId
}
/* A topic the current user starts in a category (the forum's publishPost), in Markdown: its rootCommEventId. */
function topic(siteId, contactListId, title, body) {
    // the forum asks ten seconds between two posts of an account, and a fixture's posts are not that far apart
    const partyId = ec.user.userAccount.partyId
    if (ec.entity.find("mantle.forum.ForumMemberState").condition({siteId, partyId}).disableAuthz().one())
        run("update#mantle.forum.ForumMemberState", {siteId, partyId, lastPostedAt: null})
    const out = operation("publishPost", {
        siteId,
        contactListId,
        title,
        body,
        sourceFormat: "markdown",
        operationId: ec.user.randomString(32)
    })
    if (!out.rootCommEventId) throw new Error("Smithy fixture publishPost failed: " + (out.message || "no topic"))
    return out.rootCommEventId
}
/* One operation through the facade as the current user: its result, or {kind, message} of its refusal. */
function operation(name, input) {
    try {
        return ec.service.sync().throwOnError(true).name("pass.Facade.call#Operation").parameters({operation: name, input}).call()
            .result
    } catch (error) {
        ec.message.clearErrors()
        return {kind: error.moquiErrorKind || "Error", message: String(error.message).split("\n")[0]}
    }
}
/* One render under Pass.xml of a Smithy page or transition with its route's screen parameters, with request headers when
 * given: {html, errors, status, header(name)}; a refused render has its refusal in errors. */
function render(siteId, host, path, screenPath, parameters, requestHeaders) {
    const test = ec.screen.makeTest().rootScreen("component://mr-pass/screen/Pass.xml")
    for (const [name, value] of Object.entries(requestHeaders || {})) test.header(name, value)
    const rendered = test.render(
        screenPath,
        {resolvedSiteId: siteId, publicHost: host, publicPath: path, ...(parameters || {})},
        null
    )
    return {
        html: String(rendered.output || ""),
        errors: Array.from(rendered.errorMessages || []),
        status: rendered.status,
        header: name => rendered.header(name)
    }
}
/* A form's post to its transition of Smithy/Do, with the session token unless token is false: {status, location, cache,
 * errors} and the flash it left for the next page, taken as that page would unless keep is true (it is then left in the
 * session, for a render of that page). */
function post(siteId, host, name, fields, token, keep) {
    const test = ec.screen.makeTest().rootScreen("component://mr-pass/screen/Pass.xml")
    const rendered = test.render(
        "Smithy/Do/" + name,
        {
            resolvedSiteId: siteId,
            publicHost: host,
            publicPath: "/code/-/do/" + name,
            ...(token === false ? {} : {moquiSessionToken: ec.web.sessionToken}),
            ...fields
        },
        "post"
    )
    return {
        status: rendered.status,
        location: rendered.header("Location"),
        cache: rendered.header("Cache-Control"),
        errors: Array.from(rendered.errorMessages || []),
        flash: keep
            ? JSON.parse(String(ec.web.sessionAttributes.passSmithyFlash || "{}"))
            : ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js").takeFlash()
    }
}
/* The route of a request path on the site: {screenPath, screenParameters}, or {kind} of its refusal. */
function route(siteId, hostname, path) {
    try {
        const out = ec.service
            .sync()
            .throwOnError(true)
            .name("pass.RouteServices.resolve#Route")
            .parameters({siteId, hostname, path})
            .call()
        return {
            screenPath: out.screenPath,
            screenParameters: out.screenParameters || {},
            // a topic or a post of the forum inside a group's or a repository's shell, named as the forum's own are
            topicId: out.topicId || null,
            topicSlug: out.topicSlug || null,
            postId: out.postId || null
        }
    } catch (error) {
        ec.message.clearErrors()
        return {kind: error.moquiErrorKind || "Error", message: String(error.message).split("\n")[0]}
    }
}
;({run, site, account, role, group, repository, commit, issuesOn, issue, forumOn, topic, operation, render, post, route})
