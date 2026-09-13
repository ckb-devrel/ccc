# @ckb-ccc/libp2p

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
