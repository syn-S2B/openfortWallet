# Authentication request reference

Grounded in the supplied onli-authentication skill and exported
onli-id/securityMessages.proto. Use the deployment's generated clients; these
illustrative values are not working credentials or registered configuration.

Backend calls use gRPC, mTLS client certificate/key and app_key metadata on every
request. The wallet browser's Species REST/AES-GCM proxy is a different boundary;
Species credentials are not Onli app_key. Keep all service credentials server-side.

AuthenticateOwner basic:

```json
{"owner":"usr-resolved-owner-id","app_symbol":"ENGMA","body":"Confirm your identity to prepare this transfer."}
```

Reverse-MFA adds rev_string; reverse-hash adds app_salt/client_gene_sample from the
approved Master implementation. Authentication has a 60-second response window.

AuthorizeBehavior:

```json
{"owner":"usr-resolved-owner-id","app_symbol":"ENGMA","note":{"behavior":"configured-transfer-behavior","body":"Approve the exact transfer reviewed in this Appliance."}}
```

Resolve/register the actual behavior under the Owner's user_class and verify its
effect binding; this example's behavior name is not an existing service behavior.

Both response records use authentication_status with the exported Status enum:

| Wire enum | Value | Handling |
| --- | --- | --- |
| AuthenticationStatusNIL | 0 | No proof |
| AuthenticationStatusASKED | 1 | Wait |
| AuthenticationStatusACCEPTED | 2 | Persist and continue within scope |
| AuthenticationStatusDENIED | 3 | Stop |
| AuthenticationStatusEXPIRED | 4 | Stop |

Never test truthiness: DENIED is nonzero. Check owner/app_symbol on each record.
AuthenticateOwnerRecord also returns auth_type/asset_balance; AuthorizeBehaviorRecord
returns note. Store separate authentication and authorization auth_log_id references.
Use returned timestamps where available; do not invent a timestamp field in a proto.

AuthLog:

```json
{"app_symbol":"ENGMA","auth_log_id":"returned-auth-log-id"}
```

Inspect security method, appliance, timestamp, original request/response JSON and
error state. Audit evidence establishes the security decision, not external transfer
completion. Resolve email using ListOwner with condition identity.email and
meta.keyword; GetOwner requires the usr- wire identity, not email.
