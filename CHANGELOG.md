# Changelog

## [1.1.2](https://github.com/gravity-ui/expresskit/compare/v1.1.1...v1.1.2) (2023-09-14)


### Bug Fixes

* socket file cleaner ([#25](https://github.com/gravity-ui/expresskit/issues/25)) ([bce6c1a](https://github.com/gravity-ui/expresskit/commit/bce6c1ad744c977ab6cfd2f9431ab24df9574f4b))

## [1.1.1](https://github.com/gravity-ui/expresskit/compare/v1.1.0...v1.1.1) (2023-09-14)


### Bug Fixes

* **socket:** only delete socket if current process is primary one ([#23](https://github.com/gravity-ui/expresskit/issues/23)) ([592a048](https://github.com/gravity-ui/expresskit/commit/592a0486008cb74dafcb3a88c84c5b286d814a2a))

## [1.1.0](https://github.com/gravity-ui/expresskit/compare/v1.0.0...v1.1.0) (2023-09-07)


### Features

* **body-parsers:** increase default limits, add option for extended error info ([#21](https://github.com/gravity-ui/expresskit/issues/21)) ([79b1bc6](https://github.com/gravity-ui/expresskit/commit/79b1bc606c9080a641375d8c9403b08f913b8b56))

## [1.0.0](https://github.com/gravity-ui/expresskit/compare/v0.5.0...v1.0.0) (2023-08-31)


### ⚠ BREAKING CHANGES

* **package:** move nodekit to peer dependencies ([#18](https://github.com/gravity-ui/expresskit/issues/18))

### chore

* **package:** move nodekit to peer dependencies ([#18](https://github.com/gravity-ui/expresskit/issues/18)) ([f74f0f3](https://github.com/gravity-ui/expresskit/commit/f74f0f3acf0e31a71fbcf8cb75518300416e5dbe))

## [0.5.0](https://github.com/gravity-ui/expresskit/compare/v0.4.1...v0.5.0) (2023-08-28)

### Features

* **router:** allow connecting user router via mount route ([#15](https://github.com/gravity-ui/expresskit/issues/15)) ([aded6ed](https://github.com/gravity-ui/expresskit/commit/aded6edbd46ed97dcd12950e02e08768c45697a9))

## [0.4.1](https://github.com/gravity-ui/expresskit/compare/v0.4.0...v0.4.1)

### Bug Fixes

- **router:** fix route auth handler

## [0.4.0](https://github.com/gravity-ui/expresskit/compare/v0.3.0...v0.4.0)

### Features

* export types AppErrorHandler, NextFunction ([#12](https://github.com/gravity-ui/expresskit/issues/12))

## [0.3.0](https://github.com/gravity-ui/expresskit/compare/v0.2.0...v0.3.0)

### Bug Fixes

* move cookie-parser from dev to production deps ([#8](https://github.com/gravity-ui/expresskit/issues/8))

## [0.2.0](https://github.com/gravity-ui/expresskit/compare/v0.1.0...v0.2.0)

### Features

* add AppConfig.telemetryChEnableSelfStats ([#7](https://github.com/gravity-ui/expresskit/issues/7))

## [0.1.2](https://github.com/gravity-ui/expresskit/compare/v0.1.1...v0.1.2)

### Features

* expand express Request type ([#6](https://github.com/gravity-ui/expresskit/issues/6))

## [0.1.1](https://github.com/gravity-ui/expresskit/compare/v0.1.0...v0.1.1)

### Features

* export Request and Response types ([#4](https://github.com/gravity-ui/expresskit/issues/4))

### Bug Fixes

* remove beforeAuth & afterAuth from routeInfo
* replace authPolicyMiddleware with routeInfoMiddleware ([#5](https://github.com/gravity-ui/expresskit/issues/5))
* minor fixes for sockets and routing ([#1](https://github.com/gravity-ui/expresskit/issues/1))

## 0.1.0

Initial release.
