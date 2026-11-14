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
