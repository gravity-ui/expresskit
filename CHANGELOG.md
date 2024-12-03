# Changelog

## [2.2.0](https://github.com/gravity-ui/expresskit/compare/v2.1.0...v2.2.0) (2024-12-03)


### Features

* support @gravity-ui/nodekit v2 ([#61](https://github.com/gravity-ui/expresskit/issues/61)) ([677056a](https://github.com/gravity-ui/expresskit/commit/677056a300c254a4ce5998a5d63df12fa32781dd))


### Bug Fixes

* remove log query string from url for every ctx log ([#56](https://github.com/gravity-ui/expresskit/issues/56)) ([60dc7d9](https://github.com/gravity-ui/expresskit/commit/60dc7d94f48cee3b1a62bc6e89e3322c0e34b8a7))

## [2.1.0](https://github.com/gravity-ui/expresskit/compare/v2.0.1...v2.1.0) (2024-10-21)


### Features

* add language detection ([#52](https://github.com/gravity-ui/expresskit/issues/52)) ([8962847](https://github.com/gravity-ui/expresskit/commit/8962847df2dc8903a8002e4156de03576e1807f6))

## [2.0.1](https://github.com/gravity-ui/expresskit/compare/v2.0.0...v2.0.1) (2024-10-14)


### Bug Fixes

* update express and cookie-parser ([#54](https://github.com/gravity-ui/expresskit/issues/54)) ([9da8f4f](https://github.com/gravity-ui/expresskit/commit/9da8f4fa1a1b827594f8de46d21f162708b17e48))

## [2.0.0](https://github.com/gravity-ui/expresskit/compare/v1.5.0...v2.0.0) (2024-10-11)


### ⚠ BREAKING CHANGES

* add logging ctx data to every log ([#47](https://github.com/gravity-ui/expresskit/issues/47))

### Features

* add logging ctx data to every log ([#47](https://github.com/gravity-ui/expresskit/issues/47)) ([6493595](https://github.com/gravity-ui/expresskit/commit/64935955d22ffa87906b01c497dc13d1c87904c4))


### Bug Fixes

* update dependencies ([#48](https://github.com/gravity-ui/expresskit/issues/48)) ([d750d37](https://github.com/gravity-ui/expresskit/commit/d750d376a156814f6fde6930b84d81b6d2314457))

## [1.5.0](https://github.com/gravity-ui/expresskit/compare/v1.4.0...v1.5.0) (2024-09-30)


### Features

* **deps:** update dependencies ([#45](https://github.com/gravity-ui/expresskit/issues/45)) ([565efa6](https://github.com/gravity-ui/expresskit/commit/565efa6d28444683752f7d7443f1a25357d6973f))

## [1.4.0](https://github.com/gravity-ui/expresskit/compare/v1.3.0...v1.4.0) (2024-07-26)


### Features

* **deps:** update deps & peer dependency for nodekit ([#41](https://github.com/gravity-ui/expresskit/issues/41)) ([e468c17](https://github.com/gravity-ui/expresskit/commit/e468c17fa8b08d0553fd999ee59044c1b155af11))

## [1.3.0](https://github.com/gravity-ui/expresskit/compare/v1.2.1...v1.3.0) (2024-07-04)


### Features

* add express cookie secret as array for rotation ([#38](https://github.com/gravity-ui/expresskit/issues/38)) ([df34df1](https://github.com/gravity-ui/expresskit/commit/df34df1298e2cd97ad6c758f9975b0db7e3f012f))

## [1.2.1](https://github.com/gravity-ui/expresskit/compare/v1.2.0...v1.2.1) (2024-02-02)


### Bug Fixes

* **sensitive-tokens:** hide sensitive tokens on 'Request starter' log ([#31](https://github.com/gravity-ui/expresskit/issues/31)) ([860da65](https://github.com/gravity-ui/expresskit/commit/860da6530beeb158fafcee6b7e2fdbb3aa2b0fb9))

## [1.2.0](https://github.com/gravity-ui/expresskit/compare/v1.1.2...v1.2.0) (2023-10-18)


### Features

* add CSP support ([#29](https://github.com/gravity-ui/expresskit/issues/29)) ([85e2a92](https://github.com/gravity-ui/expresskit/commit/85e2a929a9c1d80d5cc6e213002207244225a085)), closes [#9](https://github.com/gravity-ui/expresskit/issues/9)
* use REQUEST_ID_PARAM_NAME ([#27](https://github.com/gravity-ui/expresskit/issues/27)) ([fe0014d](https://github.com/gravity-ui/expresskit/commit/fe0014d46abd196e6953d2a05f756acf6b5b24bc))


### Bug Fixes

* prevent socket unlinking in worker threads ([#30](https://github.com/gravity-ui/expresskit/issues/30)) ([c27fdd8](https://github.com/gravity-ui/expresskit/commit/c27fdd85a9267cde2468d966bbdab54d0caa904e))

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
