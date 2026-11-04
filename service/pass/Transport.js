/* How PASS reaches its one configured authority (mr-moqui plans/Edge-Node.md §5.5): in process (local mode), or
   remotely by one of two transports behind the same functions, so a caller cannot tell them apart and sees the same
   statusKind error kinds from both:
   - rest: the authority's REST API (Mantle's PassApi.js) at pass_backend_url, the client's secret in headers;
   - grpc: the host's gRPC binding (ec.service.passAuthority): direct to the authority's gRPC listener
     (pass_backend_grpc_url), or with pass_backend_url=edge: the edge node's link to its local node.
   pass_backend_transport chooses: grpc or rest, or empty for automatic, which is gRPC where the host has it and a gRPC
   endpoint is configured, else REST (Lite and Dev have no gRPC, so REST stays their supported default). CC0 plus patent
   grant. */
const fail = (kind, text) => {
    const e = new Error(text)
    e.moquiErrorKind = kind
    throw e
}
const statusKind = (status) =>
    ({
        401: 'AuthenticationRequired',
        403: 'Unauthorized',
        404: 'NotFound',
        409: 'Conflict',
        422: 'Unprocessable',
        429: 'Tarpit',
    })[Number(status)] || 'Unavailable'
/* Writes a bearer link's token authorizes for a visitor who is not signed in (Mantle's PassAuthority lists the same). */
const TOKEN_WRITES = [
    'startInvoicePayment',
    'submitSupplierBill',
    // Purchasing P16: a quote's and a purchase order's link
    'saveQuoteResponse',
    'submitQuoteResponse',
    'acknowledgePurchaseOrder',
    'reportDropShipDelivery',
]
const MAX_UPLOAD = 10485760
const SKIP_HEADERS = ['set-cookie', 'x-csrf-token', 'moquisessiontoken']
const property = (name) => String(System.getProperty(name) || '').trim()
const routes = () =>
    ec.resource.script('component://mr-pass/service/pass/Routes.js')

/* The gRPC endpoint of an authority's REST URL, for pass_backend_transport=grpc with no pass_backend_grpc_url: its host
   on the gRPC listener's default port. */
function grpcEndpointOf(backend) {
    const match = /^(https?):\/\/(\[[^\]]+\]|[^/:]+)/.exec(String(backend))
    if (!match) return ''
    return (match[1] === 'https' ? 'grpcs://' : 'grpc://') + match[2] + ':4317'
}
/* The transport for the settings: {kind: 'local'}, {kind: 'rest'} or {kind: 'grpc', endpoint}. backend is
   pass_backend_url, setting pass_backend_transport, grpcUrl pass_backend_grpc_url, available whether the host has the
   gRPC binding. Settings that cannot work are an Unavailable error naming them. */
function select({ backend, setting, grpcUrl, available }) {
    if (!backend) return { kind: 'local' }
    const chosen = String(setting || '').toLowerCase()
    if (chosen && chosen !== 'grpc' && chosen !== 'rest')
        fail(
            'Unavailable',
            'pass_backend_transport must be grpc, rest or empty',
        )
    if (backend === 'edge:') {
        // the local node on the edge link is reached over gRPC only
        if (chosen === 'rest')
            fail(
                'Unavailable',
                'pass_backend_url=edge: is the edge link, which takes gRPC only',
            )
        if (!available)
            fail(
                'Unavailable',
                'pass_backend_url=edge: needs gRPC in this host',
            )
        return { kind: 'grpc', endpoint: 'edge:' }
    }
    if (chosen === 'rest') return { kind: 'rest' }
    const endpoint =
        grpcUrl || (chosen === 'grpc' ? grpcEndpointOf(backend) : '')
    if (chosen === 'grpc') {
        if (!available)
            fail(
                'Unavailable',
                'pass_backend_transport=grpc needs gRPC in this host',
            )
        if (!endpoint) fail('Unavailable', 'No gRPC endpoint for the authority')
        return { kind: 'grpc', endpoint }
    }
    // automatic: an authority that has not opened its gRPC listener keeps REST until pass_backend_grpc_url names it
    return available && endpoint ? { kind: 'grpc', endpoint } : { kind: 'rest' }
}
/* Whether this host has the gRPC binding: Lite and Dev throw "gRPC not built into this host". */
function grpcAvailable() {
    if (typeof ec.service.passAuthority !== 'function') return false
    try {
        ec.service.passAuthority('edge:')
        return true
    } catch (error) {
        if (/not built/.test(String(error.message))) return false
        throw error
    }
}
function current() {
    const backend = property('pass_backend_url')
    if (!backend) return { kind: 'local' }
    return select({
        backend,
        setting: property('pass_backend_transport'),
        grpcUrl: property('pass_backend_grpc_url'),
        available: grpcAvailable(),
    })
}
/* The authority's web address, for the SSO front channel the browser follows: pass_backend_web_url, else an http(s)
   pass_backend_url. On the edge link that is the local node's host name, through the edge node's web access. */
