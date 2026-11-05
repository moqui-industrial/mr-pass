/* PASS owns presentation and one configured authority, never a business replica: in process when pass_backend_url is
   empty, else over REST or gRPC (Transport.js). */
const schema = ec.resource.script('component://mr-pass/service/pass/Schema.js')
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
        ec.web.response.setHeader('Cache-Control', 'no-store')
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
;({ call, download, downloadExport, downloadFile, authorityClient, statusKind })
