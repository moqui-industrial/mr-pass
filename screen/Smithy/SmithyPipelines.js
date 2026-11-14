/* Smithy's pipeline pages (Dogfood DG5; plan/design-smithy.md §10, §11 Pipelines, §15.6): a repository's Pipelines (its runs,
 * filtered, with Run pipeline), PipelineDetail (a run: its header, the approval it waits for, its jobs by stage; and one job:
 * its steps, its log, its failed tests and its uploads), an upload's download and a job's log as JSON for the log's island,
 * the runs on a merge request's Checks tab, and the Pipelines tab of a repository's and a group's Settings (the runner pools,
 * when outside runs wait, the month's runner minutes; a repository's secrets and environments). Every read is the
 * authority's (Mantle's SmithyPipelines.js through pass.Facade.call#Operation), which decides who reads a run and who moves
 * one; a page leaves out only what would be refused. Pages are plain HTML built as escaped markup (SmithyForms.js h); a job's
 * log is text from a job, so it is shown as escaped lines with its terminal escapes taken out, never as markup. The forms
 * post to Smithy/Do with the session token. Where JavaScript runs, the log's island (Islands/JobLog.qvue) appends a running
 * job's new lines. None of these pages is kept by a cache (Shared/Headers.js). CC0 plus patent grant. */
const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
const forms = ec.resource.script("component://mr-pass/screen/Smithy/SmithyForms.js")
const {portal, fail, need, maybe, param, enc, query, dateText, sizeText, shortId, plain, ANSI, CONTROL} = smithy
const {Markup, h, attributes, hidden, contextOf, gate, formOf, open, input, select, check, submit, hint, confirmCard} = forms

/* A job's or a run's states that are final: nothing more is written to its log. */
const ENDED = ["success", "failure", "error", "cancelled", "skipped"]
const STATE_TEXT = {
    waiting: "Waiting",
    queued: "Queued",
    running: "Running",
    success: "Passed",
    failure: "Failed",
    error: "Error",
    cancelled: "Cancelled",
    skipped: "Skipped",
    pending: "Pending"
}
const stateText = state => STATE_TEXT[state] || state || ""
const EVENTS = [
    ["push", "Push"],
    ["merge-request", "Merge request"],
    ["tag", "Tag"],
    ["schedule", "Schedule"],
    ["manual", "By hand"],
    ["deploy", "Deploy"]
]
const eventText = event => EVENTS.find(([key]) => key === event)?.[1] || event || ""
const RUN_STATES = ["waiting", "queued", "running", "success", "failure", "error", "cancelled"]
/* When an outside run waits for a Maintainer's approval (a group's and the site's setting). */
const APPROVALS = [
    ["first", "A first contribution's runs wait for a Maintainer's approval"],
    ["always", "Every outside run waits for a Maintainer's approval"],
    ["never", "Outside runs start without an approval"]
]
const SCOPES = [
    ["protected", "Protected branches: runs of a branch a branch rule names"],
    ["tags", "Tags: runs of a tag"],
    ["environment", "An environment: runs its rules allow"]
]
const scopeText = scope => ({protected: "protected branches", tags: "tags", environment: "an environment"})[scope] || scope || ""

/* The addresses of a repository's pipeline pages under the mount's base. */
function urlsOf(base, repositoryPath) {
    const u = smithy.urls(base, repositoryPath)
    const list = u.section("pipelines")
    const run = runNum => list + "/" + encodeURIComponent(runNum)
    const job = (runNum, jobRunId) => run(runNum) + "/jobs/" + encodeURIComponent(jobRunId)
    return {
        u,
        list,
        run,
        job,
        log: (runNum, jobRunId) => job(runNum, jobRunId) + "/log",
        artifact: (artifactId, name) =>
            u.section("artifacts") + "/" + encodeURIComponent(artifactId) + "/" + encodeURIComponent(name || "file")
    }
}
/* A repository with pipelines turned off has none of their pages (design §1). */
function requirePipelines(shell) {
    if (!shell.repository.features?.pipelines) fail()
}
/* A whole number of a query parameter, or the fallback. */
const whole = (name, fallback) => (/^[0-9]{1,12}$/.test(param(name) || "") ? Number(param(name)) : fallback)
/* A duration in words: 12 s, 3 min 4 s, 1 h 2 min. */
function durationText(seconds) {
    const n = Number(seconds)
    if (seconds == null || seconds === "" || !Number.isFinite(n) || n < 0) return ""
    if (n < 60) return Math.round(n) + " s"
    if (n < 3600) return Math.floor(n / 60) + " min " + Math.round(n % 60) + " s"
    return Math.floor(n / 3600) + " h " + Math.floor((n % 3600) / 60) + " min"
}
/* A ref as the pages write it: a branch's name, "tag v1" for a tag; plain text. */
function refText(refName) {
    const ref = String(refName || "")
    if (ref.startsWith("refs/heads/")) return plain(ref.slice(11))
    if (ref.startsWith("refs/tags/")) return "tag " + plain(ref.slice(10))
    return plain(ref)
}
/* The words of a run's message without the refusal's code in front (quotaExceeded: ...). */
const messageText = message => plain(String(message || "").replace(/^[a-z][A-Za-z]{2,40}: /, ""))
const chip = (state, id) => h`<strong class="smithy-chip"${attributes({id: id || null})}>${stateText(state)}</strong>`

