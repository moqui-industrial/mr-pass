// Smithy's deploy environments and deployments (Dogfood DG10; plan/design-smithy.md §10 "Deploy environments", §11 Pipelines):
// an environment's target stored through Smithy/Do and shown on the Settings › Pipelines tab through its page function, its
// token an item of the vault it names (no field takes a token) and an address kept without its user part after a refusal;
// one render of Deployments
// (the list and Request deploy, whose post goes to the new deployment's page) and one of DeploymentDetail (the steps with
// the run linked, the lease of its target's token and Approve in the lease dialog and Refuse for an approver of the
// vault, Cancel, the authority's message escaped, a refusal whose form the page does not show); Approve going on to the
// framework's lease dialog; and Refuse and Cancel refused through Smithy/Do without their confirmation page's answer,
// Refuse with it. The deployment shown is a row made here, since a spec cannot play the engine's runner; the routes are in
// Smithy's spec, and Mantle's SmithyDeployments covers the rules behind the operations (who reads, decides and cancels).
const fixtures = () => ec.resource.script("component://mr-pass/test/Smithy/SmithyFixtures.js")
const SITE = "PASS_SMITHY_DEPLOY"
const HOST = "smithy-deploy.example.test"
const DEV = "pass.smd.dev"
const TOKEN = "smd-target-token-0123456789abcdef"
const VAULT = "PSMD_VAULT"
const R = "/code/pass-smd/deploy"
const BASES = {smithy: "/code", account: "/account"}
const INFO = {authenticated: true, site: {}, profile: {}}
const s = {}
const scripts = () => ({
    smithy: ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js"),
    pipelines: ec.resource.script("component://mr-pass/screen/Smithy/SmithyPipelines.js")
})
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
        // the operational vault of the target's token, john.doe a member of it (its rows, as a member's client leaves them)
        if (!ec.entity.find("moqui.security.vault.Vault").condition("vaultId", VAULT).disableAuthz().one()) {
            f.run("create#moqui.security.vault.Vault", {
                vaultId: VAULT,
                vaultKindEnumId: "VkOperational",
                lockEnumId: "VlSharedKey",
                ownerUserId: ec.user.userId,
                keyVersion: 1,
                revision: 1,
                vaultName: "Deploy tokens"
            })
            f.run("create#moqui.security.vault.VaultMember", {
                vaultId: VAULT,
                userId: ec.user.userId,
                keyVersion: 1,
                roleEnumId: "VrManage",
                fromDate: ec.user.nowTimestamp
            })
        }
    },
    cleanup() {
        login("john.doe")
    },
    cleanupSpec() {
        for (const item of Array.from(
            ec.entity.find("moqui.security.vault.VaultItem").condition("vaultId", VAULT).disableAuthz().list()
        ))
            ec.service
                .sync()
                .name("delete#moqui.security.vault.VaultItem")
                .parameters({vaultItemId: item.vaultItemId})
                .disableAuthz()
                .call()
    }
})
feature("an environment's target is stored through Do and listed on Settings › Pipelines; its token is its vault's, in no page, address or flash", {
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
            vaultId: VAULT,
            was_vaultId: "",
            requiredPipeline: "deploy",
            was_requiredPipeline: "",
            dataTypes: "seed, demo",
            was_dataTypes: "",
            cloneUrl: "",
            was_cloneUrl: "",
            operationId: ec.user.randomString(32),
            returnTo: tab
        })
        // refused (a name with a space), with a user part in the addresses (one with no scheme) and a token, which no field
        // takes: neither the token nor a user part kept
        const refused = f.post(SITE, HOST, "storeCiEnvironment", {
            repositoryId: s.repo,
            environmentId: "",
            name: "bad name!",
            targetUrl: "someone:pw@deploy.smd.example.com",
            cloneUrl: " https://someone:pw@git.smd.example.com/deploy.git",
            token: TOKEN,
            operationId: ec.user.randomString(32),
            returnTo: tab
        })
        const listed = f.operation("findCiEnvironments", {siteId: SITE, repositoryId: s.repo})
        s.environmentId = (listed.environmentList || []).find(env => env.name === "demo")?.environmentId
        // the token, made in the vault by a member's client: the item bound to the environment
        if (s.environmentId)
            committed(() =>
                f.run("create#moqui.security.vault.VaultItem", {
                    vaultItemId: "PSMD_TOKEN",
                    vaultId: VAULT,
                    keyVersion: 1,
                    revision: 1,
                    vaultItemTypeId: "api-key",
                    bindingKey: "GitCiEnvironment:" + s.environmentId + ":targetToken",
                    itemName: "demo target token",
                    bodyCipher: "sealed",
                    createdDate: ec.user.nowTimestamp
                })
            )
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
        refused.flash.values.targetUrl === "deploy.smd.example.com"
        refused.flash.values.cloneUrl === "https://git.smd.example.com/deploy.git"
        !JSON.stringify(refused).includes(TOKEN)
        !JSON.stringify(refused).includes("someone:pw")
        // the list: the target, the token in its vault and not shown, the pipeline, the approval; the edit form names the
        // vault and has no token field
        html.includes('id="SmithyEnvironment_' + environmentId + '"')
        html.includes("<dd>https://deploy.smd.example.com</dd>")
        html.includes("<dd>In its vault (not shown)</dd>")
        html.includes("<dd>deploy</dd>")
        html.includes("<dd>Every deployment waits for a Maintainer&#39;s approval</dd>")
        html.includes("<dt>Data types</dt><dd>seed, demo</dd>")
        html.includes('name="was_dataTypes" value="seed, demo"')
        !html.includes('name="token"')
        html.includes('name="was_vaultId" value="' + VAULT + '"')
        html.includes("The operational vault that holds the target&#39;s token, which is not shown.")
        html.includes('name="was_targetUrl" value="https://deploy.smd.example.com"')
        !html.includes(TOKEN)
        !html.includes("pproverGroup")
        unasked.flash.error.message === "Confirm this change on its own page first."
    }
})
feature("Deployments lists a repository's deployments with Request deploy, which goes to the new deployment's page", {
    when() {
        const f = fixtures()
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
            // runner minutes, so a request is not refused for its quota
            ec.service.sync().name("update#mantle.smithy.SmithyGroup").parameters({groupId: s.group, runnerMinutesMonthly: 1000}).disableAuthz().call()
        })
        const page = f.render(SITE, HOST, R + "/-/pipelines/deployments", "Smithy/RepositoryDetail/Deployments", {repositoryId: s.repo, namePath: "pass-smd/deploy"})
        // the commit has no ci.xml, so the deployment fails at once; it is made all the same, and the form goes to its page
        const list = R + "/-/pipelines/deployments"
        const requested = f.post(SITE, HOST, "requestDeploy", {repositoryId: s.repo, environmentId: s.environmentId, refName: "main", operationId: ec.user.randomString(32), returnTo: list})
        return {page, html: page.html, requested}
    },
    then({page, html, requested}) {
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
        requested.status === 303
        new RegExp("^" + R + "/-/pipelines/deployments/[A-Za-z0-9_-]+$").test(requested.location)
        requested.location !== R + "/-/pipelines/deployments/PSMD_DEP1"
        requested.flash.notice.startsWith("The deployment did not start")
    }
})
feature("DeploymentDetail shows the steps with the run linked, its lease, the approver's forms and a refusal whose form is not on the page; Approve goes on to the lease dialog; Refuse and Cancel ask again", {
    when() {
        const f = fixtures()
        const {pipelines} = scripts()
        const self = R + "/-/pipelines/deployments/" + s.deploymentId
        const key = {repositoryId: s.repo, deploymentId: s.deploymentId, returnTo: self}
        // the lease of its target's token, as the engine asks for it once the pipeline passed; john.doe approves for the
        // vault, so approving the deployment is approving the lease, in the framework's lease dialog
        committed(() => {
            const system = (name, parameters) => ec.service.sync().name(name).parameters(parameters).disableAuthz().call()
            const lease = {leaseId: "PSMD_LEASE", vaultId: VAULT, keyVersion: 1, statusId: "VlsRequested", requestedDate: ec.user.nowTimestamp}
            const known = ec.entity.find("moqui.security.vault.VaultLease").condition("leaseId", "PSMD_LEASE").disableAuthz().one()
            system((known ? "update" : "create") + "#moqui.security.vault.VaultLease", lease)
            const member = {vaultId: VAULT, userId: ec.user.userId, keyVersion: 1, roleEnumId: "VrApprove"}
            system("update#moqui.security.vault.VaultMember", member)
            system("update#moqui.resource.GitDeployment", {deploymentId: s.deploymentId, leaseId: "PSMD_LEASE"})
        })
        const refuseUnasked = f.post(SITE, HOST, "decideDeploy", {...key, decision: "refuse", reason: "Not today"})
        // Cancel without its page's answer, its refusal left for the page, which has no Cancel form of its own
        const cancelUnasked = f.post(SITE, HOST, "cancelDeploy", key, true, true)
        const page = f.render(SITE, HOST, self, "Smithy/DeploymentDetail", {repositoryId: s.repo, namePath: "pass-smd/deploy", deploymentId: s.deploymentId})
        // Approve goes on to the lease dialog, and decides nothing by itself
        const approved = f.post(SITE, HOST, "decideDeploy", {...key, decision: "approve"})
        const before = f.operation("getDeployment", {siteId: SITE, repositoryId: s.repo, deploymentId: s.deploymentId}).deployment?.state
        const refused = f.post(SITE, HOST, "decideDeploy", {...key, decision: "refuse", reason: "Not today", confirm: "yes", returnTo: self + "?confirm=refuse", successTo: self})
        const after = f.operation("getDeployment", {siteId: SITE, repositoryId: s.repo, deploymentId: s.deploymentId}).deployment?.state
        // the steps of a deployment whose deploy step failed
        const failed = pipelines
            .deploySteps({state: "failed", startedAt: 1, approvedBy: "x"}, true)
            .map(step => step.mark)
            .join(" ")
        return {page, html: page.html, refuseUnasked, cancelUnasked, approved, before, refused, after, failed}
    },
    then({page, html, refuseUnasked, cancelUnasked, approved, before, refused, after, failed}) {
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
        // its lease, waiting for an approver of the vault; the Owner, one, approves in the lease dialog or refuses (asked
        // again), and cancels (asked again)
        html.includes(`<p class="wrap" id="SmithyDeploymentLease">Its target's token opens under lease <code>PSMD_LEASE</code>, which waits for an approver of the environment&#39;s vault: `)
        html.includes('id="Smithy_decideDeploy_approve"')
        html.includes('<input type="hidden" name="decision" value="approve">')
        html.includes("<button>Approve in the lease dialog</button>")
        !html.includes("Approve and deploy")
        approved.status === 303
        approved.location === "/qapps/system/Vaults/Lease?leaseId=PSMD_LEASE"
        approved.flash.notice === "The deployment goes on once the lease of its target's token is approved in the lease dialog."
        html.includes('href="' + R + '/-/pipelines/deployments/PSMD_DEP1?confirm=refuse"')
        html.includes('href="' + R + '/-/pipelines/deployments/PSMD_DEP1?confirm=cancel"')
        html.includes('<p role="alert" class="card error" id="Smithy_cancelDeploy_error">Confirm this change on its own page first.</p>')
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