function webBase() {
    const base =
        property('pass_backend_web_url') || property('pass_backend_url')
    if (!/^https?:\/\//.test(base))
        fail('Unavailable', 'pass_backend_web_url is not configured')
    return base.replace(/\/$/, '')
}
/* The remote call's route (the path/verb catalogue is packaged with PASS, so a remote frontend needs no Mantle
   metadata), and the anonymous-write rule both transports keep. */
function routeOf(operation, input) {
    const route = routes().find(([method, path, op]) => op === operation)
    if (!route) fail('Unavailable', 'Remote operation is unavailable')
    const token = ec.web.sessionAttributes.passDelegation
    if (
        !token &&
        route[0] !== 'GET' &&
        operation !== 'applyOptOut' &&
        !(TOKEN_WRITES.includes(operation) && input.token)
    )
        fail('AuthenticationRequired', 'Sign in to continue')
    return { method: route[0], pattern: route[1], token }
}
const checkUpload = (file) => {
    if (!file || Number(file.size) > MAX_UPLOAD)
        fail('Unprocessable', 'Upload exceeds the size limit')
}
function signedOut() {
    ec.web.sessionAttributes.remove('passDelegation')
    ec.web.sessionAttributes.remove('passSubject')
}

/* ---- REST ---- */
/* Every authority call names this deployment with its secret and its browser's address (for rate limits). */
function authorityClient(siteId, path, method) {
    const backend = System.getProperty('pass_backend_url'),
        clientId = System.getProperty('pass_client_id'),
        secret = System.getProperty('pass_client_secret')
    if (!backend || !clientId || !secret)
        fail('Unavailable', 'Remote authority is not configured')
    const client = ec.service
        .rest()
        .uri(
            String(backend).replace(/\/$/, '') +
                '/rest/s1/pass/v1/sites/' +
                encodeURIComponent(siteId) +
                '/' +
                path,
        )
        .method(method)
        .timeout(30)
        .followRedirects(false)
        .addHeader('x-pass-client', clientId)
        .addHeader('x-pass-client-secret', secret)
    const address = ec.web?.request?.remoteAddr
    if (address) client.addHeader('x-pass-client-ip', String(address))
    return client
}
const rest = {
    call(operation, input, def) {
        const { method, pattern, token } = routeOf(operation, input)
        const payload = { ...input }
        delete payload.siteId
        const path = pattern.replace(/\{([^}]+)\}/g, (_, name) => {
            const value = payload[name]
            delete payload[name]
            if (value == null || value === '')
                fail('Unprocessable', 'Missing ' + name)
            return encodeURIComponent(String(value))
        })
        const client = authorityClient(input.siteId, path, method)
        if (token) client.addHeader('authorization', 'Bearer ' + token)
        if (operation === 'stageAttachment') {
            checkUpload(input.file)
            const upload = client
                .multipart({
                    file: input.file,
                    contactListId: input.contactListId || '',
                    purpose: input.purpose || 'post',
                    draftId: input.draftId || '',
                    altText: input.altText || '',
                })
                .send()
            if (
                Number(upload.statusCode) < 200 ||
                Number(upload.statusCode) >= 300
            )
                fail(
                    statusKind(upload.statusCode),
                    'Upload could not be completed',
                )
            return upload.jsonObject()
        }
        // Another operation with a file (a supplier's bill, quote or acknowledgement) sends its fields and the file as one
        // multipart request; without a file (a quote's or an acknowledgement's is optional) it is an ordinary call.
        if (def.fields.includes('file') && input.file) {
            checkUpload(input.file)
            const parts = {}
            for (const [k, v] of Object.entries(payload))
                if (v != null && v !== '')
                    parts[k] = k === 'file' ? v : String(v)
            const sent = client.multipart(parts).send()
            if (Number(sent.statusCode) < 200 || Number(sent.statusCode) >= 300)
                fail(
                    statusKind(sent.statusCode),
                    'The authority could not complete this request',
                )
            return sent.jsonObject()
        }
        if (method === 'GET') {
            for (const [k, v] of Object.entries(payload))
                if (v != null) client.addBodyParameter(k, String(v))
        } else
            client.text(JSON.stringify(payload)).contentType('application/json')
        const response = client.call(),
            status = Number(response.statusCode)
        if (status === 401) {
            signedOut()
            if (method === 'GET' && token)
                return rest.call(operation, input, def)
        }
        if (status < 200 || status >= 300)
            fail(
                statusKind(status),
                'The authority could not complete this request',
            )
        return response.jsonObject()
    },
    /* A protected file, streamed through to the browser with the authority's status and headers. */
    download(siteId, path) {
        const client = authorityClient(siteId, path, 'GET')
        if (ec.web.sessionAttributes.passDelegation)
            client.addHeader(
                'authorization',
                'Bearer ' + ec.web.sessionAttributes.passDelegation,
            )
        ec.web.response.forward(client.send(), { skipHeaders: SKIP_HEADERS })
    },
    /* The SSO back channel: no session or credential of the visitor's. */
    ssoAccount(action, input, siteId) {
        const response = authorityClient(siteId, 'account/' + action, 'POST')
            .jsonObject(input)
            .call()
        if (Number(response.statusCode) !== 200)
            fail(
                'AuthenticationRequired',
                'Sign-in handoff could not be completed',
            )
        return response.jsonObject()
    },
    /* An account action, with the authority's session (the second factor) in its cookie, kept in the visitor's session. */
    account(action, input, siteId) {
        const client = authorityClient(
            siteId,
            'account/' + action,
            'POST',
        ).jsonObject(input)
        if (ec.web.sessionAttributes.passAuthorityCookie)
            client.addHeader(
                'Cookie',
                ec.web.sessionAttributes.passAuthorityCookie,
            )
        if (ec.web.sessionAttributes.passDelegation)
            client.addHeader(
                'Authorization',
                'Bearer ' + ec.web.sessionAttributes.passDelegation,
            )
        const response = client.call()
        if (Number(response.statusCode) !== 200)
            fail(
                statusKind(response.statusCode),
                'Authentication could not be completed',
            )
        const cookies = response
            .headerList('set-cookie')
            .map((c) => String(c).split(';')[0])
            .filter((c) =>
                /^moqui\.session=|^JSESSIONID=|^moquiSession=/.test(c),
            )
        if (cookies.length)
            ec.web.sessionAttributes.passAuthorityCookie = cookies.join('; ')
        return response.jsonObject()
    },
}

