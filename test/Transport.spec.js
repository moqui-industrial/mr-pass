// How PASS chooses its authority's transport (service/pass/Transport.js, mr-moqui plans/archive/Edge-Node.md §5.5 and decision
// 8): local with no pass@backend-url; rest or grpc when pass@backend-transport says; automatic is gRPC where the host
// has the binding and a gRPC endpoint is configured, else REST; edge: is gRPC on the link. Settings that cannot work
// are refused by name. This run has no gRPC client installed (Lite and Dev have none; a test run without --serve
// installs none), so the binding's "not built" is read as REST.
const transport = () =>
    ec.resource.script('component://mr-pass/service/pass/Transport.js')
function chosen(settings) {
    try {
        return transport().select(settings)
    } catch (error) {
        return { refused: String(error.message), kind: error.moquiErrorKind }
    }
}
feature(
    'the transport follows the settings, and automatic takes gRPC only where it can',
    {
        when() {
            const https = 'https://authority.example.test'
            return {
                local: chosen({
                    backend: '',
                    setting: 'grpc',
                    available: true,
                }),
                autoRest: chosen({
                    backend: https,
                    setting: '',
                    grpcUrl: 'grpcs://authority.example.test:4317',
                    available: false,
                }),
                autoNoEndpoint: chosen({
                    backend: https,
                    setting: '',
                    grpcUrl: '',
                    available: true,
                }),
                autoGrpc: chosen({
                    backend: https,
                    setting: '',
                    grpcUrl: 'grpcs://authority.example.test:5000',
                    available: true,
                }),
                forcedRest: chosen({
                    backend: https,
                    setting: 'REST',
                    grpcUrl: 'grpcs://a:1',
                    available: true,
                }),
                forcedGrpc: chosen({
                    backend: https,
                    setting: 'grpc',
                    grpcUrl: '',
                    available: true,
                }),
                forcedGrpcLite: chosen({
                    backend: https,
                    setting: 'grpc',
                    available: false,
                }),
                edge: chosen({
                    backend: 'edge:',
                    setting: '',
                    available: true,
                }),
                edgeForced: chosen({
                    backend: 'edge:',
                    setting: 'grpc',
                    available: true,
                }),
                edgeRest: chosen({
                    backend: 'edge:',
                    setting: 'rest',
                    available: true,
                }),
                edgeLite: chosen({
                    backend: 'edge:',
                    setting: '',
                    available: false,
                }),
                unknown: chosen({
                    backend: https,
                    setting: 'soap',
                    available: true,
                }),
                plainHttp: transport().grpcEndpointOf('http://10.0.0.5:8080/'),
            }
        },
        then(c) {
            c.local.kind == 'local'
            c.autoRest.kind == 'rest'
            // an authority whose gRPC listener nobody named keeps REST
            c.autoNoEndpoint.kind == 'rest'
            c.autoGrpc.kind == 'grpc'
            c.autoGrpc.endpoint == 'grpcs://authority.example.test:5000'
            c.forcedRest.kind == 'rest'
            c.forcedGrpc.kind == 'grpc'
            c.forcedGrpc.endpoint == 'grpcs://authority.example.test:4317'
            c.forcedGrpcLite.kind == 'Unavailable'
            c.forcedGrpcLite.refused.includes('needs gRPC')
            c.edge.kind == 'grpc'
            c.edge.endpoint == 'edge:'
            c.edgeForced.endpoint == 'edge:'
            c.edgeRest.refused.includes('gRPC only')
            c.edgeLite.refused.includes('needs gRPC')
            c.unknown.refused.includes('grpc, rest or empty')
            c.plainHttp == 'grpc://10.0.0.5:4317'
        },
    },
)
feature(
    'a transport in clear text to another host is refused unless pass@backend-insecure says so (SEC-PSF-05)',
    {
        when() {
            return {
                restClear: chosen({
                    backend: 'http://authority.example.test',
                    setting: 'rest',
                    available: false,
                }),
                restLoopback: chosen({
                    backend: 'http://127.0.0.1:8091',
                    setting: 'rest',
                    available: false,
                }),
                restLocalhost: chosen({
                    backend: 'http://localhost:8091/',
                    setting: '',
                    available: false,
                }),
                restInsecure: chosen({
                    backend: 'http://authority.example.test',
                    setting: 'rest',
                    available: false,
                    insecure: true,
                }),
                grpcClear: chosen({
                    backend: 'https://authority.example.test',
                    setting: '',
                    grpcUrl: 'grpc://authority.example.test:4317',
                    available: true,
                }),
                grpcDerived: chosen({
                    backend: 'http://10.0.0.5:8080',
                    setting: 'grpc',
                    available: true,
                }),
                grpcLoopback: chosen({
                    backend: 'https://authority.example.test',
                    setting: 'grpc',
                    grpcUrl: 'grpc://[::1]:4317',
                    available: true,
                }),
                // a lookalike of a loopback name is another host
                lookalike: chosen({
                    backend: 'http://127.0.0.1.example.test',
                    setting: 'rest',
                    available: false,
                }),
                // the property is read by current(), and a direct REST client is refused the same
                current: withConf('pass@backend-url',
                    'http://authority.example.test',
                    () => {
                        try {
                            return transport().current()
                        } catch (error) {
                            return { refused: String(error.message) }
                        }
                    },
                ),
            }
        },
        then(c) {
            c.restClear.kind == 'Unavailable'
            c.restClear.refused.includes('clear text')
            c.restLoopback.kind == 'rest'
            c.restLocalhost.kind == 'rest'
            c.restInsecure.kind == 'rest'
            c.grpcClear.kind == 'Unavailable'
            c.grpcClear.refused.includes('pass@backend-grpc-url')
            c.grpcDerived.kind == 'Unavailable'
            c.grpcLoopback.kind == 'grpc'
            c.lookalike.kind == 'Unavailable'
            c.current.refused.includes('clear text')
        },
    },
)
feature(
    'with no gRPC in the host the binding says so, and the configured transport is REST',
    {
        when() {
            const built = transport().grpcAvailable()
            let thrown = ''
            try {
                ec.service.passAuthority('edge:')
            } catch (error) {
                thrown = String(error.message)
            }
            const rest = withConf('pass@backend-url',
                'https://authority.example.test',
                () =>
                    withConf('pass@backend-grpc-url',
                        'grpcs://authority.example.test:4317',
                        () => transport().current(),
                    ),
            )
            const edge = withConf('pass@backend-url', 'edge:', () => {
                try {
                    return transport().current()
                } catch (error) {
                    return { refused: String(error.message) }
                }
            })
            return { built, thrown, rest, edge, local: transport().current() }
        },
        then({ built, thrown, rest, edge, local }) {
            built === false
            thrown == 'gRPC not built into this host'
            rest.kind == 'rest'
            edge.refused.includes('needs gRPC')
            local.kind == 'local'
        },
    },
)
