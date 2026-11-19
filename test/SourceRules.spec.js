// OWASP ASVS 5.0.0, PASS's in-process proofs of rules that only a reading of its code shows (docs/ASVS-Matrix.md, V5 and
// V15): the scripts of mr-pass (service/, screen/: its .js and .qvue files) and of the Mantle services PASS's operations
// reach (mr-mantle script/ and service/mantle/ forum, smithy, public, product, order, party, request, account and
// marketing, the packages of every service service/pass/Schema.js and SmithySchema.js name). Each file is read once.
const ROOTS = [
    'component://mr-pass/service',
    'component://mr-pass/screen',
    'component://mr-mantle/script',
    ...['forum', 'smithy', 'public', 'product', 'order', 'party', 'request', 'account', 'marketing'].map(
        (dir) => 'component://mr-mantle/service/mantle/' + dir,
    ),
]
let sources = null
const read = () => {
    if (sources) return sources
    sources = []
    const walk = (ref, path) => {
        for (const entry of Array.from(ref.getDirectoryEntries())) {
            const name = path + '/' + entry.getFileName()
            if (entry.isDirectory()) walk(entry, name)
            else if (/\.(?:js|qvue)$/.test(name)) sources.push({ path: name, text: entry.getText() })
        }
    }
    for (const root of ROOTS) walk(ec.resource.getLocationReference(root), root.replace('component://', ''))
    return sources
}
const lineOf = (text, index) => text.slice(0, index).split('\n').length

// v5.0.0-15.3.5: JavaScript's == and != convert their operands' types before comparing ('0' == 0, [x] == 'x'); PASS's
// scripts compare with === and !== only, but against null, where == null is the one comparison that also takes
// undefined, by intent. An occurrence is named by its file and line. The scope is the matrix row's: mr-pass's scripts and
// Mantle's PASS packages (script/, forum, smithy, public), where PASS's own logic is.
// Does not prove: the other Mantle packages a PASS operation reaches (Shop's, Billing's, Support's, Sales' and
// Marketing's services; account/InvoiceMatch.js has one numeric compare() == 0), the .html.fancy templates' conditions,
// which choose what a page shows (a selected option, a plural), nor the XML actions' few conditions
// (SupportCaseServices.xml, ThemeServices.xml); an input's type is the operation schema's field check and each service's
// own (Number(), String()).
const STRICT_SCOPE = /^mr-pass\/|^mr-mantle\/script\/|^mr-mantle\/service\/mantle\/(?:forum|smithy|public)\//
feature("v5.0.0-15.3.5: PASS's scripts compare strictly: no loose == or != but against null", {
    when() {
        const loose = []
        let bytes = 0
        for (const { path, text } of read().filter(({ path }) => STRICT_SCOPE.test(path))) {
            bytes += text.length
            for (const op of ['==', '!=']) {
                for (let at = text.indexOf(op); at >= 0; at = text.indexOf(op, at + 2)) {
                    // === and !== are strict; <=, >= and => are no equality
                    if ('=!<>'.includes(text[at - 1] || ' ') || text[at + 2] === '=') continue
                    // an entity condition's operator, written as a string ("!=")
                    if (`"'`.includes(text[at - 1] || ' ') && text[at + 2] === text[at - 1]) continue
                    if (/\bnull\s*$/.test(text.slice(Math.max(0, at - 12), at)) || /^\s*null\b/.test(text.slice(at + 2, at + 14)))
                        continue
                    loose.push(path + ':' + lineOf(text, at) + ' ' + text.slice(Math.max(0, at - 30), at + 30).trim())
                }
            }
        }
        return { files: read().filter(({ path }) => STRICT_SCOPE.test(path)).length, bytes, loose }
    },
    then({ files, bytes, loose }) {
        // the control: the scan read the scripts
        files > 60
        bytes > 2000000
        loose.length === 0
    },
})

// v5.0.0-5.2.3: PASS expands no archive a visitor sends: of the scripts above only two unpack one, the Forum import's
// stage#Import (an operator's Discourse backup, from pass@import-dir only: mr-pass Import "an operator registers a
// checksummed archive from the import directory only") and the theme package import of Commerce's staff, which passes
// its own bounds (the package's byte and file limits) and is no PASS operation. A visitor's upload is stored as it came
// (Forum.js stageAttachment), and an image's thumbnail is decoded, not unpacked.
// Does not prove: limits checked before the operator's archive is unpacked: stage#Import passes none, so the framework's
// apply while unpacking (4 GiB and 1,000,000 entries, script/host/archive.rs, the framework's 5.2.3 Gap).
feature("v5.0.0-5.2.3: PASS unpacks no archive a visitor sends, only an operator's import", {
    when() {
        const unpacking = read()
            .filter(({ text }) => ['extractArchive(', 'gunzip(', 'unzip(', 'readZip(', 'extractZip('].some((call) => text.includes(call)))
            .map(({ path }) => path)
        const theme = read().find(({ path }) => path.endsWith('/ThemeAuthoring.js'))?.text ?? ''
        const schemas = read()
            .filter(({ path }) => /mr-pass\/service\/pass\/(?:Smithy)?Schema\.js$/.test(path))
            .map(({ text }) => text)
            .join('\n')
        return {
            unpacking,
            themeBounded: /extractArchive\([^{}]{0,80}\{\s*maxBytes:[^}]*maxEntries:/.test(theme),
            themeImportOperation: /ThemeServices\.import#/.test(schemas),
            importOperation: /ImportServices\.stage#Import/.test(schemas),
        }
    },
    then({ unpacking, themeBounded, themeImportOperation, importOperation }) {
        unpacking.length === 2
        unpacking.some((path) => path.endsWith('mr-mantle/service/mantle/forum/ForumImport.js'))
        unpacking.some((path) => path.endsWith('mr-mantle/service/mantle/public/ThemeAuthoring.js'))
        themeBounded
        !themeImportOperation
        // the control: the scan sees the operator import's operation in PASS's schema
        importOperation
    },
})
