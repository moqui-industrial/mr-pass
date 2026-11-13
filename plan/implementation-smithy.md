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

Not built: Blame and archive download (they refuse with `notBuilt` until the framework has the services), syntax
highlighting and the tree and diff islands, the client walk (`SmithyWalk`), a page rendered on a root mount in a
spec.
