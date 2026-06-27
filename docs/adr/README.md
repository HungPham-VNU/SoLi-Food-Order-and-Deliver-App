# Architecture Decision Records (ADRs)

This directory holds the Architecture Decision Records for the SoLi/UITFood
backend. Each ADR captures one significant, hard-to-reverse
decision: its context, the decision, and its consequences.

## Conventions

- One decision per file: `NNNN-short-kebab-title.md` (zero-padded, monotonic).
- Status lifecycle: `Proposed → Accepted → (Superseded by NNNN | Deprecated)`.
- ADRs are immutable once `Accepted`. To change a decision, write a new ADR that
  supersedes the old one and update both `Status` lines.
- Use [`0000-template.md`](./0000-template.md) as the starting point.

## Index

| ADR | Title | Status |
| --- | --- | --- |
No active ADRs are currently retained in this directory beyond the template.
The migration-era proposed ADRs were removed with the final service cutover.

## Governance

Accepted ADRs should be updated only by adding a new superseding ADR.
