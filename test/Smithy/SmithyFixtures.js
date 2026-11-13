/* Smithy's spec fixtures (Dogfood DG1): a published site with Smithy mounted at /code, groups, repositories with a commit
 * (Mantle's create#Group and create#Repository, a db repository committed through
 * org.moqui.git.GitServices.commit#GitFiles) and public accounts. CC0 plus patent grant. */
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
    run("create#mantle.public.PublicSiteParty", {siteId, partyId: ec.user.userAccount.partyId, state: "active", role: "owner", revision: 1})
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
/* A public account that is an active member of the site: its partyId. */
function account(siteId, username) {
    const partyId = run("mantle.party.PartyServices.create#Person", {firstName: username, lastName: "Smithy"}).partyId
    run("mantle.party.PartyServices.create#PartyUserAccount", {
        partyId,
        username,
        emailAddress: username + "@example.test",
        newPassword: "moqui1!!",
        newPasswordVerify: "moqui1!!"
    })
    run("create#mantle.public.PublicSiteParty", {siteId, partyId, state: "active", role: "member", joinedAt: Date.now(), revision: 1})
    return partyId
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
/* One operation through the facade as the current user: its result, or {kind, message} of its refusal. */
function operation(name, input) {
    try {
        return ec.service.sync().throwOnError(true).name("pass.Facade.call#Operation").parameters({operation: name, input}).call().result
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
    const rendered = test.render(screenPath, {resolvedSiteId: siteId, publicHost: host, publicPath: path, ...(parameters || {})}, null)
    return {
        html: String(rendered.output || ""),
        errors: Array.from(rendered.errorMessages || []),
        status: rendered.status,
        header: name => rendered.header(name)
    }
}
/* The route of a request path on the site: {screenPath, screenParameters}, or {kind} of its refusal. */
function route(siteId, hostname, path) {
    try {
        const out = ec.service.sync().throwOnError(true).name("pass.RouteServices.resolve#Route").parameters({siteId, hostname, path}).call()
        return {screenPath: out.screenPath, screenParameters: out.screenParameters || {}}
    } catch (error) {
        ec.message.clearErrors()
        return {kind: error.moquiErrorKind || "Error", message: String(error.message).split("\n")[0]}
    }
}
;({run, site, account, group, repository, commit, operation, render, route})
