# group.core

Structural group semantics over ONE.core `Group` and `HashGroup`.

`rosterAsOf(groupIdHash, atTime)` selects the unique Group version in force in
the version DAG and returns its exact HashGroup roster. Concurrent unmerged
frontiers fail with `ConcurrentVersionsError`; they are never resolved by array
order. `isRosterMemberAt(...)` adds an explicit replica-freshness requirement
and throws `StaleChainError` when it cannot make a current structural decision.

This package does not issue certificates, evaluate keys, or decide whether a
member is authorized to disclose a group. Those are trust.projektor policies
over evidence verified by trust.core.

| Concern | Owner |
|---|---|
| `Group`, `HashGroup`, version DAG and storage | ONE.core |
| Time-indexed structural roster queries | group.core |
| Typed signing and issuer-key verification | trust.core |
| Membership and disclosure authorization | trust.projektor |

No API accepts or constructs `LeuteModel` or `TrustedKeysManager`.
