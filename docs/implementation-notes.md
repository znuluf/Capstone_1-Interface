# Implementation notes (Milestone 1)

> Historical notes from project setup, numbered I-01 to I-05. They are superseded where they conflict with the official decision log in [../decisions.md](../decisions.md) (D-01 to D-29): roles are now FarmOwner/FarmTechnician, a restricted System Administrator exists (D-16), and the dev database tag and toolchain notes still apply.

Decisions taken during implementation, especially where reality differs from the planning PDF (v1.2, 21 Oct 2026). Update the PDF's TRD and Appendix A to match.

## I-01 Template is ASP.NET Boilerplate startup template v10.2.0, not ASP.NET Zero 10.2.0 (2026-10-21)

**Found:** The downloaded package is the free ASP.NET Boilerplate *module-zero-core-template* v10.2.0: `Abp.*` 10.2.0, `net9.0`, EF Core 9.0.5, Angular 19.2.1, abp-ng2-module 12.1.0.
The PDF describes the commercial ASP.NET Zero 10.2.0 (January 2021, ABP 6.2), which is a different product. The PDF also says "do not assume .NET 9", but this template does target .NET 9.

**Decision:** Build on the downloaded template as-is. Layers, JWT bearer flow, abp-ng2-module client and Migrator/test projects all match the PDF's architecture. Exact versions are in the README.

**Support note:** ASP.NET Boilerplate announced end of framework support in May 2026. .NET 9 is an STS release and reaches end of support on 2026-11-10. Moving to .NET 10 LTS would be a separate migration decision; record it as a known limitation for the panel.

## I-02 Farm = ABP tenant (2026-10-21)

**Decision:** Each Farm Account is an ABP tenant, using `MultiTenancyEnabled = true` as in the template.

- Farm registration creates the tenant, its Owner user (static role `Owner`), and a `Farm` profile entity, all in one unit of work.
- Static per-tenant roles `Owner` and `Technician` replace PDF §5 `FarmMembership.Role`. An ABP user belongs to exactly one tenant, which satisfies "each account belongs to exactly one farm". Several users can hold `Owner` in the same farm.
- Every farm-owned entity implements `IMustHaveTenant`. ABP's data filter then scopes every query to the signed-in user's farm. `TenantId` takes the place of `FarmId` as the partition key, and services never trust a client-supplied farm identifier.
- Sign-in finds the farm without a farm-selection step, so usernames and emails must be unique across all farms.
- The ABP host (tenant-less) admin is for development only. There is no system-wide administrator role in v1, per PDF scope.

**Why:** Isolation is enforced centrally by the framework instead of by hand-written checks in every service. That lowers the risk of a cross-farm leak (AC-03, AC-10).

## I-03 Authentication stays JWT bearer (2026-10-21)

PDF §5 mentions a "same-origin secure-cookie session", while §2 and Appendix A approve the template's JWT bearer flow. This contradiction is resolved in favour of **JWT bearer**, per Appendix A. The §6 test item "verify secure-cookie and antiforgery controls" becomes "verify bearer token handling, expiry and HTTPS".

## I-04 Toolchain (2026-10-21)

- Node 22 LTS via nvm (`angular/.nvmrc`). The workstation default is Node 26, which Angular 19 does not support.
- Yarn 1.22.22 with `--frozen-lockfile`. The template's `package-lock.json` was an empty file and has been removed.
- SQL Server 2022 CU16 Developer edition in Docker (originally OrbStack on an x86_64 Mac; now GitHub Codespaces). Developer edition is licensed for development and test only, so production licensing (Express or other) is still to be decided.

## I-05 Secrets out of source control (2026-10-21)

The template committed a JWT signing key and a connection string in `appsettings.json`. Both now come from user-secrets in development and environment variables on deployed hosts. The API fails fast if the JWT key is missing or weak. The SA password lives in the gitignored `docker/sqlserver/.env`.
