# Smithy: implementation record

What is built of [design-smithy](design-smithy.md), by phase of
[Dogfood](../../../../../plans/Dogfood.md#13-phases). Each phase lists what differs from the design and what is left.

## DG1: public read

| Area | Implementation |
| --- | --- |
| Registration | `service/pass/Apps.js` (`smithy`, base `/code`), `screen/Pass.xml`, the header's Smithy branch, `SmithySchema.js` (a copy of Mantle's, merged by `Facade.js`), `Routes.js`, `Shared/Portal.js` reasons |
| Routes | `service/pass/SmithyRoutes.js`, called by `resolve#Route` for a Smithy mount: names, then a section after `/-/`; GitHub's forms and a name not in its stored case redirect after Mantle's view check |
| Pages | `screen/Smithy/`: Home, Explore, AccountDetail, GroupDetail (Overview, Repositories, Members), RepositoryDetail (Files, Blob, Commits, Branches, Tags), CommitDetail, Compare; `raw` and `redirect` are transitions. HTML with no script |
| Mantle | `mr-mantle` `mantle.smithy`: `SmithyEntities.xml`, `SmithyCore.js` (site, group and repository access, the name set, path lookup), `Smithy.js` (16 read operations), `create#Group`, `create#Repository`, `bind#Repository`; `check#GitRepositoryAuthz` gives Smithy's answer for a repository with a Smithy row |
| Tests | `test/Smithy/Smithy.spec.js`, `SmithyAccess.spec.js`; Mantle's `test/smithy/` (SmithyVisibility, SmithyRoles, SmithyNames, SmithyPaths) |

Differences from the design:

- Links carry a ref's short name, not its full name.
- A list sorted by "pushed" is in path order; there is no stored push date yet.
- A commit of more than 100 files shows its file list, and a file's diff when asked.
- `getSmithyHome` does not make the `SmithySite` row.

Not built: syntax highlighting and the tree and diff islands, a page rendered on a root mount in a spec. Blame, the
archive download and the client walk (`SmithyWalk`) came with DG2.

## DG2: accounts and push

