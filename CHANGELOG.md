# Changelog

## [1.0.6](https://github.com/chrischall/viator-mcp/compare/v1.0.5...v1.0.6) (2026-08-28)


### Bug Fixes

* **egress:** declare every host the server dials in mint.yaml ([#50](https://github.com/chrischall/viator-mcp/issues/50)) ([a25a756](https://github.com/chrischall/viator-mcp/commit/a25a756c4d94eda85c94df5eb8aa7efda329f11a))

## [1.0.5](https://github.com/chrischall/viator-mcp/compare/v1.0.4...v1.0.5) (2026-07-27)


### Bug Fixes

* **release:** indent skill-path into the with: block ([#28](https://github.com/chrischall/viator-mcp/issues/28)) ([c0694e1](https://github.com/chrischall/viator-mcp/commit/c0694e1cc37d604797eccc8ff0704b060462ac17))
* **release:** restore the skill-path pin dropped by the pipeline sweep ([#27](https://github.com/chrischall/viator-mcp/issues/27)) ([f512e85](https://github.com/chrischall/viator-mcp/commit/f512e85213d5da313013229f64dc836bde10c44b))
* **release:** restore two file-header comments to column 0 ([#30](https://github.com/chrischall/viator-mcp/issues/30)) ([98c124e](https://github.com/chrischall/viator-mcp/commit/98c124e5d76e0d3fa8a8e180a601d3c03553ca1a))

## [1.0.4](https://github.com/chrischall/viator-mcp/compare/v1.0.3...v1.0.4) (2026-07-25)


### Bug Fixes

* **deps:** bump fast-uri out of the host-confusion advisories ([#22](https://github.com/chrischall/viator-mcp/issues/22)) ([6362ede](https://github.com/chrischall/viator-mcp/commit/6362ede76c93642953ea563534019594d229dafb))

## [1.0.3](https://github.com/chrischall/viator-mcp/compare/v1.0.2...v1.0.3) (2026-07-13)


### Bug Fixes

* **plugin:** address review findings ([#19](https://github.com/chrischall/viator-mcp/issues/19)) ([fe10fe0](https://github.com/chrischall/viator-mcp/commit/fe10fe03d3c529b9343172a45b1d658a83eb00da))
* **plugin:** move SKILL.md into skills/ directory so plugin skills load ([#17](https://github.com/chrischall/viator-mcp/issues/17)) ([a4a74a7](https://github.com/chrischall/viator-mcp/commit/a4a74a7980e34ad5015f08b17a679eb73d511df0))

## [1.0.2](https://github.com/chrischall/viator-mcp/compare/v1.0.1...v1.0.2) (2026-07-07)


### Bug Fixes

* bump @chrischall/mcp-utils to 0.12.0 ([#12](https://github.com/chrischall/viator-mcp/issues/12)) ([9dacbe4](https://github.com/chrischall/viator-mcp/commit/9dacbe42dbb96235ce841af6074604fdaf295a5d))


### Refactor

* adopt mcp-utils createResponseCache + parseRetryAfterMs ([#7](https://github.com/chrischall/viator-mcp/issues/7)) ([7e5a3ed](https://github.com/chrischall/viator-mcp/commit/7e5a3ed0f12f0549ddc8068b74ecca0194d03284))


### Documentation

* add VIATOR_API_BASE_URL to CLAUDE.md env table ([#11](https://github.com/chrischall/viator-mcp/issues/11)) ([fd3d967](https://github.com/chrischall/viator-mcp/commit/fd3d9676810f35f053b285c39eaa8f4dbf5feccb))
* document first-party dependency-bump label exception ([#13](https://github.com/chrischall/viator-mcp/issues/13)) ([734115d](https://github.com/chrischall/viator-mcp/commit/734115d8f9c229d7f598576eafa5bad1895443ce))
* note createResponseCache inherits the 256-entry bound in viator ([#10](https://github.com/chrischall/viator-mcp/issues/10)) ([8bf7f58](https://github.com/chrischall/viator-mcp/commit/8bf7f586344a3d24d4c438a3ca748197dc7ca71f))

## [1.0.1](https://github.com/chrischall/viator-mcp/compare/v1.0.0...v1.0.1) (2026-07-05)


### Documentation

* record live-verification results in the pinned API doc ([#4](https://github.com/chrischall/viator-mcp/issues/4)) ([dd9eede](https://github.com/chrischall/viator-mcp/commit/dd9eedeedcc4aec05eaa0f71b8f0a599215f9967))

## 1.0.0 (2026-07-05)


### Features

* support VIATOR_API_BASE_URL for sandbox testing ([#1](https://github.com/chrischall/viator-mcp/issues/1)) ([5b68913](https://github.com/chrischall/viator-mcp/commit/5b689139f8942f5094a097232de18f11843420ec))
* Viator Partner API MCP server (Basic Access affiliate tier) ([9d32fbd](https://github.com/chrischall/viator-mcp/commit/9d32fbd0f4581cc9780659ecf259f63e9750742c))