/* ---- gRPC ---- */
/* The PassAuthority call of an operation, with the visitor's credential and address. */
function grpcCall(operation, siteId, input, extra) {
    return {
        operation,
        siteId,
        input,
        delegation: ec.web.sessionAttributes.passDelegation || '',
        visitorAddress: String(ec.web?.request?.remoteAddr || ''),
        operationId: ec.user.randomString(16),
        ...(extra || {}),
    }
}
/* An answer's result, or its error as the REST adapter's: the envelope's status gives the kind. */
function answered(answer, message) {
    if (answer.error) fail(statusKind(answer.error.status), message)
    return answer.result
}
const grpc = (endpoint) => ({
    call(operation, input, def) {
        const { method, token } = routeOf(operation, input)
        const authority = ec.service.passAuthority(endpoint)
        if (operation === 'stageAttachment') {
            checkUpload(input.file)
            const fields = {
                contactListId: input.contactListId || '',
                purpose: input.purpose || 'post',
                draftId: input.draftId || '',
                altText: input.altText || '',
            }
            return answered(
                authority.upload(
                    grpcCall(operation, input.siteId, fields),
                    input.file,
                ),
                'Upload could not be completed',
            )
        }
        if (def.fields.includes('file') && input.file) {
            checkUpload(input.file)
            const fields = {}
            for (const [k, v] of Object.entries(input))
                if (k !== 'file' && k !== 'siteId' && v != null && v !== '')
                    fields[k] = String(v)
            return answered(
                authority.upload(
                    grpcCall(operation, input.siteId, fields),
                    input.file,
                ),
                'The authority could not complete this request',
            )
        }
        const payload = {}
        // a GET sends text query parameters over REST, so it sends text here too
        for (const [k, v] of Object.entries(input))
            if (k !== 'siteId' && (method !== 'GET' || v != null))
                payload[k] = method === 'GET' ? String(v) : v
        const answer = authority.call(
            grpcCall(operation, input.siteId, payload),
        )
        if (answer.error && Number(answer.error.status) === 401) {
            signedOut()
            if (method === 'GET' && token)
                return this.call(operation, input, def)
        }
        return answered(answer, 'The authority could not complete this request')
    },
    /* A protected file, streamed through to the browser; an error is the envelope with its status, as REST's. */
    download(siteId, operation, input) {
        const response = ec.service
            .passAuthority(endpoint)
            .download(grpcCall(operation, siteId, input))
        ec.web.response.forward(response, { skipHeaders: SKIP_HEADERS })
    },
    ssoAccount(action, input, siteId) {
        const answer = ec.service.passAuthority(endpoint).call(
            grpcCall('account.' + action, siteId, input, {
                delegation: '',
            }),
        )
        if (answer.error)
            fail(
                'AuthenticationRequired',
                'Sign-in handoff could not be completed',
            )
        return answer.result
    },
    /* An account action, with the authority's session (the second factor) as its handle, kept in the visitor's
       session in place of REST's cookie. */
    account(action, input, siteId) {
        const answer = ec.service.passAuthority(endpoint).call(
            grpcCall('account.' + action, siteId, input, {
                sessionHandle:
                    ec.web.sessionAttributes.passAuthoritySession || '',
            }),
        )
        if (answer.sessionHandle)
            ec.web.sessionAttributes.passAuthoritySession = answer.sessionHandle
        return answered(answer, 'Authentication could not be completed')
    },
})

