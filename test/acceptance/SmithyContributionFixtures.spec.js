// The data of Smithy's contribution walk (plan/design-smithy.md §19.3; test/acceptance/client/SmithyContribution): on the
// HTTP test community (PASS_HTTP), after SmithyWalkFixtures has mounted Smithy at /code: a public group "contrib" with a
// repository "project" whose AUTHORS.md has both lists and whose contributor agreement is required; its Maintainer; three
// outside accounts with a confirmed address, a handle, a forum state past its first posts (so the post gate does not hold
// their text for review) and no role (one forks, one proposes, one fixes a line of the
// docs); the site lets any confirmed account fork; and the second account's merge request, proposed as the current user of
// Mantle's commitFile with the proposal destination. That is the framework's commit#GitFiles asProposal, which opens the
// merge request exactly as a push to refs/for/main does (docs/interfaces/Git-Hosting.md, Push to review): a client spec is
// a pure client with no git, so no real push is made here. Each record is made once.
const fixtures = () => ec.resource.script("component://mr-pass/test/Smithy/SmithyFixtures.js")
const SITE = "PASS_HTTP"
const AUTHORS =
    "# Authors\n\n## Contributing\n\nSign under both lists, in a commit of your own account:\n\n    - Written in YEAR by NAME - LOGIN\n\n## Copyright Waiver\n\n- Written in 2026 by Kim Keeper - keeper\n\n## Grant of Patent License\n\n- Written in 2026 by Kim Keeper - keeper\n"
spec({
    dependsOn: ["SmithyWalkFixtures"],
    requires: ["git"],
    setupSpec() {
        login("john.doe")
        ec.artifactExecution.disableAuthz()
    },
    cleanupSpec() {
        ec.artifactExecution.enableAuthz()
    }
})
feature("provision the contribution walk: a repository that requires the agreement, its Maintainer, three outside accounts", {
    when() {
        const f = fixtures()
        const find = () => ec.entity.find("mantle.smithy.SmithyRepository").condition({siteId: SITE, repositoryPath: "contrib/project"}).one()
        if (!find()) {
            const groupId = f.group(SITE, "contrib", "public")
            const made = f.repository(SITE, groupId, "project", "public", {
                "README.md": "# Project\n\nA project that takes contributions.\n",
                "AUTHORS.md": AUTHORS,
                "docs/Guide.md": "# Guide\n\nThe frist step is to read this.\n"
            })
            f.account(SITE, "pass.smithy.keeper", {confirmed: true, handle: "keeper", settled: true, role: "SmrMaintainer", groupId})
            for (const name of ["outsider", "pusher", "fixer"]) f.account(SITE, "pass.smithy." + name, {confirmed: true, handle: name, settled: true})
            // any confirmed account forks and makes a repository of its own
            const settings = f.operation("getSmithySettings", {siteId: SITE})
            f.operation("storeSmithySettings", {siteId: SITE, forkCreate: "verified", repositoryCreate: "verified", expectedRevision: settings.revision})
            const agreement = f.operation("getAgreement", {siteId: SITE, repositoryId: made.repositoryId})
            f.operation("setAgreement", {
                siteId: SITE,
                repositoryId: made.repositoryId,
                setting: "required",
                agreementPath: "AUTHORS.md",
                expectedRevision: agreement.revision
            })
            // the second account's merge request, as a push to refs/for/main would open it
            ec.artifactExecution.enableAuthz()
            login("pass.smithy.pusher", "moqui1!!")
            try {
                const context = f.operation("getEditContext", {siteId: SITE, repositoryId: made.repositoryId, refPath: "main/README.md", editAction: "update"})
                f.operation("commitFile", {
                    siteId: SITE,
                    repositoryId: made.repositoryId,
                    branch: "main",
                    action: "update",
                    path: "README.md",
                    content: "# Project\n\nA project that takes contributions, pushed for review.\n",
                    baseBlobId: context.blobId,
                    message: "Say how the README came",
                    destination: "proposal",
                    operationId: "pass-smithy-contribution-push-1"
                })
            } finally {
                login("john.doe")
                ec.artifactExecution.disableAuthz()
            }
        }
        const repository = find()
        return {
            repository,
            agreement: f.operation("getAgreement", {siteId: SITE, repositoryId: repository.repositoryId}),
            pushed: f.operation("findMergeRequests", {siteId: SITE, repositoryId: repository.repositoryId, state: "open"}),
            route: f.route(SITE, "127.0.0.1", "/code/contrib/project/-/merge-requests")
        }
    },
    then({repository, agreement, pushed, route}) {
        repository.repositoryPath === "contrib/project"
        agreement.effective === "required"
        pushed.mergeRequestList.length === 1
        pushed.mergeRequestList[0].pushedForReview === true
        route.screenPath === "/Smithy/RepositoryDetail/MergeRequests"
    }
})
