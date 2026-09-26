# @ckb-ccc/libp2p

## 0.3.2

### Patch Changes

- Updated dependencies [[`bb6cbf4`](https://github.com/ckb-devrel/ccc/commit/bb6cbf4ad68438c84faed61d8516530c643f3f4e), [`b21b27d`](https://github.com/ckb-devrel/ccc/commit/b21b27d4d29484b255d95105f6079ebb688b0e5c), [`21bf250`](https://github.com/ckb-devrel/ccc/commit/21bf2505cd9992a000da7a0c6a18b78aac67b34a), [`8b650f0`](https://github.com/ckb-devrel/ccc/commit/8b650f0f06853923a6fa8cf9202f2854d215cf33), [`a7bcb6d`](https://github.com/ckb-devrel/ccc/commit/a7bcb6d4db3e5255d9178a654a872050f86523ce), [`6946dd1`](https://github.com/ckb-devrel/ccc/commit/6946dd123400954a21eccfa71a0fb5b4af271051), [`3506c09`](https://github.com/ckb-devrel/ccc/commit/3506c09a5d16f4ec33ed379b73951b47434e2370), [`665931f`](https://github.com/ckb-devrel/ccc/commit/665931f2e040cc19503f4924453cf9d8d8bec5e8), [`de94e2c`](https://github.com/ckb-devrel/ccc/commit/de94e2c06778af3bcc413dd10f755806874afe45), [`2c91baa`](https://github.com/ckb-devrel/ccc/commit/2c91baaeb7090442264c2067defaa2c34d1d067f)]:
  - @ckb-ccc/core@1.23.0

## 0.3.1

### Patch Changes

- Updated dependencies [[`90891c1`](https://github.com/ckb-devrel/ccc/commit/90891c15049cba439e041acb93868d0d9865d848), [`5be7663`](https://github.com/ckb-devrel/ccc/commit/5be7663ce5857f75c349d111fd6983396365f308), [`99c24ee`](https://github.com/ckb-devrel/ccc/commit/99c24ee6b93ed909aa601c3b4580732d320c14ec)]:
  - @ckb-ccc/core@1.22.1

## 0.3.0

### Minor Changes

- [#547](https://github.com/ckb-devrel/ccc/pull/547) [`7d5781b`](https://github.com/ckb-devrel/ccc/commit/7d5781be9dc48dc0439d173f6aa45f2281c3ac8c) Thanks [@Hanssen0](https://github.com/Hanssen0)! - Add per-request cancellation and timeout options to JSON-RPC transports.
  WebSocket and libp2p transports now cancel individual operations without
  interrupting unrelated requests, and JSON-RPC errors are exposed as
  `JsonRpcError` instances.

- [#547](https://github.com/ckb-devrel/ccc/pull/547) [`8b0a8b5`](https://github.com/ckb-devrel/ccc/commit/8b0a8b50dff0b5ddd8b21c15d5ce1cb8ac4842f0) Thanks [@Hanssen0](https://github.com/Hanssen0)! - Add a relay connection controller that selects an available relay and keeps it
  connected with availability-aware retries. Khie now restores relay and paired
  peer connectivity after network changes.

### Patch Changes

- Updated dependencies [[`3ef932a`](https://github.com/ckb-devrel/ccc/commit/3ef932a471f72704502a708241a960ee44d00377), [`0d5cd4b`](https://github.com/ckb-devrel/ccc/commit/0d5cd4bc7113686675dfa5c94a1abacfb9b3e073), [`26f9c4d`](https://github.com/ckb-devrel/ccc/commit/26f9c4d0d77d35bfba0d74483458a24a2077fac9), [`7d5781b`](https://github.com/ckb-devrel/ccc/commit/7d5781be9dc48dc0439d173f6aa45f2281c3ac8c), [`7680821`](https://github.com/ckb-devrel/ccc/commit/7680821e0c113a790f00e0fe53e0d69f92588ce4), [`72309f6`](https://github.com/ckb-devrel/ccc/commit/72309f666471720d4e808c39916a630aa21891f7), [`4cddf9b`](https://github.com/ckb-devrel/ccc/commit/4cddf9bfad50036672dfa3d29c89baea6af1e237), [`7d98b67`](https://github.com/ckb-devrel/ccc/commit/7d98b67137927b39577fa5429f1fa18a7242f88b)]:
  - @ckb-ccc/core@1.22.0

## 0.2.1

### Patch Changes

- [#538](https://github.com/ckb-devrel/ccc/pull/538) [`272dd4e`](https://github.com/ckb-devrel/ccc/commit/272dd4e1c4cbd4e2027d78379b92cb25df9f111d) Thanks [@Hanssen0](https://github.com/Hanssen0)! - Show the Khie pairing guidance for every invalid endpoint input instead of
  exposing low-level parsing errors.

## 0.2.0

### Minor Changes

- [#532](https://github.com/ckb-devrel/ccc/pull/532) [`47bd5cb`](https://github.com/ckb-devrel/ccc/commit/47bd5cb4fb23949ab01a7300ce1de2dc7ea61e40) Thanks [@Hanssen0](https://github.com/Hanssen0)! - Improve long-lived Khie connections by redialing known addresses for every
  JSON-RPC stream, sharing address updates with Identify Push, and retaining
  learned addresses for the session.

- [#532](https://github.com/ckb-devrel/ccc/pull/532) [`3fddda3`](https://github.com/ckb-devrel/ccc/commit/3fddda3d1ec1b6d2c693b77431c04c2d0167b781) Thanks [@Hanssen0](https://github.com/Hanssen0)! - Improve Khie reconnection across disconnects and page suspension, preserving
  active pairings and restoring direct connections when possible.

### Patch Changes

- Updated dependencies [[`182b880`](https://github.com/ckb-devrel/ccc/commit/182b880bd6343b7ecdc1f5732c1f72cd5a22a44d)]:
  - @ckb-ccc/core@1.21.0

## 0.1.0

### Minor Changes

- [#525](https://github.com/ckb-devrel/ccc/pull/525) [`f8c79a5`](https://github.com/ckb-devrel/ccc/commit/f8c79a5dc6f60a52b286b5caa744f00ad2d0ffb4) Thanks [@Hanssen0](https://github.com/Hanssen0)! - Improve Khie connection fallback and path selection. Allow configuring the
  default Relay and add the `hide-mark` Connector attribute.

- [#523](https://github.com/ckb-devrel/ccc/pull/523) [`58b3b4d`](https://github.com/ckb-devrel/ccc/commit/58b3b4d307f5eb65f5f710127cb3bd5bf3191d22) Thanks [@Hanssen0](https://github.com/Hanssen0)! - Expose the actual stream connection on incoming JSON-RPC requests so consumers
  can report the transport path used by each request.

### Patch Changes

- Updated dependencies [[`58b3b4d`](https://github.com/ckb-devrel/ccc/commit/58b3b4d307f5eb65f5f710127cb3bd5bf3191d22), [`fc937f0`](https://github.com/ckb-devrel/ccc/commit/fc937f08f9e33c852697831dc5b17a9423fd9e3f)]:
  - @ckb-ccc/core@1.20.1

## 0.0.2

### Patch Changes

- [#503](https://github.com/ckb-devrel/ccc/pull/503) [`d32d14e`](https://github.com/ckb-devrel/ccc/commit/d32d14e8c06e3673828ab2bf2a4d6495d045e541) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(libp2p): add peer pairing and JSON-RPC services and transports for Khie
  connections.
- Updated dependencies [[`1c74033`](https://github.com/ckb-devrel/ccc/commit/1c74033df94fc11b61296c6fc00e9955ff602c72), [`6cfe9e1`](https://github.com/ckb-devrel/ccc/commit/6cfe9e1db55e520cf4347b45b704df90f7dfe331), [`88c8df6`](https://github.com/ckb-devrel/ccc/commit/88c8df68d75b36d7adf0cfb8598091056ac0c798), [`095fb8f`](https://github.com/ckb-devrel/ccc/commit/095fb8fc754ba54e89aec8c3e58b88b6c373ec2a), [`cdc5b1a`](https://github.com/ckb-devrel/ccc/commit/cdc5b1ac13ce73fa60d79b90cb0400f860f93f27), [`eff7117`](https://github.com/ckb-devrel/ccc/commit/eff7117b84b008ac9b7835d355a92f85a19c634e), [`5f2a6ab`](https://github.com/ckb-devrel/ccc/commit/5f2a6ab0a41b9b0c819c7fc62d6eb0b22a8288e6), [`4fabb6a`](https://github.com/ckb-devrel/ccc/commit/4fabb6afbd58aee7d4bfb792660f82fe673ffbb9), [`235cd97`](https://github.com/ckb-devrel/ccc/commit/235cd9788543e300e4dceef20ad664a4666feba2), [`463846d`](https://github.com/ckb-devrel/ccc/commit/463846d99e7123846286b3c6a9811b75e5a58437), [`f6aafb2`](https://github.com/ckb-devrel/ccc/commit/f6aafb2886ad747fed24e218f9b9b54e15071ee9)]:
  - @ckb-ccc/core@1.20.0