/* One run as a line of a list: its number and pipeline, its state, and what it ran for. */
function runLine(c, repositoryPath, run, more) {
    const pu = urlsOf(c.base, repositoryPath)
    const facts = [
        eventText(run.event),
        run.mergeRequestNum
            ? h`<a href="${pu.u.section("merge-requests")}/${encodeURIComponent(run.mergeRequestNum)}">!${run.mergeRequestNum}</a>`
            : refText(run.refName),
        run.commitId ? h`<a href="${pu.u.commit(run.commitId)}"><code>${shortId(run.commitId)}</code></a>` : null,
        run.triggeredBy ? "by @" + run.triggeredBy : null,
        dateText(run.createdAt),
        durationText(run.durationSeconds),
        run.jobCount != null ? run.jobCount + (Number(run.jobCount) === 1 ? " job" : " jobs") : null,
        Number(run.failedTestCount)
            ? run.failedTestCount + (Number(run.failedTestCount) === 1 ? " test failed" : " tests failed")
            : null
    ].filter(fact => fact != null && fact !== "")
    return h`<article class="card smithy-row" id="SmithyRun_${run.runNum}"><h3 class="wrap"><a href="${pu.run(run.runNum)}">#${run.runNum} ${plain(run.pipelineName)}</a> ${chip(
        run.state
    )}${run.trusted === false ? h` <small class="smithy-chip">Outside run</small>` : ""}</h3><p><small>${facts.map((fact, i) => h`${i ? " · " : ""}${fact}`)}</small></p>${
        run.message ? h`<p class="wrap"><small>${messageText(run.message)}</small></p>` : ""
    }${more || ""}</article>`
}

/* Pipelines (design §10 Pipelines), at -/pipelines: the runs, newest first, filtered by branch, event and state in a GET
 * form, by cursor (findPipelineRuns); Run pipeline for a Developer, with the manual pipelines of the default branch's
 * ci.xml and a ref. */
function pipelines(shell, bases, siteInfo, self) {
    requirePipelines(shell)
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const r = shell.repository
    const pu = urlsOf(c.base, r.repositoryPath)
    const filters = {
        ref: param("ref"),
        event: EVENTS.some(([key]) => key === param("event")) ? param("event") : null,
        state: RUN_STATES.includes(param("state")) ? param("state") : null
    }
    const cursor = param("cursor")
    const found = need("findPipelineRuns", {
        siteId: shell.siteId,
        repositoryId: r.repositoryId,
        limit: 30,
        ...(filters.ref ? {refName: filters.ref} : {}),
        ...(filters.event ? {event: filters.event} : {}),
        ...(filters.state ? {state: filters.state} : {}),
        ...(cursor ? {cursor} : {})
    })
    const rows = (found.runList || []).map(run => runLine(c, r.repositoryPath, run))
    const filtered = filters.ref || filters.event || filters.state
    const filterForm = h`<form method="get" action="${pu.list}" class="card" role="search" id="SmithyRunFilters"><label>Branch <input name="ref" value="${
        filters.ref || ""
    }" maxlength="250"></label> <label>Event <select name="event"><option value="">Any</option>${EVENTS.map(
        ([key, text]) => h`<option value="${key}"${attributes({selected: filters.event === key})}>${text}</option>`
    )}</select></label> <label>State <select name="state"><option value="">Any</option>${RUN_STATES.map(
        key => h`<option value="${key}"${attributes({selected: filters.state === key})}>${stateText(key)}</option>`
    )}</select></label> <button>Filter</button>${filtered ? h` <a href="${pu.list}">Clear</a>` : ""}</form>`
    return {
        html: h`<h2>Pipelines</h2>${runForm(c, shell, found)}${filterForm}<section id="SmithyRunList" aria-label="Pipeline runs">${
            rows.length
                ? rows
                : h`<p class="card">${filtered ? "No run matches these filters." : "No pipeline has run in this repository yet. A push runs the pipelines of the ci.xml at its commit; a Moqui component with no ci.xml runs the built-in pipeline."}</p>`
        }</section>${found.nextCursor ? h`<p><a href="${pu.list}${query({...filters, cursor: found.nextCursor})}" id="SmithyRunsMore">More runs</a></p>` : ""}`
            .html
    }
}
/* Run pipeline (design §10): a pipeline of the default branch's ci.xml with the manual event, and the branch or tag to run it
 * for, for who may run one (canRun: a Developer with a confirmed address). */
function runForm(c, shell, found) {
    if (!found.canRun) return ""
    const f = formOf(c, "runPipeline")
    const names = found.pipelineList || []
    if (!names.length)
        return h`<p class="card" id="SmithyRunNone">No pipeline of the ci.xml on ${shell.repository.defaultBranch || "the default branch"} has the manual event, so none is run from here. A pipeline with <code>on="manual"</code> is.</p>`
    return h`<details class="card" id="SmithyRunPipeline"${attributes({open: !!f.error})}><summary><strong>Run pipeline</strong></summary>${open(c, f, {plain: true})}${hidden(
        "repositoryId",
        shell.repository.repositoryId
    )}${hidden("operationId", portal.operationId())}${select(
        f,
        "pipelineName",
        "Pipeline",
        names.map(name => [name, plain(name)])
    )}${input(f, "refName", "Branch or tag", {
        value: shell.repository.defaultBranch || "main",
        required: true,
        maxlength: 250,
        hint: "Its ci.xml at that ref is what runs."
    })}${submit("Run pipeline")}</details>`
}

/* The jobs of a run in stages: a job with no needs is in the first, any other one stage after the latest it needs. */
function stagesOf(jobs) {
    const byName = new Map(jobs.map(job => [job.jobName, job]))
    const level = new Map()
    const depth = (job, seen) => {
        if (level.has(job.jobName)) return level.get(job.jobName)
        if (seen.has(job.jobName)) return 0
        seen.add(job.jobName)
        const needs = (job.needs || []).filter(name => byName.has(name))
        const d = needs.length ? 1 + Math.max(...needs.map(name => depth(byName.get(name), seen))) : 0
        level.set(job.jobName, d)
        return d
    }
    const stages = []
    for (const job of jobs) {
        const d = depth(job, new Set())
        ;(stages[d] = stages[d] || []).push(job)
    }
    return stages.filter(Boolean)
}
/* A job's name as a page shows it, from the ci.xml: its matrix key after it, both plain text (Smithy.js plain). */
const jobName = job => plain(job.jobName) + (job.matrixKey ? " (" + plain(job.matrixKey) + ")" : "")

/* A job's log, from the text a job printed, as the lines a page shows: each line's terminal escapes (colors, cursor moves)
 * and other control characters taken out (Smithy.js plain), and of a line rewritten by carriage returns (a progress bar)
 * its last text. */