| Area | Implementation |
| --- | --- |
| Routes | `SmithyRoutes.js` routes `new/group`, `new/repository`, `-/site[/<tab>]`, `-/do/<name>`, a group's `-/settings[/<tab>]` and a repository's `-/settings[/<tab>]`. The grammar has every tab of design §4.4; a tab of a later phase is Not Found (`BUILT_TABS`: the site's `settings`, `requests`, `quotas`; a group's `general`, `quota`, `delete`; a repository's `general`, `members`, `branch-rules`, `webhooks`, `archive`) |
| Forms | `screen/Smithy/Do.xml`: 29 `post` transitions, one for each write operation and named for it. `SmithyForms.js` `run` builds the operation's input from the form's fields (`DO`), calls it in its own transaction, and answers 303: to the page of what was made or changed, or back to the form's `returnTo` (a path under the mount) with the refusal's text and what was typed. That is kept in the session for the one next page (`Smithy.js` `setFlash`, `takeFlash`; dropped after two minutes; a password, a secret and a typed path are not kept). The framework checks the session token before a transition runs |
| Pages | `screen/Smithy/New/Group`, `New/Repository`, `Site`, `GroupDetail/Settings`, `RepositoryDetail/Settings`, `Account/GitAccess`; GroupMembers, GroupRepositories, Branches, Tags, the empty repository's page, the shells and the header gained their DG2 parts. The pages that write are built in `SmithyForms.js` as escaped markup (its `h`), with no script |
| Confirmation | A visibility change (a group's, a repository's), archive and unarchive, transfer, a delete (a group, a repository, a branch, a tag) and removing a key or a token are asked again on a page of their own, a GET of the same page with `?confirm=`, which names the target and the consequence; a group's and a repository's delete take the path typed (`confirmPath`). The transition refuses such an action without that page's answer |
| Access | A tab is shown by the role the read answers: a repository's Settings to a Maintainer (`capabilities.role`), its Archive tab and the Members' forms to an Owner, a group's Settings to an Owner (`myRole`), SiteSettings to the site's owners and operators (`getSiteInfo`'s `canManageSite` and the revision `getSmithySettings` gives them alone). Anyone else gets Not Found. An account without a confirmed address sees "Confirm your email address" in place of a form |
| Git access | `Account/GitAccess` (Not Found on a site with no Smithy mount): SSH keys and access tokens, Add and Remove, the password asked again. A new token is in the session for the one page after its form, which shows it once; it is in no address, and the page is `no-store` |
| Header | Smithy's branch has New repository, New group, Site settings (the site's owners), My account, Git access and Sign out (a form to Account's `endSession`) for a signed-in account |
| Caching | A publicly cached answer now has `Vary: Cookie` (`Shared/Headers.js`, for every app), so after a sign-in the browser does not show the anonymous copy of a page it kept |
| Blame | `RepositoryDetail/Blame` (`-/blame/<refPath>`, `getBlame`): a table of the file's lines, escaped, each run with its commit linked where it starts (`#L10` anchors); a file with no blame (binary, in Git LFS, too large, a history past the limit) shows the refusal's text. Linked from the file's page |
| Archive | The `archive` transition of `RepositoryDetail` (`-/archive/<ref>.zip`, `.tar.gz`, `downloadArchive`), streamed by `Facade.js` `downloadFile`, as an attachment named `<slug>-<ref>.<format>` by the raw file's safe-name code, `no-store`. For a signed-in account: a visitor who may view the repository is sent to sign in. The links are on the root of Files and on each tag, for a signed-in account |
| Registries | `SmithySchema.js` and `Routes.js` are copies of Mantle's with the 37 DG2 operations (53 Smithy operations in all) |
| Tests | `test/Smithy/Smithy.spec.js` (the DG2 paths; one render of a repository's Settings; Git access with a token a public account makes through its form, shown once; one render of Blame; the archive transition's headers and a visitor sent to sign in; a form's post, its refusal on the form, an ending action not run without its confirmation, a return address off the mount not used; the registries), `SmithyAccess.spec.js` (a confirmed address on a form's post; Developer, Maintainer and Owner, one holder and one non-holder each; the tabs by role; no Smithy write among the bearer writes). Acceptance: `test/acceptance/client/SmithyWalk.spec.js` with `test/acceptance/SmithyWalkFixtures.spec.js` |

Differences from the design:

- A group's members are changed on its Members page (design §6 GroupMembers), not on a tab of its Settings.
- GitAccess's forms post to Smithy's `Do` (design §1), so they return to the Account page by a fixed address, not by the
  form's `returnTo`.
- Every visibility change is confirmed, a narrowing too, and so are a branch's or a tag's delete and removing a key or a
  token; the design asks it for an audience-widening or destructive save.
- A refusal returns to the form by a redirect (303) with its text in the session, not as the answer to the post.
- NewRepository lists the groups `findGroups` (`mine`) answers, the caller's role in each not known; a group where the
  caller is less than a Maintainer is refused on the post. All three visibilities are offered, and a wider one than the
  group's is refused on the post.
- The password is asked on each change of the git access (Mantle's rule), not only for an older session.
- Sizes in SiteSettings and Quotas are typed in MiB and sent in bytes.
- `SmithyWalk` is an acceptance spec, not a regression one: it takes about five seconds, and the regression client
  suite's budget (9 s, 7.0 s used) has no room for it. It also checks the pages that write at 390 px, which the design
  gives to `SmithyPhone`.
- The session token's check is the framework's request check, which a server spec's render does not make, and a server
  spec has no HTTP server to make a real request of: `Smithy` reads it from `Do.xml` (every transition a `post`, none
  opting out) and the acceptance walk `SmithyWalk` posts without a token (401).
- Quotas: a field holds the account's or group's own limit (`getQuotaUsage`'s `ownLimits`), with the limit in effect
  as its hint; only a changed field is sent, and an emptied one gives up the own limit.
- Dates are shown as the day in the signed-in account's time zone, or the site's for a visitor. A member's end date and a
  token's expiry are typed as a day and sent as the end of that day (`yyyy-MM-dd 23:59:59`).
- What a form leaves in the session (a notice, a refusal, a new token) is dropped by `Pass.xml` on the next request of
  the account in any app once it is two minutes old, and when its page shows it.

Not built: a group's avatar and its issue repository (General); pinning a repository (`pinnedSequence`); the Redirects
tab of SiteSettings (DG7); `SmithyAccessWalk` (design §19.3, the per-operation acceptance table) and `SmithyPhone` as a
spec of its own; an archive for a visitor (the authority serves one to a signed-in account until it has a limit by
client).

## DG3: issues

| Area | Implementation |
| --- | --- |
| Routes | `SmithyRoutes.js` routes a repository's `-/issues`, `-/issues/new`, `-/issues/<n>`, `-/labels`, `-/milestones[/<id>]`, a group's `-/issues`, and the island `-/island/Composer.qvue` (`.qvt`, `.qjs`) |
| Pages | `screen/Smithy/SmithyIssues.js` builds them as escaped markup with `SmithyForms.js`'s helpers: `RepositoryDetail/Issues`, `Labels` and `Milestones`, `GroupDetail/Issues`, `NewIssue` and `IssueDetail` (the last two in the repository's shell, as CommitDetail is). A repository with issues off has none of them (Not Found) and no Issues tab |
| Issues list | Open and Closed with the counts `findIssues` answers, a GET form of filters (text, label, milestone, author, assignee, sort), "Confidential only" for an Owner alone, More by cursor. A group's list has the repository on each row, and its New issue asks for the repository (a GET form whose choice is redirected) |
| IssueDetail | `getIssue`, then the conversation: the posts of the issue's record topic by the forum's `getPosts` (author, day, "edited", "Waiting for review", "Owners only", a state change as one line), each body cleaned again here (`StringUtilities.cleanHtml`). Reactions are buttons for who may react. Forms by the read's `capabilities`: a comment (Markdown, with "Owners only" for an Owner of a confidential issue), a post's edit (`?edit=`, `getEditablePost`, `updatePost`) and report (`?report=`, `flagPost`), the title, labels, assignees (the handles `findAssignees` answers), milestone, Close as completed or not planned, Close as a duplicate (a Reporter), Reopen, the watch level (`getPreferences`, `setPreferences` with the topic's scope), and who reads it. The side blocks are `details`, closed, with the present value in the summary. The reporter of a confidential issue gets no block for a field the projection does not give |
| Confidential | The mark on NewIssue with who will read it; a chip on the list and the page for those who see it. Changing it is asked again on `?confirm=confidential`: make confidential; make public as it is, with the conversation shown under the question; or make a new public issue with a title and text written there (`asNewIssue`) |
| NewIssue | Title, a Markdown textarea, Confidential, and for a Reporter labels, assignees and milestone. A visitor gets Sign in, an account without a confirmed address "Confirm your email address", an archived repository a sentence |
| Preview | Every form of a text has a Preview button (`formaction` to `Do/previewPost`), which keeps what was typed and the authority's rendering in the session for the form's next page (the flash), and answers 303 back to the form. Nothing is stored |
| Island | `screen/Smithy/Islands/Composer.qvue` (`WebrootPublic.qvt.js` island mode), mounted in the one text form of a page: a Markdown or rich text (`m-rich-text`) toggle and a preview in the page (`Do/previewPost` as JSON). The plain textarea and `sourceFormat` stay the form's fields, kept in step, so the form posts as the plain one does. Quasar's stylesheets load only when rich text is chosen |
| Forms | `Do.xml` has 16 more `post` transitions (45): `createIssue`, `updateIssue`, `setIssueState`, `setIssueLabels`, `setIssueAssignees`, `setIssueMilestone`, `setIssueConfidential` (confirmed), `storeLabel`, `deleteLabel` (confirmed on `?delete=`), `storeMilestone`, the forum's `publishPost`, `updatePost`, `setReaction`, `flagPost`, `setPreferences`, and `previewPost` |
| Shells | The Issues tab of a repository (when issues are on) and of a group, with the open count `findIssues` answers for the caller. CommitDetail lists the issues its commit names; one the caller may not see is in "items not shown" only |
| Caching | No issue page (`-/issues…`, `-/labels`, `-/milestones…`) and no commit page (`-/commit/<id>`, which lists the titles of its issues) is kept by a cache, for a visitor either (`Shared/Headers.js`), since an issue may become confidential after a cache kept its page. The shells' Issues tab has its count only for a signed-in account, so a publicly cached shell carries none |
| Forum composer | `Forum/Compose.qvue` has "Write in": rich text or Markdown (a textarea), sent as `sourceFormat` on publish and on preview (`Compose.xml` preview takes the schema's fields) |
| Registries | `SmithySchema.js` and `Routes.js` are copies of Mantle's with the 15 DG3 operations (68 Smithy operations), `Schema.js` of `ForumSchema.js` with `sourceFormat` |
| Labels and Milestones | `RepositoryDetail/Labels`: each label with its colour (one of the names Projects' labels have), description and open count; a Maintainer adds, edits and deletes the repository's own (a label of the organization's, `editable` false, is shown without them). `RepositoryDetail/Milestones`: open and closed with the due date and the share closed, one milestone with its issues; a Maintainer adds, edits and closes |
| BOSS | Projects' WorkItemDetail (`mr-boss` `screen/Shared/WorkItemDetail.xml`, `get#WorkItemDetail`'s `issue`) shows `#<n>` beside the key, linked to the public page (the site's canonical host and Smithy mount), and a Public conversation box with the posts Mantle's `get#Posts` gives the user, apart from Chatter; the Edit dialog does not offer the description of a task that is an issue. The issue comes from Mantle's `get#TaskIssue`. A confidential issue's task (`get#VisibleProjectInfo` `hiddenItemIds`) is left out of BOSS's own reads of tasks through `service/ironstone/projects/HiddenItems.js` (mr-boss `plan/impl-projects.md` §10) |
| Tests | `test/Smithy/Smithy.spec.js` (the DG3 paths; one render each of Issues, IssueDetail and NewIssue; a create through `Do`, its refusal, an unconfirmed account and a preview; a commit's linked issue on the CommitDetail render), `SmithyAccess.spec.js` (a confidential issue on its page by caller, with no screen rendered, and triage by role), `test/Forum/Forum.spec.js` (a Markdown post through Compose's publish), mr-boss `test/Projects/WorkItemDetail.spec.js` (an issue's task; a confidential issue's task hidden from the project's manager). Acceptance: `SmithyWalk` files an issue in the island (the toggle, the preview), edits its text and closes it, and has the issue pages in its 390 px list |

Differences from the design:

- NewIssue has a preview without JavaScript (the design has none there): the Preview button posts the form to
  `Do/previewPost`.
- The island is the text's editor only (the toggle and the preview). It has no mentions, uploads or drafts, and
  IssueDetail has no post stream island: the conversation is the server's pages.
- The island is not Forum's `Compose.qvue` with a Markdown mode but a component of its own, since it edits the text of
  a plain form that is posted to `Do`.
- An issue page is `no-store` for a visitor too; DG1's read pages are public for a minute.
- Assignees are chosen from `findAssignees`' handles (a text field of handles on NewIssue).
- A merge request linked to an issue is shown as text until DG4 builds its page.
- The forum's own topic page has no reply form without JavaScript, so nothing there takes Markdown; its composer does.
- A refusal of the gate for posting too soon or too often shows PASS's text for its kind ("Too many attempts…"), not the
  gate's own sentence.
- The Issues tab's count is one more `findIssues` call on each page of a group, and of a repository with issues on,
  for a signed-in account; a visitor's tab has no count.
- Forum composer: a post the Discourse import wrote has a Markdown revision whose source is the source site's raw text,
  and `getEditablePost` answers nothing that tells it from a post written in Markdown here. So such a post now opens
  in the composer's Markdown mode with that raw text, where before it opened as its cleaned HTML in rich text. Telling
  them apart needs a mark from Mantle (the import's map of posts).
- Forum composer: there is no compose form without JavaScript (`Shared/Compose.html.fancy` says so), so none sends a
  format. A browser recovery copy kept before the composer had Markdown is rich text: it is restored as rich text,
  as the post's own format when it is the post's unchanged text, and not kept when the post is Markdown now.
- A group's "New issue in" lists a hundred repositories by name, with a text filter for a group that has more.

Not built: attachments on an issue or a comment; a post's history page and bookmarks in Smithy; `markRead`; the linked
discussion (built in DG6); the group's issue repository in GroupSettings; a sort or filter by reaction; `SmithyAccessWalk` and
`SmithyPhone`.


## DG4: merge requests, forks, editing, the agreement

| Area | Implementation |
| --- | --- |
| Routes | `SmithyRoutes.js` routes a repository's `-/merge-requests`, `-/merge-requests/new`, `-/merge-requests/<n>` and its `/commits`, `/changes`, `/checks`, `-/fork` and `-/forks`, `-/edit/<refPath>`, `-/new/<refPath>`, `-/upload/<refPath>`, `-/delete/<refPath>`, the Agreement tab of a group's and a repository's Settings, and the islands `-/island/DiffReview.qvue` and `-/island/Editor.qvue` (`.qvt`, `.qjs`). The grammar had them; `compare/<base>...<fork-path>:<ref>` was DG1's |
| Pages | `screen/Smithy/SmithyReview.js` builds them as escaped markup with `SmithyForms.js`'s helpers and `SmithyIssues.js`'s conversation: `RepositoryDetail/MergeRequests`, `NewMergeRequest` (in the repository's shell), `MergeRequestDetail` (the shell, the merge request's head and its tabs) with `Overview`, `Commits`, `Changes` and `Checks`, `RepositoryDetail/Fork`, `RepositoryDetail/Edit`, and the Agreement tab. A repository with merge requests off has none of the merge request pages and no tab |
| MergeRequests | Open, Merged and Closed with the counts `findMergeRequests` answers, a GET form of filters (text, author, reviewer, target branch, drafts only), More by cursor. A row has the number, title, state, source (a fork's path before its branch, or "pushed for review") and target, the checks' state, approvals, the agreement's mark and comments |
| NewMergeRequest | A GET form of the target branch and the source (`group/repository:branch` for a fork's), then `getCompare`'s commits, file count and whether it merges cleanly, and the form: title (the oldest commit's summary), a Markdown text with a preview and the composer's island, draft, and reviewers for who may review. A fork's page points to its parent's form with the fork's branch as the source. Opened from Compare ("Open a merge request" when the head is ahead) and from a branch's row |
| Overview | `getMergeRequest`, then the conversation as on an issue (`getPosts` of its record topic; reply, edit, report, reactions, the watch level). The review form (Comment; Approve and Request changes by `canApprove`) is `submitReview`. Beside them: the title and Draft (`updateMergeRequest`), reviewers and their decisions (`setMergeRequestReviewers`), the checks of the head with links and "Required", the agreement box (Signed, or who is missing what, the file's Contributing section, Sign, Check again, a bot's operator), linked issues, the fetch line, and the merge box. Close is asked again on `?confirm=close`, Reopen is not |
| Merge box | For `canMerge`: the methods the branch rule allows, a message and "Delete the source branch" (a branch of this repository only), a GET form to `?confirm=merge`, which names the target branch, the method, what happens to the source branch and what is not ready, and posts `mergeMergeRequest` with the head it saw. For anyone else a sentence. Both list why a merge would be refused: a draft, conflicts (with the paths) and the authority's reasons (`missingList`: required checks not passed, approvals missing, the agreement not signed); the squash that would fold a signature is said under the method and refused by the authority on the post. Who may not merge reads the role the branch asks for (`branchRules.mergeRole`) |
| Changes | `getMergeRequestChanges` with diffs, rendered here: each file's diff as escaped lines (from the host's hunks, which are data; its own markup is not used), every line with its number, an anchor (`F<file>R<new line>` or `L<old line>`) and, for who may comment, the number as a link (`?line=`) that shows that line's comment form under it (`createReviewComment`). A thread is under its line with its posts cleaned, a reply form and Resolve or Reopen (`resolveReviewThread`); an outdated or resolved thread is folded (a `details`); an outdated one, and one whose line is not in the shown diff, is above its file's diff. A large diff shows a file's changes on `?path=`. The review form is here too |
| DiffReview island | `Islands/DiffReview.qvue`, with `/js/WebrootCode.js` in the page's scripts before `WebrootPublic.qvt.js`: a click on a line's number opens the comment form in place (an ordinary form, posted as the plain one), and "Side by side" shows a file in `m-diff-view` from its raw texts at the merge base and the head (`-/raw/<commit>/<path>`) |
| Fork | `-/fork`: namespace (the account's own, or a group of `findGroups` `mine`), path, name and visibility no wider than the parent; the page names the source and is the confirmation (`forkRepository`). `-/forks`: `findForks`, each with Compare. The shell has Fork for a signed-in account, the forks count and "Forked from"; Compare links a fork to its parent's comparison |
| Edit | `getEditContext`, then three views of one page, chosen by what the last step left in the session (the flash): the editor (the path, which renames when changed, and the text in a textarea; Preview for Markdown through `previewPost`), the save step (the commit message with a default by action, the destinations with the default first, the new branch's name, the merge request's title; the text and the blob it started from carried in the form), and the conflict of an edit (the file now beside the caller's text; keep editing, save over it, or discard). A new file at a path that has a file is told so on the save step; an upload to such a path says it replaces the file and names the blob that is there. A flash is the page's only when its repository, branch and path are the page's; the step reads `getEditContext` first, so it keeps nothing for who may not edit there, and refuses a text over the site's edit size without keeping it. Every textarea writes a newline after its tag, so a text's own first newline survives the HTML parser. `editFile` is the step between them: a transition of `Do` that is no operation and stores nothing but the flash. `commitFile` saves, and answers the file's page or the new merge request. Delete is the save step alone. Upload stages its file in the step (`stageAttachment` with the purpose `repositoryFile` and the repository) and names the attachment in the save; an empty path, or one ending in a slash, takes the file's own name. A file that is not editable says why in words (`getEditContext`'s `reason`) |
| Editor island | `Islands/Editor.qvue`: `m-code-editor` over the plain textarea, which stays the form's field, with the language of the path |
| Sign | The agreement box's Sign opens the edit page of the agreement's file with `?sign=<n>`: the page `getMergeRequest`'s `signPath` names for the caller: the source branch (a fork's too) for the author who may commit there, so the signature is a commit of the merge request, else the target branch, where the save of an account that may not push is a proposal (the author's own goes to the same merge request, another account's opens one). The box says what each author is missing in words, and where a bot's operator stands. The page shows how to sign when it is reached so or when `getEditContext` says `agreementFile`: the account's own line under both lists, with the handle shown and no legal name written |
| Settings | Agreement tab of `GroupDetail/Settings` and `RepositoryDetail/Settings` for an Owner (`getAgreement`, `setAgreement`): inherit, off or required, the file, what is in effect and from where, and how many branch rules change. Merge requests on or off was already General's (DG2) |
| Commit pages | CommitDetail shows "Contained in" (`getCommit.refList`), the merge requests of the commit when the read gives them, and the author's handle where `commit.authorHandle` is given (Commits, Compare and a merge request's Commits too). A merge request on an issue is a link |
| Forms | `Do.xml` has 15 more `post` transitions (60): `createMergeRequest`, `updateMergeRequest`, `setMergeRequestReviewers`, `submitReview`, `createReviewComment`, `resolveReviewThread`, `setMergeRequestState` (a close confirmed), `mergeMergeRequest` (confirmed), `forkRepository`, `editFile` (a step), `commitFile`, `setAgreement`, `recheckAgreement`, `declareBotOperator`, `confirmBotOperator` |
| Redirects | A page's redirect is answered in `pre-actions`, before the shell is written: Files' ref picker and a tree path that is a file (`RepositoryDetail/Files.xml`), and Compare's form (`Compare.xml`), as the group's New issue was in DG3. In `actions` the shell had been written already, so the redirect did not reach the browser |
| Caching | The merge request, edit and fork pages are `no-store` for a visitor too (`Shared/Headers.js`); the Merge requests tab has its count only for a signed-in account |
| Compare | DG1's Compare shows a comparison's diff again: the host gives it as hunks, not as unified text, and `Smithy.js` `changedFiles` writes the unified text from them |
| Markup | `SmithyForms.js` `h` knows the markup it built by a symbol (`Symbol.for`), not by its class: each page script loads its own copy of `SmithyForms.js`, so markup made in `SmithyIssues.js` was escaped as text when `SmithyReview.js` wrote it |
| Tests | `test/Smithy/SmithyReview.spec.js` (one render each of MergeRequests, Overview, Changes, Edit and its save step; a save through `Do` to the branch, to a new branch with a merge request, as a proposal, the conflict, and a staged upload), `Smithy.spec.js` (the DG4 paths, with a fork's head whose ref has a slash; the registries), `SmithyAccess.spec.js` (the DG4 rules). Acceptance: `test/acceptance/client/SmithyContribution.spec.js` with `test/acceptance/SmithyContributionFixtures.spec.js` (below) |

Differences from the design:

- A new line comment works without JavaScript (the design gives it to the island alone): a line's number links to the
  page with that line's form.
- The DiffReview island is not a second rendering of the diff on the model of Projects' `Changes.qvue`. It works on the
  server's diff: the comment form in place and one file side by side. It has no file tree and no pending review that is
  submitted at once (`submitReview`'s `commentList` is not sent); a line comment is posted when written. A phone has the
  same unified diff.
- Signing is the file's edit (§9.5) with instructions, not `signAgreement`: the account types its line. `signAgreement`
  has no form.
- The save is two pages without JavaScript and with it (the island is the editor only, not a dialog), and the text
  between them is kept in the session, as a preview is.
- A merge request's text is edited as its first post is (the conversation's Edit); `updateMergeRequest` here changes
  the title and Draft. The target branch is not changed on the page.
- Close is confirmed as a merge is; "delete the source branch" is part of the merge's confirmation, not a step of its
  own.
- Rename has no path of its own: it is Edit with the path changed.
- MergeRequestChecks shows the statuses alone until DG5 (no pipeline runs).
- The review form's summary is a plain Markdown textarea with no preview: a page has one composer island, and the
  comment form has it.

- `SmithyContribution` makes no `git push`, to a fork or to `refs/for/`: a client spec is a pure client with no git.
  What it shows instead: the fork's commits are saves on the fork's own pages (an edit, an upload and the signature,
  each `commitFile` to the branch, which is the framework's `commit#GitFiles`), and the merge request "pushed for
  review" is made by the fixtures through `commitFile` with the proposal destination (`commit#GitFiles` `asProposal`).
  A real push to a fork and to `refs/for/<branch>` is covered by the framework's git-client tests only
  (`crates/moqui-git`), not by anything in mr-pass. The outside accounts have a forum state past their first posts,
  so the post gate does not hold their merge requests; a held one's page is SmithyAccess's.
- What the walk does show, in a browser: fork on the page; an edit, an upload and Sign in the fork; the merge request
  from the fork; "Not signed" and then "Signed"; a line comment opened in place and a file side by side (DiffReview);
  a Maintainer's merge after the confirmation; the fixtures' merge request listed as pushed for review with its fetch
  line; a third account's edit in the code editor (Editor) saved as a proposal; and the redirects of Files and Compare
  over HTTP, with `no-store`. Its 390 px check covers, as that third account (a viewer with no role): the merge request
  list, one merge request's Overview, Commits, Changes and Checks, the new merge request form, Fork, Forks, and the
  Edit, New file, Upload and Delete pages. It does not cover the settings' Agreement tab, the merge and close
  confirmations, or any page as a Maintainer at that width.

Not built: `signAgreement`'s form; the forum's post stream island on Overview; thread excerpts in the conversation; the
file tree (`m-file-tree`) on Changes; attachments; a group's merge request list; `SmithyAccessWalk` and `SmithyPhone`
as specs of their own (`SmithyContribution` checks this phase's pages at 390 px).

## DG6: the forum inside Smithy, the lists, moderation in a scope

| Area | Implementation |
| --- | --- |
| Scope and link base | `Shared/View.js` `load` takes a **scope** (`{contactListId, base, moderationBase, enabled, canModerate, name}`; null on the site's own forum) after the identity. With a scope, links are built from `scope.base` where they were built from `bases.forum` (a topic, a post, a tag, a category, a draft, a post's history) and a review's from `scope.moderationBase`, and the reads that take one are given `scopeContactListId` (`findTopics`, `findCategories`, `searchForum`, `findTags`, `getTopic`, `findReviews`, `findActions`; `inputFor` sends it to the operations whose schema has it). A category asked for inside a scope must be in its subtree (`requireInScope`, by `findCategories` with the scope), and a topic of another category is Not Found there (`getTopic` with the scope). `Page.html.fancy` and `TopicEnhance.html.fancy` take the link base from the screen's `forumScope` (the enhanced stream's `forumBase` too), `Post.xml` and `TopicDetail.xml` redirect within it, Compose's `state` offers the scope's categories with the scope's own chosen for a new topic, and the feed is the scope's (`getFeed` with the scope). `Pass.xml` sets `forumScope` to null for every request; the shell that mounts the forum sets it |
| The forum in a shell | `GroupDetail.xml` and `RepositoryDetail.xml` mount the forum's own root screen (`Forum.xml`) as their `Forum` subscreen, so `/<group>/-/forum[/…]` and `/<group>/<repo>/-/forum[/…]` are the forum's own screens (Topics, a topic with its enhanced stream and its forms, Categories, a category, Tags, Search, Compose with its island, a post's permalink, a post's history, the feed), with every transition at its own place, inside the group's or the repository's shell with the Forum tab. `Forum.xml` shows the forum's navigation for the scope (Topics, Categories, Tags, Search, New topic, Moderation, RSS). The page's title is an `h2` there, under the shell's `h1`. A group or a repository whose forum is off has no Forum tab and its forum pages are Not Found. `/forum` is unchanged |
| Routes | `SmithyRoutes.js` `forumSection` maps the rest of the path after `-/forum` as the forum's own resolver maps a path after its mount: `t/<id>/<slug>[.qvue][/<transition>]` (with `topicId` and `topicSlug` as the resolver's own outputs), `p/<id>` (`postId`), `feed`, and a screen of the forum that has a scope (Topics, Topics/List, Topics/TopicDetail, Topics/PostHistory, Categories, Categories/List, Categories/CategoryDetail, Tags, Search, Compose), then at most a transition's name. The forum's other screens (Messages, Drafts, Bookmarks, Guidelines, Settings, Moderation, Reports) stay the site's and are Not Found under a scope. `moderationSection` maps `-/moderation[/ReviewQueue|ReviewDetail|MemberDetail|Log[/<transition>]]`, `-/moderation/report` and `-/moderation/hide`. `-/held-report/<token>` is `Smithy/Do/heldReport`. The Forum tab of a group's and a repository's Settings is routed. `pass.RouteServices.resolve#Route` also routes the forum's `held-mail/<token>[/claim]` |
| Canonical | A topic read inside a scope has the site forum's address as its one canonical (`<link rel="canonical">` to `/forum/t/<id>/<slug>`) where the site mounts the forum; the scoped page is not redirected there, and a wrong slug redirects within the scope. On a site with no forum mount the canonical is the scope's own address |
| Shells | `Smithy.js` `scopesOf`: `forumScope` (the read's `forum.contactListId` and `enabled`) and `moderationScope` (`forum.moderationContactListId`, for the scope's Owners and the site's staff; a repository with no category of its own has its group's). Tabs: Forum when it is on; Moderation for who has the moderation scope. A hidden group or repository has a Hidden chip and a sentence for those who still see it (everyone else gets Mantle's Not Found). A signed-in account has "Report this group/repository", and who may hide (`capabilities.canHide`) "Hide it" or "Show it again" beside it |
| Settings: Forum | The `forum` tab of `GroupDetail/Settings` and `RepositoryDetail/Settings` for an Owner (`SmithyScope.js` `forumSettings`): the forum on or off (`setScopeForum`; a repository's makes its subcategory), linking an existing category by its id, and the sentence that the category's readers follow the group's or the repository's visibility. Once on: the mailing list (below). For a group: the address for security reports (`storeIssueMailRoute`: the address, the repository that takes the reports, on or off for the site's staff; the present route from `getGroup`'s `forum.issueMailRoute`) |
| Mailing lists | On the Forum tab of a scope whose forum is on. For an owner of the site: the category's mode (`storeCategory` `mode`: discussion, questions, list) and the list's address (`findRoutes`, `storeRoute` with the category); a scope's Owner who is no owner of the site reads which it is. For a list: **Import an archive** (`importMbox` by the name and SHA-256 of an mbox file in the server's import directory; the start leads to `?importId=`, which shows the run's stage and its report from `getMboxImport`: messages, topics, replies, already there, attachments left out, unknown character set, too long, empty, unreadable, failed; starting the same file again resumes it) and **Invite the list's members** (`inviteListMembers` with addresses pasted, up to 500; the answer's counts are the notice). The held-message sentence names the review queue |
| Invitation and held mail | A list invitation's link is `Account/Invitation` (Mantle's `redeemInvitation` subscribes the account to the list); for a visitor the page now says to sign in with the invited address, or to register with it, and accept. `Forum/HeldMail` (`<forum>/held-mail/<token>`) is the page of a held list message's link: a visitor is asked to sign in or register and come back, an account posts the message with a form (`claim`, `claimHeldMail`), and a used or expired link says so |
| Moderation in a scope | `Smithy/Moderation.xml` mounts the forum's own `ReviewQueue`, `ReviewDetail`, `MemberDetail` and `Log` screens, in the group's or the repository's shell, with the moderation scope and its link base, for who has the scope (`SmithyScope.js` `moderation`); anyone else gets Not Found. `View.js` gives the review queue and the log the scope, or one category of it (`?contactListId=`, checked to be in the scope). A review of a reported repository or group shows where it is and what each decision does (`getReview`'s `target`; rejected hides it); a held message's review shows who sent it, its subject and until when it waits (`held`), with its text in the item's detail |
| Report and Hide | `Smithy/Moderation/Report` (`-/moderation/report`): a confirmed account reports the group or the repository with a reason and a note (`reportSmithyTarget`), and returns to its page. `Smithy/Moderation/Hide` (`-/moderation/hide`): the confirmation of Hide and of showing again, which names the target and what follows and takes a reason (`hideSmithyTarget`, refused by its transition without that page's answer); Not Found for who may not hide. Linked from the shell, a repository's Archive tab and a group's Delete tab |
| Held report | `-/held-report/<token>` is the GET transition `heldReport` of `Smithy/Do`: a whole page in the site's shell (the shared header and footer templates), `no-store`, that writes nothing. A visitor gets Sign in (and Register where registration is open) with the link as the return address; an account gets a form that posts `claimHeldReport` with the session token and goes to the confidential issue; a refused claim returns to the page, which says a link is used or gone |
| A topic made an issue | A topic shown in a scope has "Make an issue" for a role that may triage (`SmithyScope.js` `topicTools`, a section of `Forum/Topics/TopicDetail.xml` shown in a scope alone): the repository (the scope's, or the group's repositories with issues on), the title, the posts to quote, Confidential; `convertTopicToIssue` goes to the new issue. The topic's Related card shows the issue as a link (`getTopicLinks`' `path`), and the issue's page a Discussion card (`issue.discussion`) |
| Link cards | A topic's Related lists an issue, a merge request and a release with its page's link where the read gives one. A merge request's Overview has the Discussion card when `getMergeRequest` gives a `discussion`. Releases have no page yet (DG7) |
| Forms | `Do.xml` has 10 more `post` transitions (70): `setScopeForum`, `reportSmithyTarget`, `hideSmithyTarget` (confirmed), `convertTopicToIssue`, `storeIssueMailRoute`, `claimHeldReport`, and the forum's `storeCategory`, `storeRoute`, `importMbox` and `inviteListMembers`; and the one GET, `heldReport`. A form's `done` is given the operation's input |
| Caching | `Shared/Headers.js`: the forum's pages inside a shell and the scope's moderation pages are `no-store` for a visitor too, as the forum's own are |
| Not Found | A group's and a repository's Settings, Report and Hide build their page in `pre-actions`, and Moderation checks its caller in `always-actions`: who may not see one gets the framework's Not Found (404) before any of the shell is written. Until now a Settings page refused in `actions`, after the shell, and the answer was an error page with the shell's start |
| Registries | `SmithySchema.js` and `Routes.js` are copies of Mantle's with the 6 DG6 operations (95 Smithy operations), `Schema.js` of `ForumSchema.js` with `scopeContactListId` and the four list operations |
| Tests | `test/Smithy/Smithy.spec.js` (the DG6 paths; one render of the forum's topic list inside a group's shell; a held report's page, a refused claim and the sender's claim through `Do`; Report and Hide through `Do`; a topic made an issue through `Do` and the issue's Discussion card; the registries and the cache policy), `SmithyAccess.spec.js` (moderation in a scope is its Owners': the page's own rule and the queue's read, with no screen rendered). Acceptance: `SmithyWalk` has a second feature (below) |

Differences from the design:

- The forum's screens are mounted under the shells, so a scoped page's screen path is
  `/Smithy/GroupDetail/Forum/<the forum's own screen path>` (the design has one screen `Smithy/GroupDetail/Forum` with
  `forumPath`); `forumPath` is still a screen parameter. `Smithy/Moderation` is likewise the shell with the forum's
  moderation screens under it.
- `-/moderation/report` and `-/moderation/hide` are added to the grammar (the design names no path for Report's form and
  Hide's confirmation). Report and Hide are links under the shell's tabs, not an overflow menu. Hide is not a control of
  ReviewDetail itself: the decision "rejected" hides, as Mantle's `decideReview` does it, and the page says so.
- A group's tabs have Moderation (the design has it under no tab), for who moderates the scope; a repository's too.
- `heldReport` is a GET that shows a page and writes nothing; the claim is the page's form (the design's link "files the
  report"). So a mail scanner that follows the link files nothing, and the claim has the session token.
- The archive is not uploaded on the page: as the Discourse import does, the operator puts the file in
  `pass_import_dir` and the page names it with its checksum (Mantle's `importMbox`). Resume is starting the same file
  again; there is no list of a category's past runs (Mantle has no read of them), so a run is reached by its start's
  redirect or its `?importId=` address.
- Invitations: addresses are pasted, 500 at a time, with no file upload; there are no standing counts of invited and
  confirmed and no "send again" (Mantle's `inviteListMembers` answers the counts of one call and skips an address with
  an open invitation; an invitation lasts 14 days, after which the same address is invited again).
- The invitation is not one click for a new person: the link leads to `Account/Invitation`, where the person signs in
  or registers with the invited address and accepts.
- A list's mode and address are set by an owner of the site (Mantle's `storeCategory` and `storeRoute`), not by a
  scope's Owner who is only that; the import and the invitations are the scope Owner's.
- One canonical a topic only where the site mounts the forum. With no `/forum` mount a topic of a repository's
  subcategory is read at the repository's and at its group's forum address, each its own canonical: Mantle does not
  say which scope is a topic's nearest.
- The scope's forum has no page for Messages, Drafts, Bookmarks and Guidelines; those are the site forum's, and are
  reached only where the site mounts it.

Acceptance: `SmithyWalk`'s second feature, at 390 px on `SmithyWalkFixtures`' group with its forum on: the group's
forum and a topic are read (the enhanced stream takes the server's posts' place, its links the scope's, its canonical
the site forum's, no sideways scroll); an account with a confirmed address and no role writes a topic in the scope's
composer, which has the group's category chosen and no other, and lands on the scope's topic page; it opens the report
form from the repository's page; and it gets Not Found for the scope's moderation and the Forum tab of the settings.
The report's post is the server spec's: an account's posts are ten seconds apart, and a walk does not wait.

Not built: a render of the scope's moderation pages and of the settings' Forum tab in a spec (checked by hand in a
scratch spec, which is not kept); the phone width of the moderation, Report, Hide and settings pages; a group's or a
repository's forum on a remote PASS frontend (D1: Smithy runs where the git data is); `SmithyAccessWalk` and
`SmithyPhone` as specs of their own.
