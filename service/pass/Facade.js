/* PASS owns presentation and one configured authority, never a business replica: in process when pass_backend_url is
   empty, else over REST or gRPC (Transport.js). */
// Smithy's operations are in their own file, a copy of Mantle's SmithySchema.js (plan/design-smithy.md §4.1), as Schema.js is
// of its ForumSchema.js; a name is in one of the two
const schema = {
    ...ec.resource.script('component://mr-pass/service/pass/Schema.js'),
    ...ec.resource.script('component://mr-pass/service/pass/SmithySchema.js'),
}
const fail = (kind, text) => {
    const e = new Error(text)
    e.moquiErrorKind = kind
    throw e
}
/* The remote transports, REST and gRPC, behind one set of functions (Transport.js). */
const transport = () =>
    ec.resource.script('component://mr-pass/service/pass/Transport.js')
const statusKind = (status) => transport().statusKind(status)
/* The REST client of an authority path (Transport.js), kept for callers of the REST API. */
const authorityClient = (siteId, path, method) =>
    transport().authorityClient(siteId, path, method)
function call(operation, input) {
    const def = schema[operation]
    if (!def || Object.keys(input).some((k) => !def.fields.includes(k)))
        fail('Unprocessable', 'Unsupported operation or input')
    const backend = System.getProperty('pass_backend_url')
    if (!backend)
        return ec.service
            .sync()
            .throwOnError(true)
            .name(def.service)
            .parameters({ input })
            .call().result
    return transport().call(operation, input, def)
}
function download(siteId, attachmentId, variant) {
    const backend = System.getProperty('pass_backend_url')
    if (!backend) {
        const result = call('getAttachment', {
            siteId,
            attachmentId,
            ...(variant ? { variant } : {}),
        })
        ec.web.response.setContentType(result.attachment.mimeType)
        ec.web.response.setHeader('Cache-Control', 'no-store')
        ec.web.response.setHeader('X-Content-Type-Options', 'nosniff')
        ec.web.response.setHeader(
            'Content-Disposition',
            (result.attachment.variant === 'thumbnail'
                ? 'inline'
                : 'attachment') +
                '; filename="' +
                String(result.attachment.filename).replace(/["\\\r\n]/g, '_') +
                '"',
        )
        const stream = ec.resource
            .getLocationReference(result.location)
            .openStream()
        try {
            ec.web.response.write(stream.readAllBytes())
        } finally {
            stream.close()
        }
        return
    }
    transport().download(siteId, attachmentId, variant)
}
/* An export or report download: the authority rechecks the requester and the expiry. */
function downloadExport(siteId, exportId) {
    const backend = System.getProperty('pass_backend_url')
    if (!backend) {
        const result = call('getExport', { siteId, exportId })
        ec.web.response.setContentType(result.export.mimeType)
        ec.web.response.setHeader('Cache-Control', 'no-store')
        ec.web.response.setHeader('X-Content-Type-Options', 'nosniff')
        ec.web.response.setHeader(
            'Content-Disposition',
            'attachment; filename="' +
                String(result.export.filename).replace(/["\\\r\n]/g, '_') +
                '"',
        )
        const stream = ec.resource
            .getLocationReference(result.location)
            .openStream()
        try {
            ec.web.response.write(stream.readAllBytes())
        } finally {
            stream.close()
        }
        return
    }
    transport().downloadExport(siteId, exportId)
}
/* A file an operation answers, rechecked by the authority (the Support app's case file and return label; Customer Service
   P15): its result's file and, in process, its location. */
function downloadFile(siteId, operation, input) {
    const backend = System.getProperty('pass_backend_url')
    if (!backend) {
        const result = call(operation, { siteId, ...input })
        // the authority checked the asker; the file is read as the authority reads it (a record's content may sit in the
        // database resource store, which a public account may not read itself), before anything is written
        const wasDisabled = ec.artifactExecution.disableAuthz()
        let bytes
        try {
            const stream = ec.resource
                .getLocationReference(result.location)
                .openStream()
            try {
                bytes = stream.readAllBytes()
            } finally {
                stream.close()
            }
        } finally {
            if (!wasDisabled) ec.artifactExecution.enableAuthz()
        }
        ec.web.response.setContentType(result.file.mimeType)
        // Shop P8 (F75): the authority lets a public product image of the current generation be kept a minute; else no-store
        ec.web.response.setHeader(
            'Cache-Control',
            result.file.cacheControl === 'public, max-age=60' ? result.file.cacheControl : 'no-store',
        )
        ec.web.response.setHeader('X-Content-Type-Options', 'nosniff')
        ec.web.response.setHeader(
            'Content-Disposition',
            'attachment; filename="' +
                String(result.file.filename).replace(/["\\\r\n]/g, '_') +
                '"',
        )
        ec.web.response.write(bytes)
        return
    }
    transport().downloadOperation(siteId, operation, { siteId, ...input })
}
/* The bytes a ranged download reads and writes at a time. */
const RANGE_WINDOW = 1024 * 1024
/* A granted download (impl-shop P6): the browser's byte range asked of the authority, which rechecks the grant and its
   capability, and the file streamed with it: in process only its range read (206, or 416 outside it), through a remote
   frontend the authority's own ranged answer forwarded (REST or gRPC). */
function downloadRanged(siteId, operation, input) {
    const range = String(ec.web.request.getHeader('Range') || '').trim()
    const asked = {
        siteId,
        ...input,
        ...(/^bytes=\d*-\d*$/.test(range) ? { range } : {}),
    }
    if (System.getProperty('pass_backend_url'))
        return transport().downloadOperation(siteId, operation, asked)
    const result = call(operation, asked)
    const response = ec.web.response
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Accept-Ranges', 'bytes')
    response.setHeader(
        'Content-Disposition',
        'attachment; filename="' +
            String(result.file.filename).replace(/["\\\r\n]/g, '_') +
            '"',
    )
    const r = result.range
    if (r && r.unsatisfiable) {
        response.setStatus(416)
        response.setHeader('Content-Range', 'bytes */' + result.file.size)
        return
    }
    response.setContentType(result.file.mimeType)
    if (r) {
        response.setStatus(206)
        response.setHeader(
            'Content-Range',
            'bytes ' + r.start + '-' + r.end + '/' + result.file.size,
        )
    }
    // only the range is read, a window at a time (Shop F88)
    const start = r ? r.start : 0
    const end = r ? r.end : result.file.size - 1
    const wasDisabled = ec.artifactExecution.disableAuthz()
    try {
        const stream = ec.resource
            .getLocationReference(result.location)
            .openStream()
        try {
            for (let at = start; at <= end; ) {
                const bytes = stream.read(
                    at,
                    Math.min(RANGE_WINDOW, end - at + 1),
                )
                if (!bytes.length) break
                response.write(bytes)
                at += bytes.length
            }
        } finally {
            stream.close()
        }
    } finally {
        if (!wasDisabled) ec.artifactExecution.enableAuthz()
    }
}
;({
    call,
    download,
    downloadExport,
    downloadFile,
    downloadRanged,
    authorityClient,
    statusKind,
})
