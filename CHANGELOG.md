# Changelog

## [1.2.1](https://github.com/chrischall/viator-mcp/compare/v1.2.0...v1.2.1) (2026-09-04)


### Documentation

* **skill:** document the view vocabulary, not the removed compact flag ([#79](https://github.com/chrischall/viator-mcp/issues/79)) ([d93a536](https://github.com/chrischall/viator-mcp/commit/d93a53602497d8b4d3fdd19d624ee40ead58c68f))

## [1.2.0](https://github.com/chrischall/viator-mcp/compare/v1.1.0...v1.2.0) (2026-09-04)


### Features

* **tools:** compact by default — strip media URLs, and minify every response ([#69](https://github.com/chrischall/viator-mcp/issues/69)) ([9f2e36f](https://github.com/chrischall/viator-mcp/commit/9f2e36f86f04cedcbd0a23a7f62a3ee37368ea15))


### Bug Fixes

* **build:** restore the literal em dash in the package description ([#74](https://github.com/chrischall/viator-mcp/issues/74)) ([1542e12](https://github.com/chrischall/viator-mcp/commit/1542e12554fa3354ab0c46ae1c38883d237db395))
* **deps:** pick up @chrischall/mcp-utils 0.23.1 ([#75](https://github.com/chrischall/viator-mcp/issues/75)) ([1c7dc1c](https://github.com/chrischall/viator-mcp/commit/1c7dc1c69a4e0e6aed59cf2b98ac56b666e5a55d))
* **deps:** pick up @chrischall/mcp-utils 0.23.2 ([#77](https://github.com/chrischall/viator-mcp/issues/77)) ([dbc4ddb](https://github.com/chrischall/viator-mcp/commit/dbc4ddbf6eed7262eb075cc1870187192ce2a2f5))
* **tools:** one view vocabulary, per-tool notes, and an honest tier in view.ts ([#78](https://github.com/chrischall/viator-mcp/issues/78)) ([1733a4c](https://github.com/chrischall/viator-mcp/commit/1733a4c5e9e40263204571c5e9c3b52b5df93090)), closes [#70](https://github.com/chrischall/viator-mcp/issues/70) [#73](https://github.com/chrischall/viator-mcp/issues/73)
* **tools:** unify the compact vocabulary — [#69](https://github.com/chrischall/viator-mcp/issues/69) left two of them in one server ([#72](https://github.com/chrischall/viator-mcp/issues/72)) ([66ab2bc](https://github.com/chrischall/viator-mcp/commit/66ab2bc700487a51bb950b5bc30135981a829e76))

## [1.1.0](https://github.com/chrischall/viator-mcp/compare/v1.0.6...v1.1.0) (2026-09-01)


### Features

* **health:** add vt_healthcheck ([#59](https://github.com/chrischall/viator-mcp/issues/59)) ([09858c8](https://github.com/chrischall/viator-mcp/commit/09858c8ead089844e6953e4eb5c3c9b9b8d9ba10))


### Documentation

* **health:** list vt_healthcheck in manifest.json and the tool docs ([#62](https://github.com/chrischall/viator-mcp/issues/62)) ([68ca7e0](https://github.com/chrischall/viator-mcp/commit/68ca7e062a8e2d5b2c8ec82796bb375b4d2572d0))

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