function logLines(text) {
    const lines = String(text ?? "").split("\n")
    if (lines.length && lines[lines.length - 1] === "") lines.pop()
    return lines.map(line => {
        const plain = line.replace(ANSI, "")
        const shown = plain.includes("\r") ? plain.split("\r").filter(Boolean).pop() || "" : plain
        return shown.replace(CONTROL, "")
    })
}
/* Lines as escaped markup, each with its number and an anchor (#L10), numbered from first. */
const logHtml = (lines, first) =>
    new Markup(
        lines
            .map((line, i) => h`<span id="L${first + i}"><a class="n" href="#L${first + i}">${first + i}</a>${line}</span>`.html)
            .join("\n")
    )
/* The UTF-8 length of a text in bytes. */
const utf8Length = text => encodeURIComponent(text).replace(/%[0-9A-F]{2}/g, "x").length
/* A piece of a job's log (getJobLog): while it runs the chunks after after, once it has ended the stored log from offset.
 * {lines, after, offset, more, finished, state, pollSeconds, notification}: after and offset are where the next read
 * starts, as the authority gives them (both are passed back, so no line is lost when the job ends between two reads), more
 * that the log has more past this piece: the authority's more (its chunk limit or its byte bound, about 256 KB, cut the
 * answer), or an ended log's offset short of its length. An ended log's piece with more ends at its last whole line. */
function readLog(input, at, watch) {
    const found = portal.attempt("getJobLog", {...input, afterChunkSeq: at.after, offset: at.offset, limit: 500, watch: !!watch})
    if (found.error)
        fail(
            found.error.kind === "NotFound" ? "NotFound" : found.error.kind,
            found.error.kind === "NotFound" ? null : found.error.message
        )
    const out = found.result
    let offset = out.nextOffset != null ? Number(out.nextOffset) : at.offset
    let more = out.more === true
    let text
    if (out.finished) {
        text = String(out.text ?? "")
        if (!more) more = out.nextOffset != null && out.logBytes != null && Number(out.nextOffset) < Number(out.logBytes)
        const cut = text.lastIndexOf("\n")
        if (more && cut >= 0 && cut < text.length - 1) {
            text = text.slice(0, cut + 1)
            offset = at.offset + utf8Length(text)
        }
    } else text = (out.chunkList || []).map(chunk => chunk.text || "").join("")
    return {
        lines: logLines(text),
        after: out.nextChunkSeq != null ? Math.max(Number(out.nextChunkSeq) - 1, at.after) : at.after,
        offset: Number(offset) || 0,
        more,
        finished: !!out.finished,
        state: out.state || null,
        pollSeconds: Number(out.pollSeconds) || 2,
        notification: out.notification || null
    }
}
/* Where a page's log starts: ?after= (a running job's chunk), ?offset= (an ended job's byte) and ?line= (the number of its
 * first line), from a "Load more" link; the start otherwise. */
const logStart = () => ({after: whole("after", 0), offset: whole("offset", 0), line: Math.max(whole("line", 1), 1)})

/* PipelineDetail (design §10 PipelineDetail), at -/pipelines/<n> and -/pipelines/<n>/jobs/<jobRunId>: the run's header (state,
 * event, ref, commit, who, times, trusted or not), the approval it waits for with Approve and run for a Maintainer, Cancel
 * (asked again on ?confirm=cancel), Re-run, and its jobs by stage; for one job its steps, its log (a page of it, with Load
 * more), its failed tests linked to the file at the run's commit, its artifacts and reports, and Retry. */