/* The remote transport, which callers use when the authority is not in process. */
function remote() {
    const chosen = current()
    if (chosen.kind === 'local') fail('Unavailable', 'The authority is local')
    return chosen.kind === 'grpc' ? grpc(chosen.endpoint) : rest
}
/* A remote operation: its result, or the error kind REST's status would give. */
function call(operation, input, def) {
    return remote().call(operation, input, def)
}
/* A remote attachment (getAttachment) or export (getExport) download, streamed to the browser. */
function download(siteId, attachmentId, variant) {
    const transport = remote()
    if (transport === rest)
        return rest.download(
            siteId,
            'attachments/' +
                encodeURIComponent(attachmentId) +
                (variant ? '?variant=' + encodeURIComponent(variant) : ''),
        )
    transport.download(siteId, 'getAttachment', {
        attachmentId,
        ...(variant ? { variant } : {}),
    })
}
function downloadExport(siteId, exportId) {
    const transport = remote()
    if (transport === rest)
        return rest.download(siteId, 'exports/' + encodeURIComponent(exportId))
    transport.download(siteId, 'getExport', { exportId })
}
const ssoAccount = (action, input, siteId) =>
    remote().ssoAccount(action, input, siteId)
const account = (action, input, siteId) =>
    remote().account(action, input, siteId)
;({
    select,
    current,
    grpcAvailable,
    grpcEndpointOf,
    webBase,
    call,
    download,
    downloadExport,
    ssoAccount,
    account,
    authorityClient,
    statusKind,
})
