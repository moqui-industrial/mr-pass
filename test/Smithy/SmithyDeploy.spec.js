// Smithy's deploy environments and deployments (Dogfood DG10; plan/design-smithy.md §10 "Deploy environments", §11 Pipelines):
// an environment's target stored through Smithy/Do and shown on the Settings › Pipelines tab through its page function, its
// token in no page, address or flash, after a refusal too; one render of Deployments (the list and Request deploy) and one
// of DeploymentDetail (the steps with the run linked, Approve and Refuse for an approver, Cancel, the authority's message
// escaped); access through the page functions (a Reporter has no Request deploy, a Developer no Approve, an account with no
// role Not Found on a private repository's deployment); and Refuse and Cancel refused through Smithy/Do without their
// confirmation page's answer, Refuse with it. The deployments are rows made here, since a spec cannot play the engine's
// runner; the routes are in Smithy's spec, and Mantle's SmithyDeployments covers the rules behind the operations.
const fixtures = () => ec.resource.script("component://mr-pass/test/Smithy/SmithyFixtures.js")
const SITE = "PASS_SMITHY_DEPLOY"
const HOST = "smithy-deploy.example.test"
const DEV = "pass.smd.dev"
const REPORTER = "pass.smd.reporter"
const STRANGER = "pass.smd.stranger"
const TOKEN = "smd-target-token-0123456789abcdef"
const R = "/code/pass-smd/deploy"
const BASES = {smithy: "/code", account: "/account"}
const INFO = {authenticated: true, site: {}, profile: {}}
const s = {}
const as = (username, work) => {
    login(username, "moqui1!!")
    try {
        return work()
    } finally {
        login("john.doe")
    }
}
const scripts = () => ({
    smithy: ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js"),
    pipelines: ec.resource.script("component://mr-pass/screen/Smithy/SmithyPipelines.js")
})
/* A page function's html, or the kind of its refusal. */
const pageOf = work => {
    try {
        return work().html
    } catch (error) {
        ec.message.clearErrors()
        return "refused:" + (error.moquiErrorKind || String(error.message))
    }
}
/* Rows written in a transaction of their own, so the engine's moves (each in its own) read them. */
const committed = work => ec.transaction.runRequireNew(null, "Smithy deploy spec rows", work)
const userIdOf = username => ec.entity.find("moqui.security.UserAccount").condition("username", username).disableAuthz().one().userId
spec({
    requires: ["git"],
    setupSpec() {
        login("john.doe")
        const f = fixtures()
        f.site(SITE, HOST)
        s.group = f.group(SITE, "pass-smd", "public")
        const made = f.repository(SITE, s.group, "deploy", "private", {"README.md": "# Deploy sample\n"})
        s.repo = made.repositoryId
        s.commit = made.commitId
        f.run("update#mantle.smithy.SmithyRepository", {repositoryId: s.repo, pipelinesEnabled: "Y"})
        f.account(SITE, DEV, {confirmed: true, handle: "smddev", role: "SmrDeveloper", repositoryId: s.repo})
        f.account(SITE, REPORTER, {confirmed: true, role: "SmrReporter", repositoryId: s.repo})
        f.account(SITE, STRANGER, {confirmed: true})
    },
    cleanup() {
        login("john.doe")
    }
})
feature("an environment's target is stored through Do and listed on Settings › Pipelines; its token is in no page, address or flash, after a refusal too", {
    when() {
        const f = fixtures()
        const {smithy, pipelines} = scripts()
        const tab = R + "/-/settings/pipelines"
        const stored = f.post(SITE, HOST, "storeCiEnvironment", {
            repositoryId: s.repo,
            environmentId: "",
            name: "demo",
            allowedRefs: "main",
            was_allowedRefs: "",
            approvalRequired: "true",
            targetUrl: "https://deploy.smd.example.com",
            was_targetUrl: "",
            token: TOKEN,
            requiredPipeline: "deploy",
            was_requiredPipeline: "",
            dataTypes: "seed, demo",
            was_dataTypes: "",
            cloneUrl: "",
            was_cloneUrl: "",
            operationId: ec.user.randomString(32),
            returnTo: tab
        })
        // refused (a name with a space), with a user part in the target's address: neither the token nor the user part kept
        const refused = f.post(SITE, HOST, "storeCiEnvironment", {
            repositoryId: s.repo,
            environmentId: "",
            name: "bad name!",
            targetUrl: "https://someone:pw@deploy.smd.example.com",
            token: TOKEN,
            operationId: ec.user.randomString(32),
            returnTo: tab
        })
        const listed = f.operation("findCiEnvironments", {siteId: SITE, repositoryId: s.repo})
        s.environmentId = (listed.environmentList || []).find(env => env.name === "demo")?.environmentId
        const html = pipelines.repositorySettings(smithy.repositoryShell(SITE, s.repo, "/code", tab), "", BASES, INFO, tab).html
        // a delete without its confirmation page's answer is not run
        const unasked = f.post(SITE, HOST, "deleteCiEnvironment", {repositoryId: s.repo, environmentId: s.environmentId, returnTo: tab})
        return {stored, refused, html, unasked, environmentId: s.environmentId}
    },
    then({stored, refused, html, unasked, environmentId}) {
        stored.status === 303
        stored.location === R + "/-/settings/pipelines"
        stored.flash.notice === "The environment was saved."
        !JSON.stringify(stored).includes(TOKEN)
        typeof environmentId === "string"
        refused.status === 303
        !!refused.flash.error
        refused.flash.values.name === "bad name!"
        !Object.hasOwn(refused.flash.values, "token")
        refused.flash.values.targetUrl === "https://deploy.smd.example.com"
        !JSON.stringify(refused).includes(TOKEN)
        !JSON.stringify(refused).includes("someone:pw")
        // the list: the target, the token set but not shown, the pipeline, the approval; the edit form's token field empty
        html.includes('id="SmithyEnvironment_' + environmentId + '"')
        html.includes("<dd>https://deploy.smd.example.com</dd>")
        html.includes("<dd>Set (not shown)</dd>")
        html.includes("<dd>deploy</dd>")
        html.includes("<dd>Every deployment waits for a Maintainer&#39;s approval</dd>")
        html.includes("<dt>Data types</dt><dd>seed, demo</dd>")
        html.includes('name="was_dataTypes" value="seed, demo"')
        html.includes('<input type="password" name="token" maxlength="4096" autocomplete="new-password">')
        html.includes("It has a token, which is not shown. Leave this empty to keep it.")
        html.includes('name="was_targetUrl" value="https://deploy.smd.example.com"')
        !html.includes(TOKEN)
        !html.includes("pproverGroup")
        unasked.flash.error.message === "Confirm this change on its own page first."
    }
})
feature("Deployments lists a repository's deployments with Request deploy for who may deploy; a Reporter has none", {
    when() {
        const {smithy, pipelines} = scripts()
        const now = ec.user.nowTimestamp
        s.deploymentId = "PSMD_DEP1"
        committed(() => {
            ec.service.sync().name("create#moqui.resource.GitPipelineRun").parameters({pipelineRunId: "PSMD_RUN5", repositoryId: s.repo, runNum: 5, pipelineName: "deploy", definitionSource: "file", event: "deploy", refName: "refs/heads/main", commitId: s.commit, trusted: "Y", statusId: "success", createdDate: now}).disableAuthz().call()
            ec.service.sync().name("create#moqui.resource.GitDeployment").parameters({
                deploymentId: s.deploymentId,
                repositoryId: s.repo,
                environmentId: s.environmentId,
                environmentName: "demo",
                commitId: s.commit,
                refName: "refs/heads/main",
                pipelineRunId: "PSMD_RUN5",
                statusId: "waiting-approval",
                approvalRequired: "Y",
                requestedByUserId: userIdOf(DEV),
                errorText: "<script>alert(1)</script> waits",
                createdDate: now
            }).disableAuthz().call()
        })
        const page = fixtures().render(SITE, HOST, R + "/-/pipelines/deployments", "Smithy/RepositoryDetail/Deployments", {repositoryId: s.repo, namePath: "pass-smd/deploy"})
        const list = R + "/-/pipelines/deployments"
        const reporter = as(REPORTER, () => pageOf(() => pipelines.deployments(smithy.repositoryShell(SITE, s.repo, "/code", list), BASES, INFO, list)))
        return {page, html: page.html, reporter}
    },
    then({page, html, reporter}) {
        page.errors.length === 0
        page.header("Cache-Control") === "no-store"
        html.includes('aria-current="page">Pipelines</a>')
        html.includes('<a href="' + R + '/-/pipelines/deployments" aria-current="page">Deployments</a>')
        html.includes('<tr id="SmithyDeployment_PSMD_DEP1"><th scope="row"><a href="' + R + '/-/pipelines/deployments/PSMD_DEP1">demo</a></th>')
        html.includes('<a href="' + R + "/-/commit/" + s.commit + '"><code>' + s.commit.slice(0, 8) + "</code></a>")
        html.includes(">Waiting for approval</strong>")
        html.includes("<td>@smddev</td>")
        // Request deploy for the Owner: the environment and a branch
        html.includes('id="Smithy_requestDeploy"')
        html.includes('<option value="' + s.environmentId + '">demo (a Maintainer approves each deployment)</option>')
        html.includes('name="refName" value="main"')
        // a Reporter has no form (and, where the read is a Developer's, no list)
        !reporter.includes("Smithy_requestDeploy")
    }
})
feature("DeploymentDetail shows the steps with the run linked and the approver's forms; a Developer has no Approve, an account with no role Not Found; Refuse and Cancel ask again", {
    when() {
        const f = fixtures()
        const {smithy, pipelines} = scripts()
        const self = R + "/-/pipelines/deployments/" + s.deploymentId
        const page = f.render(SITE, HOST, self, "Smithy/DeploymentDetail", {repositoryId: s.repo, namePath: "pass-smd/deploy", deploymentId: s.deploymentId})
        const detail = () => pageOf(() => pipelines.deploymentPage(smithy.repositoryShell(SITE, s.repo, "/code", self), s.deploymentId, BASES, INFO, self))
        const developer = as(DEV, detail)
        const stranger = as(STRANGER, detail)
        const key = {repositoryId: s.repo, deploymentId: s.deploymentId, returnTo: self}
        const refuseUnasked = f.post(SITE, HOST, "decideDeploy", {...key, decision: "refuse", reason: "Not today"})
        const cancelUnasked = f.post(SITE, HOST, "cancelDeploy", key)
        const before = f.operation("getDeployment", {siteId: SITE, repositoryId: s.repo, deploymentId: s.deploymentId}).deployment?.state
        const refused = f.post(SITE, HOST, "decideDeploy", {...key, decision: "refuse", reason: "Not today", confirm: "yes", returnTo: self + "?confirm=refuse", successTo: self})
        const after = f.operation("getDeployment", {siteId: SITE, repositoryId: s.repo, deploymentId: s.deploymentId}).deployment?.state
        // the steps of a deployment whose deploy step failed
        const failed = pipelines
            .deploySteps({state: "failed", startedAt: 1, approvedBy: "x"}, true)
            .map(step => step.mark)
            .join(" ")
        return {page, html: page.html, developer, stranger, refuseUnasked, cancelUnasked, before, refused, after, failed}
    },
    then({page, html, developer, stranger, refuseUnasked, cancelUnasked, before, refused, after, failed}) {
        page.errors.length === 0
        page.header("Cache-Control") === "no-store"
        html.includes("<h2>Deployment to demo</h2>")
        html.includes('id="SmithyDeploymentState">Waiting for approval</strong>')
        html.includes("asked by @smddev")
        html.includes(`<p id="SmithyDeploymentApproval">Needs a Maintainer's approval.</p>`)
        // the authority's message escaped; the steps, the pipeline passed with its run linked and the approval now
        html.includes("&lt;script&gt;alert(1)&lt;/script&gt; waits")
        !html.includes("<script>alert(1)")
        html.includes('<strong>Waiting for the pipeline</strong> · Passed · <a href="' + R + '/-/pipelines/5" id="SmithyDeploymentRun">run #5</a>')
        html.includes('aria-current="step"><strong>Waiting for approval</strong> · Now')
        // the Owner approves or refuses (asked again), and cancels (asked again)
        html.includes('id="Smithy_decideDeploy_approve"')
        html.includes('<input type="hidden" name="decision" value="approve">')
        html.includes('href="' + R + '/-/pipelines/deployments/PSMD_DEP1?confirm=refuse"')
        html.includes('href="' + R + '/-/pipelines/deployments/PSMD_DEP1?confirm=cancel"')
        // the Developer who asked: no Approve, but Cancel of their own
        !developer.startsWith("refused:")
        !developer.includes("decideDeploy")
        developer.includes("A Maintainer of this repository other than who asked decides it.")
        developer.includes("?confirm=cancel")
        stranger === "refused:NotFound"
        refuseUnasked.flash.error.message === "Confirm this change on its own page first."
        cancelUnasked.flash.error.message === "Confirm this change on its own page first."
        before === "waiting-approval"
        refused.status === 303
        refused.location === R + "/-/pipelines/deployments/PSMD_DEP1"
        refused.flash.notice === "The deployment was refused."
        after === "refused"
        failed === "done done ended ended"
    }
})