function runPage(shell, runNum, jobRunId, bases, siteInfo, self) {
    requirePipelines(shell)
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const r = shell.repository
    const pu = urlsOf(c.base, r.repositoryPath)
    const number = Number(runNum)
    const key = {siteId: shell.siteId, repositoryId: r.repositoryId, runNum: number}
    const found = need("getPipelineRun", key)
    const run = found.run
    const caps = found.capabilities || {}
    const page = pu.run(run.runNum)
    const runKey = h`${hidden("repositoryId", r.repositoryId)}${hidden("runNum", run.runNum)}`
    const head = runHead(c, pu, run)
    // Cancel is asked again on a page of its own
    if (param("confirm") === "cancel" && caps.canCancel)
        return {
            html: h`${head}${confirmCard(c, "cancelPipelineRun", {
                title: "Cancel run #" + run.runNum,
                lines: [
                    "This stops run #" +
                        run.runNum +
                        " of " +
                        plain(run.pipelineName) +
                        ": its running jobs are stopped and the jobs that have not started do not run.",
                    "Its checks are reported as cancelled. A run that was cancelled can be run again."
                ],
                fields: {repositoryId: r.repositoryId, runNum: run.runNum},
                button: "Stop the run",
                cancelHref: page,
                returnTo: page + "?confirm=cancel",
                successTo: page
            })}`.html
        }
    const waiting = run.state === "waiting" && run.approvalState === "waiting"
    const banner = waiting
        ? h`<section role="status" class="card" id="SmithyRunWaiting"><p>This run waits for a Maintainer's approval. It is an outside run (from a fork, a push for review, or an account below Developer), and it runs only once a Maintainer has looked at what it would run. Approved, its jobs run with no secrets, in the pool for outside runs.</p>${
              caps.canApprove
                  ? h`${open(c, formOf(c, "approvePipelineRun"), {plain: true})}${runKey}<p><button>Approve and run</button></p></form>`
                  : h`<p><small>A Maintainer of this repository approves it.</small></p>`
          }</section>`
        : ""
    const actions = [
        caps.canCancel ? h`<a href="${page}?confirm=cancel" id="SmithyRunCancel">Cancel run</a>` : null,
        caps.canRerun
            ? h`${open(c, formOf(c, "rerunPipelineRun"), {plain: true})}${runKey}${hidden("operationId", portal.operationId())}<button>Run again</button></form>`
            : null
    ].filter(Boolean)
    const actionsHtml = actions.length
        ? h`<p class="card" id="SmithyRunActions">${actions.map((action, i) => h`${i ? " " : ""}${action}`)}</p>`
        : ""
    const jobs = found.jobList || []
    if (!jobRunId)
        return {
            html: h`${head}${banner}${actionsHtml}<section class="card" id="SmithyJobs" aria-label="Jobs"><h3>Jobs</h3>${
                jobs.length ? "" : h`<p>This run has no job.</p>`
            }${stagesOf(jobs).map(
                (stage, i) =>
                    h`<h4>Stage ${i + 1}</h4><ul class="smithy-joblist">${stage.map(
                        job =>
                            h`<li class="wrap"><a href="${pu.job(run.runNum, job.jobRunId)}">${jobName(job)}</a> ${chip(job.state)}${
                                durationText(job.durationSeconds) ? " · " + durationText(job.durationSeconds) : ""
                            }${job.attempt > 1 ? " · attempt " + job.attempt : ""}${
                                Number(job.testFailedCount)
                                    ? " · " +
                                      job.testFailedCount +
                                      (Number(job.testFailedCount) === 1 ? " test failed" : " tests failed")
                                    : ""
                            }${(job.needs || []).length ? h` <small>after ${job.needs.map(plain).join(", ")}</small>` : ""}</li>`
                    )}</ul>`
            )}</section>`.html
        }
    const detail = need("getJobRun", {...key, jobRunId})
    const job = detail.job
    // the run's jobs as a row of chips above the job (one scrolling row on a phone)
    const chips = h`<nav aria-label="Jobs of run #${run.runNum}" class="card smithy-tabs" id="SmithyJobChips">${jobs.map(
        other =>
            h`<a href="${pu.job(run.runNum, other.jobRunId)}"${attributes({"aria-current": other.jobRunId === job.jobRunId ? "page" : null})}>${jobName(other)} <small>${stateText(other.state)}</small></a>`
    )}</nav>`
    const ended = ENDED.includes(job.state)
    const retry =
        caps.canRetry && ended
            ? h`${open(c, formOf(c, "retryJobRun"), {plain: true})}${runKey}${hidden("jobRunId", job.jobRunId)}${hidden("operationId", portal.operationId())}<p><button>Retry this job</button></p></form>`
            : ""
    const facts = [
        job.image ? "image " + plain(job.image) : null,
        job.attempt > 1 ? "attempt " + job.attempt : null,
        job.exitCode != null ? "exit code " + job.exitCode : null,
        job.startedAt ? "started " + dateText(job.startedAt) : null,
        durationText(job.durationSeconds),
        job.minutesUsed ? job.minutesUsed + " runner " + (Number(job.minutesUsed) === 1 ? "minute" : "minutes") : null
    ].filter(Boolean)
    const jobHtml = h`<article class="card" id="SmithyJob"><h3 class="wrap">${jobName(job)} ${chip(job.state, "SmithyJobState")}</h3>${
        facts.length ? h`<p><small>${facts.join(" · ")}</small></p>` : ""
    }${job.message ? h`<p class="wrap">${messageText(job.message)}</p>` : ""}${retry}</article>`
    const steps = detail.stepList || []
    const stepsHtml = steps.length
        ? h`<section class="card" id="SmithySteps" aria-label="Steps"><h3>Steps</h3><ol>${steps.map(
              step =>
                  h`<li class="wrap">${step.stepName ? h`<strong>${plain(step.stepName)}</strong> ` : ""}<code>${plain(step.command)}</code> ${chip(step.state)}${
                      step.exitCode != null && step.exitCode !== 0 ? " · exit code " + step.exitCode : ""
                  }</li>`
          )}</ol></section>`
        : ""
    // the log: a page of it; Load more by the place the next one starts; the island tails a running job's new lines
    const at = logStart()
    const log = readLog({siteId: shell.siteId, repositoryId: r.repositoryId, runNum: number, jobRunId: job.jobRunId}, at, false)
    const live = !ended && !log.finished
    const moreHref = log.more
        ? pu.job(run.runNum, job.jobRunId) +
          query(
              log.finished
                  ? {offset: log.offset, line: at.line + log.lines.length}
                  : {after: log.after, offset: log.offset, line: at.line + log.lines.length}
          ) +
          "#SmithyLog"
        : null
    const logSection = h`<section class="card" id="SmithyLog" aria-label="Log"><h3>Log</h3>${
        at.line > 1 ? h`<p><a href="${pu.job(run.runNum, job.jobRunId)}#SmithyLog">From the start</a></p>` : ""
    }${log.lines.length ? "" : h`<p id="SmithyLogEmpty">${live ? "No lines yet." : "This job wrote no log."}</p>`}<pre class="smithy-code" id="SmithyJobLog"><code>${logHtml(
        log.lines,
        at.line
    )}</code></pre>${moreHref ? h`<p id="SmithyLogMore"><a href="${moreHref}">Load more</a></p>` : ""}${
        live && !moreHref
            ? h`<p id="SmithyLogRefresh"><a href="${pu.job(run.runNum, job.jobRunId)}#SmithyLog">Refresh</a> <small>The job is still running.</small></p>`
            : ""
    }${live ? h`<div id="SmithyJobLogIsland"></div>${logIsland(c, siteInfo, pu, run, job, log, at)}` : ""}</section>`
    return {
        html: h`${head}${banner}${actionsHtml}${chips}${jobHtml}${stepsHtml}${logSection}${failedTests(pu, run, detail)}${artifacts(pu, detail)}`
            .html
    }
}
/* The run's header (design §10): its pipeline and number, state, event, ref or merge request, commit, who asked, its times,
 * whether it is trusted, and why it waits or failed. */
function runHead(c, pu, run) {
    const times = [
        run.triggeredBy ? "asked by @" + run.triggeredBy : null,
        run.createdAt ? "created " + dateText(run.createdAt) : null,
        run.startedAt ? "started " + dateText(run.startedAt) : null,
        run.finishedAt ? "ended " + dateText(run.finishedAt) : null,
        durationText(run.durationSeconds),
        run.trusted ? "trusted" : "outside run: no secrets, its own pool",
        run.definitionSource === "builtin" ? "the built-in pipeline" : null
    ].filter(Boolean)
    return h`<article id="SmithyRun" class="wrap"><h2>${plain(run.pipelineName)} <small>#${run.runNum}</small></h2><p>${chip(run.state, "SmithyRunState")} ${eventText(run.event)} · ${
        run.mergeRequestNum
            ? h`<a href="${pu.u.section("merge-requests")}/${encodeURIComponent(run.mergeRequestNum)}">!${run.mergeRequestNum}</a>`
            : refText(run.refName)
    }${run.commitId ? h` · <a href="${pu.u.commit(run.commitId)}"><code>${shortId(run.commitId)}</code></a>` : ""} · <a href="${pu.list}">All runs</a></p><p><small>${times.join(
        " · "
    )}</small></p>${run.message ? h`<p class="wrap" id="SmithyRunMessage">${messageText(run.message)}</p>` : ""}</article>`
}
/* The framework's notification socket's path for the log's island: the pass_notification_endpoint property (/notws when it
 * is not set; empty: no socket, the island polls), a path on this host only. */
function notificationEndpoint() {
    const configured = System.getProperty("pass_notification_endpoint")
    const endpoint = configured == null ? "/notws" : String(configured).trim()
    return /^\/[A-Za-z0-9_\/-]{1,100}$/.test(endpoint) ? endpoint : null
}
/* The log's island (design §10): where JavaScript runs it reads the lines after what the page shows from the log's JSON (the
 * log transition) every pollSeconds, and at once when the notification socket says the log grew (topic GitCiJobLog, the
 * job's id its sub-topic; a signed-in reader only), and stops when the job has ended. */
function logIsland(c, siteInfo, pu, run, job, log, at) {
    return ec.resource.script("component://mr-pass/screen/Smithy/SmithyIssues.js").islandOf(
        "SmithyJobLogIsland",
        "JobLog",
        c,
        siteInfo,
        {
            logUrl: pu.log(run.runNum, job.jobRunId),
            after: log.after,
            offset: log.offset,
            line: at.line + log.lines.length,
            pollSeconds: log.pollSeconds,
            // the framework's notification socket, which opens for a signed-in account; the page polls without it
            notification: c.signedIn && notificationEndpoint() ? {endpoint: notificationEndpoint(), topic: "GitCiJobLog", subTopic: job.jobRunId} : null
        },
        {loading: "Loading the log"}
    )
}
/* A failed test's file, as a path in the repository: a relative path only (a runner's absolute path is not one), with no . or
 * .. segment, no empty one and no backslash, so a report cannot make the link lead anywhere else on the site. */
const testPath = path => {
    const p = String(path || "").replace(/^(?:\.\/)+/, "")
    if (!p || p.startsWith("/") || /^[A-Za-z]:/.test(p) || /[\\\u0000-\u001f\u007f]/.test(p)) return null
    return p.split("/").every(segment => segment && segment !== "." && segment !== "..") ? p : null
}
/* The failed tests of a job (design §10): name, the file and line linked to Blob at the run's commit, the message. */
function failedTests(pu, run, detail) {
    const tests = detail.failedTestList || []
    if (!tests.length) return ""
    return h`<section class="card" id="SmithyFailedTests" aria-label="Failed tests"><h3>Failed tests <small>${tests.length}</small></h3><ul>${tests.map(
        test => {
            const path = testPath(test.filePath)
            const place = test.filePath ? plain(test.filePath) + (test.lineNumber ? ":" + test.lineNumber : "") : ""
            return h`<li class="wrap"><strong>${test.suiteName ? plain(test.suiteName) + " › " : ""}${plain(test.testName)}</strong>${
                place
                    ? h` · ${
                          path && run.commitId
                              ? h`<a href="${pu.u.blob(run.commitId, path)}${test.lineNumber ? "#L" + test.lineNumber : ""}">${place}</a>`
                              : place
                      }`
                    : ""
            }${test.durationMillis != null ? h` <small>${(Number(test.durationMillis) / 1000).toFixed(2)} s</small>` : ""}${
                test.message ? h`<pre class="smithy-pre">${plain(test.message)}</pre>` : ""
            }</li>`
        }
    )}</ul></section>`
}
/* A job's artifacts and reports (design §10), each a download with its size and checksum. */
function artifacts(pu, detail) {
    const list = detail.artifactList || []
    if (!list.length) return ""
    return h`<section class="card" id="SmithyArtifacts" aria-label="Artifacts"><h3>Artifacts and reports</h3><ul>${list.map(
        a =>
            h`<li class="wrap"><a href="${pu.artifact(a.artifactId, a.fileName || a.name)}" rel="nofollow">${plain(a.name)}</a> <small>${
                a.artifactKind === "report" ? "report" : "artifact"
            }${a.sizeBytes != null ? " · " + sizeText(a.sizeBytes) : ""}${a.sha256 ? h` · SHA-256 <code>${String(a.sha256).slice(0, 12)}</code>` : ""}${
                a.expiresAt ? " · until " + dateText(a.expiresAt) : ""
            }</small></li>`
    )}</ul></section>`
}

/* artifact (design §4.4: -/artifacts/<artifactId>/<name>): an artifact or a report of a run the caller reads
 * (downloadArtifact), streamed by the facade as an attachment, nosniff and never kept by a cache. */
function artifact(siteId, repositoryId, artifactId) {
    if (!artifactId || !repositoryId) fail()
    // a repository with pipelines off has none of their files (the authority refuses them too)
    requirePipelines({repository: need("getRepository", {siteId, repositoryId}).repository})
    try {
        ec.resource
            .script("component://mr-pass/service/pass/Facade.js")
            .downloadFile(siteId, "downloadArtifact", {repositoryId, artifactId}, {streamed: true})
    } catch (error) {
        ec.message.clearErrors()
        fail(
            error.moquiErrorKind === "NotFound" ? "NotFound" : error.moquiErrorKind || "NotFound",
            portal.refusal(error.message).text
        )
    }
}
/* log (-/pipelines/<n>/jobs/<jobRunId>/log): the lines of a job's log after ?after= and ?offset= as JSON, for the log's
 * island: {lines, after, offset, more, finished, state, stateText, pollSeconds}. The lines are text (the island writes
 * them as text); a reader who may not read the run gets Not Found. */
function logJson(siteId, repositoryId, runNum, jobRunId) {
    if (!/^[1-9][0-9]{0,8}$/.test(runNum) || !jobRunId) fail()
    // a repository with pipelines off has no log to follow (the authority refuses it too)
    requirePipelines({repository: need("getRepository", {siteId, repositoryId}).repository})
    const at = logStart()
    const log = readLog({siteId, repositoryId, runNum: Number(runNum), jobRunId}, at, true)
    ec.web.response.setHeader("Cache-Control", "no-store")
    ec.web.sendJsonResponse({
        lines: log.lines,
        after: log.after,
        offset: log.offset,
        more: log.more,
        finished: log.finished,
        state: log.state,
        stateText: stateText(log.state),
        pollSeconds: log.pollSeconds
    })
}

/* What a merge request's Checks tab shows of its runs at the head (design §9 MergeRequestChecks): each run with its jobs and
 * their failed tests, and Approve and run for a run that waits, when the caller may approve it. request.found is
 * getMergeRequest's answer (runList), whose rows the list shows as they are; a run is read again for its jobs only for the
 * first RUN_READS runs (one that waits for approval first, then one that failed), and a failed job for its tests only for
 * TEST_READS jobs of the page. */
const RUN_READS = 3
const TEST_READS = 2
function requestRuns(c, shell, request) {
    const runs = (request.found.runList || []).slice(0, 10)
    if (!runs.length) return ""
    const r = shell.repository
    const pu = urlsOf(c.base, r.repositoryPath)
    const rank = run => (run.state === "waiting" && run.approvalState === "waiting" ? 0 : ["failure", "error"].includes(run.state) ? 1 : 2)
    const detailed = new Set(
        runs
            .slice()
            .sort((x, y) => rank(x) - rank(y))
            .slice(0, RUN_READS)
            .map(run => run.runNum)
    )
    let reads = 0
    return h`<section class="card" id="SmithyRequestRuns" aria-label="Pipeline runs"><p><strong>Pipeline runs of the head</strong></p>${runs.map(
        run => {
            const found = detailed.has(run.runNum)
                ? maybe("getPipelineRun", {siteId: shell.siteId, repositoryId: r.repositoryId, runNum: run.runNum})
                : null
            if (!found) return runLine(c, r.repositoryPath, run)
            const caps = found.capabilities || {}
            const jobs = (found.jobList || []).map(job => {
                // the failed tests of a failed job, read for at most five jobs of the page
                const tests =
                    Number(job.testFailedCount) && reads++ < TEST_READS
                        ? maybe("getJobRun", {
                              siteId: shell.siteId,
                              repositoryId: r.repositoryId,
                              runNum: run.runNum,
                              jobRunId: job.jobRunId
                          })?.failedTestList || []
                        : []
                return h`<li class="wrap"><a href="${pu.job(run.runNum, job.jobRunId)}">${jobName(job)}</a> ${chip(job.state)}${
                    tests.length
                        ? h`<ul>${tests.slice(0, 10).map(test => {
                              const path = testPath(test.filePath)
                              return h`<li>${plain(test.testName)}${
                                  path && found.run.commitId
                                      ? h` · <a href="${pu.u.blob(found.run.commitId, path)}${test.lineNumber ? "#L" + test.lineNumber : ""}">${path}${test.lineNumber ? ":" + test.lineNumber : ""}</a>`
                                      : ""
                              }</li>`
                          })}</ul>`
                        : ""
                }</li>`
            })
            const approve = caps.canApprove
                ? h`${open(c, formOf(c, "approvePipelineRun", String(run.runNum)), {plain: true})}${hidden("repositoryId", r.repositoryId)}${hidden(
                      "runNum",
                      run.runNum
                  )}<p><button>Approve and run</button> <small>This outside run waits for a Maintainer.</small></p></form>`
                : ""
            return runLine(
                c,
                r.repositoryPath,
                {...run, ...found.run},
                h`${jobs.length ? h`<ul class="smithy-joblist">${jobs}</ul>` : ""}${approve}`
            )
        }
    )}</section>`
}

/* The pools, the approval of outside runs and the month's runner minutes of a group or a repository (getPipelineSettings),
 * with the form a group's Owner saves them with (storePipelineSettings); found is the read, closed the gate in place of
 * the form. */
function runnerSettings(c, found, closed, groupPath) {
    const pools = found.poolList || []
    const poolText = pool =>
        (pool.poolName || pool.runnerPoolId) +
        (pool.description ? ": " + pool.description : "") +
        (pool.shared ? "" : " (this group's own)")
    const usage = found.usage || {}
    const owner = found.owner || {}
    const minutes = h`<p id="SmithyRunnerMinutes">Runner minutes of ${owner.kind === "account" ? "@" + owner.label : owner.label || "this group"} in ${
        usage.periodKey || "this month"
    }: <strong>${usage.minutesUsed == null ? "not known now" : String(usage.minutesUsed)}</strong> of ${
        usage.runnerMinutesMonthly == null ? "no limit" : String(usage.runnerMinutesMonthly)
    }.${Number(usage.runnerMinutesMonthly) > 0 ? "" : owner.kind === "account" ? " A personal repository runs pipelines only with minutes the site's operators give its account." : " The group runs no pipeline until an operator gives it minutes."}</p>`
    const poolList = h`<div class="card table-wrap"><table class="lines" id="SmithyPools"><thead><tr><th scope="col">Pool</th><th scope="col">Runs</th><th scope="col">Of</th></tr></thead><tbody>${
        pools.length
            ? pools.map(
                  pool =>
                      h`<tr><th scope="row">${poolText(pool)}</th><td>${pool.trusted ? "Trusted runs" : "Outside runs"}</td><td>${pool.shared ? "The site" : "This group"}</td></tr>`
              )
            : h`<tr><td colspan="3">An operator of the site has allowed no runner pool here, so no pipeline runs.</td></tr>`
    }</tbody></table></div>`
    const named = id => (id ? pools.find(pool => pool.runnerPoolId === id) : null)
    const chosen = (id, any) => (id ? (named(id) ? poolText(named(id)) : id + " (no longer allowed: the engine chooses)") : any)
    const approvalText = APPROVALS.find(([key]) => key === found.outsideRunApproval)?.[1] || found.outsideRunApproval || ""
    const inherited = found.inheritedFromPath ? h`<p><small>Set on ${found.inheritedFromPath}, the group above.</small></p>` : ""
    if (!found.canStore || closed)
        return h`<section class="card" id="SmithyRunners" aria-label="Runners"><h3>Runners</h3>${minutes}<dl><dt>Pool of trusted runs</dt><dd>${chosen(
            found.runnerPoolId,
            "A pool of the jobs' pool name that takes trusted runs"
        )}</dd><dt>Pool of outside runs</dt><dd>${chosen(found.outsideRunnerPoolId, "A pool of the jobs' pool name that takes outside runs")}</dd><dt>Outside runs</dt><dd>${approvalText}</dd></dl>${inherited}${
            closed ||
            (found.groupId
                ? h`<p><small>An Owner of ${groupPath || "the group"} changes these, on the group's settings.</small></p>`
                : "")
        }</section>${poolList}`
    // the form holds the group's own values (empty where it follows the group above or the site), never the values in
    // effect: a save sends only a field that was changed (was_<name>), and an emptied one gives up the group's own value
    const own = found.own || (found.inheritedFromPath ? {} : found)
    const from = found.inheritedFrom || {}
    const whence = field => (from[field] === "site" ? "the site" : from[field] ? from[field] : "this group")
    const f = formOf(c, "storePipelineSettings")
    const pick = (trusted, above) => [
        ["", above],
        ...pools.filter(pool => !!pool.trusted === trusted).map(pool => [pool.runnerPoolId, poolText(pool)])
    ]
    const ownSelect = (field, label, choices, inEffect, text) =>
        h`${select(f, field, label, choices, {
            value: own[field] || "",
            hint: text + " In effect now: " + inEffect + (own[field] ? "" : ", as " + whence(field) + " says") + "."
        })}${hidden("was_" + field, own[field] || "")}`
    return h`${open(c, f, {title: "Runners"})}${minutes}${hidden("groupId", found.groupId)}${hidden("expectedRevision", found.revision)}${ownSelect(
        "runnerPoolId",
        "Pool of trusted runs",
        pick(true, "As the group above says"),
        chosen(found.runnerPoolId, "a pool of the jobs' pool name that takes trusted runs"),
        "Runs of this group's own branches and tags, pushed or asked for by a Developer. They get the secrets their rules allow."
    )}${ownSelect(
        "outsideRunnerPoolId",
        "Pool of outside runs",
        pick(false, "As the group above says"),
        chosen(found.outsideRunnerPoolId, "a pool of the jobs' pool name that takes outside runs"),
        "Runs of a fork's merge request, a push for review, or an account below Developer: no secrets, and a read-only cache."
    )}${ownSelect(
        "outsideRunApproval",
        "When an outside run waits",
        // never (outside runs that never wait) only for who may set it, the top-level group's Owner
        [["", "As the group above or the site says"], ...APPROVALS.filter(([key]) => key !== "never" || found.canSetNever !== false || own.outsideRunApproval === "never")],
        approvalText,
        ""
    )}${submit("Save")}${poolList}`
}

/* The Pipelines tab of a group's Settings (design §11), for its Owner: the runners of its repositories. */
function groupSettings(shell, head, bases, siteInfo, self) {
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const found = need("getPipelineSettings", {siteId: shell.siteId, groupId: shell.group.groupId})
    return {
        html: h`${new Markup(head)}${runnerSettings(c, found, gate(c, shell.capabilities.confirmed), shell.group.groupPath)}`.html
    }
}

/* The Pipelines tab of a repository's Settings (design §11), for a Maintainer: the runners (a group's Owner changes them),
 * the secrets (names and scopes: a value is written and never shown again; ?delete=<secretId> asks again) and the
 * environments (?deleteEnvironment=<environmentId> asks again). */
function repositorySettings(shell, head, bases, siteInfo, self) {
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const r = shell.repository
    const siteId = shell.siteId
    const id = r.repositoryId
    const tab = smithy.urls(shell.base, r.repositoryPath).section("settings") + "/pipelines"
    const closed = gate(c, shell.capabilities.confirmed)
    const settings = need("getPipelineSettings", {siteId, repositoryId: id})
    const secrets = need("findCiSecrets", {siteId, repositoryId: id})
    const environments = need("findCiEnvironments", {siteId, repositoryId: id})
    const envList = environments.environmentList || []
    const envName = envId => envList.find(env => env.environmentId === envId)?.name || ""
    const page = body => ({html: h`${new Markup(head)}${body}`.html})
    const deleting = param("delete")
    const doomed = deleting ? (secrets.secretList || []).find(secret => secret.secretId === deleting) : null
    if (doomed && secrets.canChange && !closed)
        return page(
            confirmCard(c, "deleteCiSecret", {
                title: "Delete the secret " + doomed.name,
                lines: [
                    "This deletes the secret " +
                        doomed.name +
                        " of " +
                        r.repositoryPath +
                        ", given to runs of " +
                        scopeText(doomed.scope) +
                        (doomed.environmentName ? " " + doomed.environmentName : "") +
                        ".",
                    "A job that reads it gets nothing from now on. Its value cannot be read back, so it cannot be restored."
                ],
                fields: {repositoryId: id, secretId: doomed.secretId},
                button: "Delete secret",
                cancelHref: tab,
                returnTo: tab + query({delete: doomed.secretId}),
                successTo: tab
            })
        )
    const deletingEnv = param("deleteEnvironment")
    const doomedEnv = deletingEnv ? envList.find(env => env.environmentId === deletingEnv) : null
    if (doomedEnv && environments.canChange && !closed)
        return page(
            confirmCard(c, "deleteCiEnvironment", {
                title: "Delete the environment " + doomedEnv.name,
                lines: [
                    "This deletes the environment " + doomedEnv.name + " of " + r.repositoryPath + ".",
                    "An environment with a secret scoped to it is not deleted: delete the secret or move it first."
                ],
                fields: {repositoryId: id, environmentId: doomedEnv.environmentId},
                button: "Delete environment",
                cancelHref: tab,
                returnTo: tab + query({deleteEnvironment: doomedEnv.environmentId}),
                successTo: tab
            })
        )
    const common = hidden("repositoryId", id)
    const envChoices = [["", "None"], ...envList.map(env => [env.environmentId, env.name])]
    // a secret's value is a password field: never written back into a page, and never kept for the next page
    const value = (f, label) =>
        input(f, "value", label, {type: "password", secret: true, required: true, autocomplete: "new-password", maxlength: 65536})
    const scopeFields = (f, secret) =>
        h`${select(f, "scope", "Given to runs of", SCOPES, {value: secret?.scope || "protected"})}${
            envList.length
                ? select(f, "environmentId", "Environment", envChoices, {
                      value: secret?.environmentId || "",
                      hint: "For the scope An environment."
                  })
                : ""
        }`
    const secretRows = (secrets.secretList || []).map(secret => {
        const f = formOf(c, "storeCiSecret", secret.secretId)
        return h`<article class="card smithy-row" id="SmithySecret_${secret.secretId}"><h3 class="wrap"><code>${secret.name}</code></h3><p><small>Given to runs of ${scopeText(secret.scope)}${
            secret.environmentName || envName(secret.environmentId)
                ? " " + (secret.environmentName || envName(secret.environmentId))
                : ""
        }${secret.createdAt ? " · added " + dateText(secret.createdAt) : ""}${secret.lastUsedAt ? " · last used " + dateText(secret.lastUsedAt) : " · not used yet"}</small></p>${
            secrets.canChange && !closed
                ? h`<details${attributes({open: !!f.error})}><summary>Replace the value</summary>${open(c, f, {plain: true})}${common}${hidden("secretId", secret.secretId)}${value(
                      f,
                      "New value"
                  )}${scopeFields(f, secret)}${hint("A secret moved to another scope or environment takes a new value.")}${submit("Save secret")}</details><p><a href="${tab}${query(
                      {
                          delete: secret.secretId
                      }
                  )}" aria-label="Delete the secret ${secret.name}">Delete secret</a></p>`
                : ""
        }</article>`
    })
    const freshSecret = formOf(c, "storeCiSecret")
    const secretsHtml = h`<section id="SmithySecrets" aria-label="Secrets"><h3>Secrets</h3><p>A secret is given to a job of a trusted run as an environment variable, and masked in its log. Its value is written here and never shown again.</p>${
        secretRows.length ? secretRows : h`<p class="card">This repository has no secret.</p>`
    }${
        secrets.canChange
            ? closed ||
              h`${open(c, freshSecret, {title: "New secret"})}${common}${hidden("secretId", "")}${hidden("operationId", portal.operationId())}${input(
                  freshSecret,
                  "name",
                  "Name",
                  {
                      required: true,
                      maxlength: 64,
                      pattern: "[A-Za-z_][A-Za-z0-9_]{0,63}",
                      autocomplete: "off",
                      hint: "A variable name: letters, digits and _."
                  }
              )}${value(freshSecret, "Value")}${scopeFields(freshSecret, null)}${submit("Add secret")}`
            : ""
    }</section>`
    const envFields = (f, env) =>
        h`${input(f, "name", "Name", {value: env?.name || "", required: true, maxlength: 64, autocomplete: "off"})}${input(
            f,
            "allowedRefs",
            "Branches allowed",
            {
                value: env?.allowedRefs || "",
                // sent only when changed, so a save of the name or the approval keeps the branches as they are
                was: true,
                maxlength: 1000,
                hint: "Branch names or patterns such as release/*, separated by spaces. Runs of a protected branch and of these get its secrets."
            }
        )}${check("approvalRequired", "Only an approved run gets its secrets", !!env?.approvalRequired)}`
    const envRows = envList.map(env => {
        const f = formOf(c, "storeCiEnvironment", env.environmentId)
        return h`<article class="card smithy-row" id="SmithyEnvironment_${env.environmentId}"><h3 class="wrap">${env.name}${
            env.approvalRequired ? h` <small class="smithy-chip">Approval required</small>` : ""
        }</h3><p><small>${env.allowedRefs ? "Branches allowed: " + env.allowedRefs : "Protected branches only"}</small></p>${
            environments.canChange && !closed
                ? h`<details${attributes({open: !!f.error})}><summary>Edit</summary>${open(c, f, {plain: true})}${common}${hidden("environmentId", env.environmentId)}${envFields(
                      f,
                      env
                  )}${submit("Save environment")}</details><p><a href="${tab}${query({deleteEnvironment: env.environmentId})}" aria-label="Delete the environment ${env.name}">Delete environment</a></p>`
                : ""
        }</article>`
    })
    const freshEnv = formOf(c, "storeCiEnvironment")
    const envHtml = h`<section id="SmithyEnvironments" aria-label="Environments"><h3>Environments</h3><p>An environment's secrets are given only to the runs its rules allow.</p>${
        envRows.length ? envRows : h`<p class="card">This repository has no environment.</p>`
    }${
        environments.canChange
            ? closed ||
              h`${open(c, freshEnv, {title: "New environment"})}${common}${hidden("environmentId", "")}${hidden("operationId", portal.operationId())}${envFields(freshEnv, null)}${submit(
                  "Add environment"
              )}`
            : ""
    }</section>`
    const off = r.features?.pipelines
        ? ""
        : h`<p class="card" id="SmithyPipelinesOff">Pipelines are off in this repository: turn them on in General. Secrets and environments may be set first.</p>`
    return page(h`${off}${runnerSettings(c, settings, closed, shell.group?.groupPath)}${secretsHtml}${envHtml}`)
}
;({
    urlsOf,
    ENDED,
    APPROVALS,
    stateText,
    durationText,
    logLines,
    testPath,
    runLine,
    pipelines,
    runPage,
    artifact,
    logJson,
    requestRuns,
    groupSettings,
    repositorySettings
})
