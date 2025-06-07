# @ckb-ccc/core

## 1.9.0
### Minor Changes



- [#209](https://github.com/ckb-devrel/ccc/pull/209) [`77865cd`](https://github.com/ckb-devrel/ccc/commit/77865cd2953e5e01d6dc610823ad3eb13e128902) Thanks [@Alive24](https://github.com/Alive24)! - feat: compatible mode for molecule decode



- [#216](https://github.com/ckb-devrel/ccc/pull/216) [`46f1760`](https://github.com/ckb-devrel/ccc/commit/46f1760cdd5d6cf3d843e9fe8682f9cd4f31930d) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): try to avoid extra udt occupation



- [#197](https://github.com/ckb-devrel/ccc/pull/197) [`2da4dc5`](https://github.com/ckb-devrel/ccc/commit/2da4dc5b5637b307c8010ccc22ef3f79c7dcca83) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat: add support for multisig script v2
  
  Add support for the updated CKB system scripts, specifically the multisig script v2 that enhances handling for optional since value (PR nervosnetwork/ckb-system-scripts#99). This update addresses functional defects that caused transaction validation failures.

### Patch Changes



- [#195](https://github.com/ckb-devrel/ccc/pull/195) [`0f3aa3f`](https://github.com/ckb-devrel/ccc/commit/0f3aa3fe7798826e57fb8092a679320fb4dfc140) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): keep molecule entity class name



- [#188](https://github.com/ckb-devrel/ccc/pull/188) [`34fc83d`](https://github.com/ckb-devrel/ccc/commit/34fc83d316a99889f3019d8069c478113506fe7a) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): SignerNostrPrivateKey support nsec key

## 1.8.1

### Patch Changes

- [#205](https://github.com/ckb-devrel/ccc/pull/205) [`2e37ad7`](https://github.com/ckb-devrel/ccc/commit/2e37ad72fb98f3d7dc059299dafc9bba84dcb846) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): falsy value is not empty in mol.Option

## 1.8.0

### Minor Changes

- [#159](https://github.com/ckb-devrel/ccc/pull/159) [`80e605d`](https://github.com/ckb-devrel/ccc/commit/80e605d0645e87b4e8b5be85c63322f7a3926e38) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): stringify util

- [#171](https://github.com/ckb-devrel/ccc/pull/171) [`8c7e000`](https://github.com/ckb-devrel/ccc/commit/8c7e00069a276ac58afa4737623e95656d4852c5) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): Dao related utils

- [#179](https://github.com/ckb-devrel/ccc/pull/179) [`732ad59`](https://github.com/ckb-devrel/ccc/commit/732ad59f13ea2cd47003033e30b310b8ff26f058) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix: add inputs after cobuild witness injected

- [#173](https://github.com/ckb-devrel/ccc/pull/173) [`815fb4d`](https://github.com/ckb-devrel/ccc/commit/815fb4da3432b889b848eb70943d725988fe611d) Thanks [@ashuralyk](https://github.com/ashuralyk)! - Add treatment to uncompatible XUDT data format

- [#158](https://github.com/ckb-devrel/ccc/pull/158) [`d584059`](https://github.com/ckb-devrel/ccc/commit/d584059644e8bcd3a0ea8b0314fdcbb68ee66013) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): more rpc calls cache

- [#171](https://github.com/ckb-devrel/ccc/pull/171) [`f58d398`](https://github.com/ckb-devrel/ccc/commit/f58d3980f08da1f3fa19cee45aa50c8b293294ea) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): Transaction.getFee

- [#153](https://github.com/ckb-devrel/ccc/pull/153) [`1e88ad8`](https://github.com/ckb-devrel/ccc/commit/1e88ad8743428b46b28fe790bd559b96df8a6ce4) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): fee rate checks

- [#158](https://github.com/ckb-devrel/ccc/pull/158) [`6f10589`](https://github.com/ckb-devrel/ccc/commit/6f1058977e7aa113808fa74793f1ad5d672626d2) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): Transaction utils

- [#182](https://github.com/ckb-devrel/ccc/pull/182) [`601a729`](https://github.com/ckb-devrel/ccc/commit/601a7291e877b39c4032c95fab421ed3d41404c2) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): SignerNostrPublicKeyReadonly

- [#171](https://github.com/ckb-devrel/ccc/pull/171) [`074b4cd`](https://github.com/ckb-devrel/ccc/commit/074b4cd3b0cdc925dc9ef99e8146564a60646f1e) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): calculate Nervos DAO profit as input capacity

### Patch Changes

- [#166](https://github.com/ckb-devrel/ccc/pull/166) [`90b6e9f`](https://github.com/ckb-devrel/ccc/commit/90b6e9fee543b6ee16b96e27d6f86ff33fc57029) Thanks [@Hanssen0](https://github.com/Hanssen0)! - chore: bump @joyid/ckb version

- [#153](https://github.com/ckb-devrel/ccc/pull/153) [`def62a0`](https://github.com/ckb-devrel/ccc/commit/def62a08bf908c6a21fe91c8db2c60848a2ada52) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): uncatched websocket error

- [#159](https://github.com/ckb-devrel/ccc/pull/159) [`d7728d9`](https://github.com/ckb-devrel/ccc/commit/d7728d9edb46c9c5a2bfeb342fc68a8b1c0fec5d) Thanks [@Hanssen0](https://github.com/Hanssen0)! - chore(core): remove ankr public node from default

- [#177](https://github.com/ckb-devrel/ccc/pull/177) [`ab195a0`](https://github.com/ckb-devrel/ccc/commit/ab195a024aeee5e21ed19d89c2cf1bf8d52bb380) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): negative number for numToByte

- [`29a2e22`](https://github.com/ckb-devrel/ccc/commit/29a2e223b902ed23523e4948ab3fca793f9e5b01) Thanks [@Hanssen0](https://github.com/Hanssen0)! - chore: bump @joyid/ckb version

## 1.5.0

### Minor Changes

- [#141](https://github.com/ckb-devrel/ccc/pull/141) [`28c211d`](https://github.com/ckb-devrel/ccc/commit/28c211d839a2d2305eca56e82ba7da144aa3df4a) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): TransportFallback

## 1.4.0

### Minor Changes

- [#140](https://github.com/ckb-devrel/ccc/pull/140) [`f429087`](https://github.com/ckb-devrel/ccc/commit/f4290874dfab3fe58844e5169673c5d47bda64e3) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): SignerNostrPrivateKey

### Patch Changes

- [#138](https://github.com/ckb-devrel/ccc/pull/138) [`3fdb2c4`](https://github.com/ckb-devrel/ccc/commit/3fdb2c477d0b2766b231e436b8f396f047b02634) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): codec should throw if byteLength mismatch

## 1.3.1

### Patch Changes

- [`a48cccf`](https://github.com/ckb-devrel/ccc/commit/a48cccfae3ce6b3456a5eb863f207e7e5a6e568f) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): numFrom("0x") should be zero

## 1.3.0

### Minor Changes

- [#131](https://github.com/ckb-devrel/ccc/pull/131) [`4c76f9e`](https://github.com/ckb-devrel/ccc/commit/4c76f9e2a93a226fcfc4c32a5378bb531bfff08f) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): Transaction.completeInputs(Add/AtLeast)One

- [#131](https://github.com/ckb-devrel/ccc/pull/131) [`c2c4c26`](https://github.com/ckb-devrel/ccc/commit/c2c4c264e04461948e4b913b2f22054e6032ddc8) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): RequestorJsonRpc

- [#131](https://github.com/ckb-devrel/ccc/pull/131) [`b6a73fa`](https://github.com/ckb-devrel/ccc/commit/b6a73fa9628ebdff51cb8f246309654cd53e36f2) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): extra molecule codecs

- [#130](https://github.com/ckb-devrel/ccc/pull/130) [`8c97c85`](https://github.com/ckb-devrel/ccc/commit/8c97c851db4a2d940c7e59116ca7620cfd0afae1) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat: SSRI & UDT SDK

### Patch Changes

- [#131](https://github.com/ckb-devrel/ccc/pull/131) [`4dbf4fd`](https://github.com/ckb-devrel/ccc/commit/4dbf4fd8021cf14d05282706a7667ea7d108fb09) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): numFrom("0x") should be 0

## 1.2.3

### Patch Changes

- [#127](https://github.com/ckb-devrel/ccc/pull/127) [`01263bd`](https://github.com/ckb-devrel/ccc/commit/01263bd8c601fa8fcdfa24be52601716e1864843) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix: numFromBytes modifies the args

## 1.2.2

### Patch Changes

- [#120](https://github.com/ckb-devrel/ccc/pull/120) [`7886e3d`](https://github.com/ckb-devrel/ccc/commit/7886e3d89e9ca8f3514a2044c6dd4e8ec6b49933) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix: support ws:// rpc

## 1.2.1

### Patch Changes

- [#118](https://github.com/ckb-devrel/ccc/pull/118) [`94e2618`](https://github.com/ckb-devrel/ccc/commit/94e26182515e09d6086ec5b653d091f117a499e6) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix: client concurrent should be FIFO

## 1.2.0

### Minor Changes

- [#116](https://github.com/ckb-devrel/ccc/pull/116) [`128e87b`](https://github.com/ckb-devrel/ccc/commit/128e87b5ca3e97bfe7842e76f786aa6aec010797) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat: Client LRU cache

## 1.1.1

### Patch Changes

- [#114](https://github.com/ckb-devrel/ccc/pull/114) [`925991c`](https://github.com/ckb-devrel/ccc/commit/925991c8a24b1f34667e30b28b69812e936e3928) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix: udtBalanceFrom

## 1.1.0

### Minor Changes

- [#112](https://github.com/ckb-devrel/ccc/pull/112) [`ddc0a28`](https://github.com/ckb-devrel/ccc/commit/ddc0a281c3d1dfa6ebc990dae92994f026dfddcc) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat: set maxConcurrent for ClientJsonRpc

## 1.0.1

### Patch Changes

- [#111](https://github.com/ckb-devrel/ccc/pull/111) [`719055b`](https://github.com/ckb-devrel/ccc/commit/719055b404f31b40362f51714b9f11c85b857581) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix: call stack overflow caused by spread operator

- [#109](https://github.com/ckb-devrel/ccc/pull/109) [`94caaca`](https://github.com/ckb-devrel/ccc/commit/94caaca11c63752a25282d42f51161c94397dec6) Thanks [@Hanssen0](https://github.com/Hanssen0)! - refactor: remove redundant code

## 1.0.0

### Major Changes

- [#107](https://github.com/ckb-devrel/ccc/pull/107) [`b99f55f`](https://github.com/ckb-devrel/ccc/commit/b99f55f74e64106391ce53f7d0bd0fa7522023cc) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat: molecule

## 0.1.2

### Patch Changes

- [#103](https://github.com/ckb-devrel/ccc/pull/103) [`c1cb910`](https://github.com/ckb-devrel/ccc/commit/c1cb91091780c7b33fbbd683ef8edc9f11452ecd) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix: ccc core commonjs

## 0.1.1

### Patch Changes

- [#101](https://github.com/ckb-devrel/ccc/pull/101) [`d9affcc`](https://github.com/ckb-devrel/ccc/commit/d9affcc01c7b839b227e4d79bcb66e717577502a) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix: commonjs

## 0.1.0

### Minor Changes

- [#74](https://github.com/ckb-devrel/ccc/pull/74) [`f21d7e4`](https://github.com/ckb-devrel/ccc/commit/f21d7e4cf422edab4a836ef6d678b620594fef8d) Thanks [@Hanssen0](https://github.com/Hanssen0)! - add spore package and some known scripts

### Patch Changes

- [#72](https://github.com/ckb-devrel/ccc/pull/72) [`a3d5359`](https://github.com/ckb-devrel/ccc/commit/a3d53595f6dd11f2f59cdf0086b3d7ce558a2fdd) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): reopen websocket

- [#69](https://github.com/ckb-devrel/ccc/pull/69) [`8824ff2`](https://github.com/ckb-devrel/ccc/commit/8824ff27af3b76186f1a7d6db8c907cd66f09d6a) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): Client.waitTransaction

- [#88](https://github.com/ckb-devrel/ccc/pull/88) [`f07a506`](https://github.com/ckb-devrel/ccc/commit/f07a506bd6fc27fe659a17d2f7baaeec54716d81) Thanks [@ashuralyk](https://github.com/ashuralyk)! - feat: molecule codec
  feat: spore searcher

- [#70](https://github.com/ckb-devrel/ccc/pull/70) [`acfc050`](https://github.com/ckb-devrel/ccc/commit/acfc0502cd6beb48b9310dec8411dcd630507366) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): websocket transport

- [#64](https://github.com/ckb-devrel/ccc/pull/64) [`1720d5a`](https://github.com/ckb-devrel/ccc/commit/1720d5a398543f1c6e24763eeaf15d84cd2214bf) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): ckb proxy locks

- [#96](https://github.com/ckb-devrel/ccc/pull/96) [`e63a06e`](https://github.com/ckb-devrel/ccc/commit/e63a06ee75ac8595208d216dec88a4228c465e23) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat: support doge signer

- [#67](https://github.com/ckb-devrel/ccc/pull/67) [`c092988`](https://github.com/ckb-devrel/ccc/commit/c092988e7765b9ac79498d6bd72a6a2f62859b6f) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): auto fee rate

- [`50f2ce0`](https://github.com/ckb-devrel/ccc/commit/50f2ce08e74cb3fbeae926267d42e28b426fd7f4) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): missing mol types

- [#92](https://github.com/ckb-devrel/ccc/pull/92) [`4709384`](https://github.com/ckb-devrel/ccc/commit/4709384e37188991cb937b16f99f47ca82c912b8) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix: `epochFromHex` failed if the arg is not 7 bytes

## 0.1.0-alpha.7

### Patch Changes

- [#88](https://github.com/ckb-devrel/ccc/pull/88) [`f07a506`](https://github.com/ckb-devrel/ccc/commit/f07a506bd6fc27fe659a17d2f7baaeec54716d81) Thanks [@ashuralyk](https://github.com/ashuralyk)! - feat: molecule codec
  feat: spore searcher

## 0.1.0-alpha.6

### Patch Changes

- [#92](https://github.com/ckb-devrel/ccc/pull/92) [`4709384`](https://github.com/ckb-devrel/ccc/commit/4709384e37188991cb937b16f99f47ca82c912b8) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix: `epochFromHex` failed if the arg is not 7 bytes

## 0.1.0-alpha.5

### Patch Changes

- [`50f2ce0`](https://github.com/ckb-devrel/ccc/commit/50f2ce08e74cb3fbeae926267d42e28b426fd7f4) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): missing mol types

## 0.1.0-alpha.4

### Minor Changes

- [#74](https://github.com/ckb-devrel/ccc/pull/74) [`f21d7e4`](https://github.com/ckb-devrel/ccc/commit/f21d7e4cf422edab4a836ef6d678b620594fef8d) Thanks [@Hanssen0](https://github.com/Hanssen0)! - add spore package and some known scripts

## 0.0.16-alpha.3

### Patch Changes

- [#72](https://github.com/ckb-devrel/ccc/pull/72) [`a3d5359`](https://github.com/ckb-devrel/ccc/commit/a3d53595f6dd11f2f59cdf0086b3d7ce558a2fdd) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): reopen websocket

## 0.0.16-alpha.2

### Patch Changes

- [#70](https://github.com/ckb-devrel/ccc/pull/70) [`acfc050`](https://github.com/ckb-devrel/ccc/commit/acfc0502cd6beb48b9310dec8411dcd630507366) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): websocket transport

## 0.0.16-alpha.1

### Patch Changes

- [#69](https://github.com/ckb-devrel/ccc/pull/69) [`8824ff2`](https://github.com/ckb-devrel/ccc/commit/8824ff27af3b76186f1a7d6db8c907cd66f09d6a) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): Client.waitTransaction

- [#67](https://github.com/ckb-devrel/ccc/pull/67) [`c092988`](https://github.com/ckb-devrel/ccc/commit/c092988e7765b9ac79498d6bd72a6a2f62859b6f) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): auto fee rate

## 0.0.16-alpha.0

### Patch Changes

- [#64](https://github.com/ckb-devrel/ccc/pull/64) [`1720d5a`](https://github.com/ckb-devrel/ccc/commit/1720d5a398543f1c6e24763eeaf15d84cd2214bf) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): ckb proxy locks

## 0.0.15

### Patch Changes

- [`8f2560a`](https://github.com/ckb-devrel/ccc/commit/8f2560ab0e5619654fff7c5eacda8425385f908e) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): typed client errors

## 0.0.14

### Patch Changes

- [`5e942f8`](https://github.com/ckb-devrel/ccc/commit/5e942f8f1ed678abdb7ab9716f5449f0714cea53) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): numLeFromBytes should not modify args

- [`f5b5938`](https://github.com/ckb-devrel/ccc/commit/f5b5938ab8f9c0a338dfd6765fe717f7ad1b1dd8) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): ErrorClient types

  - ErrorClientRBFRejected
  - ErrorClientDuplicatedTransaction

- [#56](https://github.com/ckb-devrel/ccc/pull/56) [`f13f4d3`](https://github.com/ckb-devrel/ccc/commit/f13f4d319ca66b571029a65e945e3a038bfeea25) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): Signer.findTransactions

- [#50](https://github.com/ckb-devrel/ccc/pull/50) [`7ba62a0`](https://github.com/ckb-devrel/ccc/commit/7ba62a056f17808fe5684786c00c2dff80bb7d1d) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): jsonrpc id conflict

- [`2164efd`](https://github.com/ckb-devrel/ccc/commit/2164efd6d834c1917ad5f4a514dc25941f937185) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): Support ACP addresses for private key signer

- [`e5bd2ad`](https://github.com/ckb-devrel/ccc/commit/e5bd2ad5de4b42a22c422ecfc42056750f69b88b) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): since encoding

- [#48](https://github.com/ckb-devrel/ccc/pull/48) [`aae3e06`](https://github.com/ckb-devrel/ccc/commit/aae3e0679fb940dd8c12ac9be12a4b53277a339d) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): readable client error

## 0.0.14-alpha.2

### Patch Changes

- [#50](https://github.com/ckb-devrel/ccc/pull/50) [`7ba62a0`](https://github.com/ckb-devrel/ccc/commit/7ba62a056f17808fe5684786c00c2dff80bb7d1d) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): jsonrpc id conflict

## 0.0.14-alpha.1

### Patch Changes

- [`5e942f8`](https://github.com/ckb-devrel/ccc/commit/5e942f8f1ed678abdb7ab9716f5449f0714cea53) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): numLeFromBytes should not modify args

- [`e5bd2ad`](https://github.com/ckb-devrel/ccc/commit/e5bd2ad5de4b42a22c422ecfc42056750f69b88b) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): since encoding

- [#48](https://github.com/ckb-devrel/ccc/pull/48) [`aae3e06`](https://github.com/ckb-devrel/ccc/commit/aae3e0679fb940dd8c12ac9be12a4b53277a339d) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): readable client error

## 0.0.14-alpha.0

### Patch Changes

- [`f5b5938`](https://github.com/ckb-devrel/ccc/commit/f5b5938ab8f9c0a338dfd6765fe717f7ad1b1dd8) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): ErrorClient types

  - ErrorClientRBFRejected
  - ErrorClientDuplicatedTransaction

- [`2164efd`](https://github.com/ckb-devrel/ccc/commit/2164efd6d834c1917ad5f4a514dc25941f937185) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): Support ACP addresses for private key signer

## 0.0.13

### Patch Changes

- [`3378e85`](https://github.com/ckb-devrel/ccc/commit/3378e85b32797f5cdc1943b9ecaca1fd1d9fad5e) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): web socket

- [`8629449`](https://github.com/ckb-devrel/ccc/commit/86294490e76fc2a1cee20f827883e02fceca6e8b) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): ClientCache.clear

  replaced ClientCache.revertTransactions

- [`6d62032`](https://github.com/ckb-devrel/ccc/commit/6d620326f42f8c48eff9deb95578cf28d7bf5c97) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): recordCells should not add usableCells

- [`3658797`](https://github.com/ckb-devrel/ccc/commit/3658797e67c42c56b20fa66481d0455ed019e69f) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): node.js websocket

- [#25](https://github.com/ckb-devrel/ccc/pull/25) [`69c10fd`](https://github.com/ckb-devrel/ccc/commit/69c10fdfcd507433c13b15d17015dca4687afb97) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(utxo-global): switchNetwork

- [`600cc13`](https://github.com/ckb-devrel/ccc/commit/600cc137ac6eb7c5b2533670de6df29d82f1b9e1) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): extra infos in the response of getTransaction

  - blockNumber
  - blockHash
  - cycles
  - reason (When failed)
  - txIndex (After CKB 0.118)

- [`642f731`](https://github.com/ckb-devrel/ccc/commit/642f7317f4951ef801f1245aea96c40b4b6fb73e) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): custom ClientCache

- [`96dbb61`](https://github.com/ckb-devrel/ccc/commit/96dbb6107d2071b9383350ddd578557746227054) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): custom client cache

- [`0462a4e`](https://github.com/ckb-devrel/ccc/commit/0462a4ee101926f0da857173626dc4ab879e3b56) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): Client.getCellLive

- [`52156f9`](https://github.com/ckb-devrel/ccc/commit/52156f9df9cae9e0b71b77b49cda0e4d73e76142) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): ClientCache.revertTransaction

- [`63606db`](https://github.com/ckb-devrel/ccc/commit/63606db908f95bfc857430083932144d1ef4deef) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(coree): typed errors

- [`44c7fee`](https://github.com/ckb-devrel/ccc/commit/44c7feed37369836268fba21884418682f15254b) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): completeInputs

- [`1043c2b`](https://github.com/ckb-devrel/ccc/commit/1043c2bc211ec283b88dba3b81feef98e4185c0e) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): nervos dao script

- [`079e20e`](https://github.com/ckb-devrel/ccc/commit/079e20ef14cf9a7c06bbaddf3e92cbfbb005da11) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): more APIs. Since parsing.

- [`1f999f8`](https://github.com/ckb-devrel/ccc/commit/1f999f854beb255b3cd9dbbc5a7268e75442b3db) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): ClientCache.markTransactions

- [`a69a9dc`](https://github.com/ckb-devrel/ccc/commit/a69a9dc0c722f7b4cfa36b2ae8ecba4dcde0db90) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): completeInputsAll

- [`ed154d1`](https://github.com/ckb-devrel/ccc/commit/ed154d189e239907ad686ec51ac8133b6d5eb895) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): Signer.findCells

## 0.0.13-alpha.8

### Patch Changes

- [`8629449`](https://github.com/ckb-devrel/ccc/commit/86294490e76fc2a1cee20f827883e02fceca6e8b) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): ClientCache.clear

  replaced ClientCache.revertTransactions

- [`52156f9`](https://github.com/ckb-devrel/ccc/commit/52156f9df9cae9e0b71b77b49cda0e4d73e76142) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): ClientCache.revertTransaction

- [`63606db`](https://github.com/ckb-devrel/ccc/commit/63606db908f95bfc857430083932144d1ef4deef) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(coree): typed errors

## 0.0.13-alpha.7

### Patch Changes

- [`1043c2b`](https://github.com/ckb-devrel/ccc/commit/1043c2bc211ec283b88dba3b81feef98e4185c0e) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): nervos dao script

- [`079e20e`](https://github.com/ckb-devrel/ccc/commit/079e20ef14cf9a7c06bbaddf3e92cbfbb005da11) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): more APIs. Since parsing.

- [`ed154d1`](https://github.com/ckb-devrel/ccc/commit/ed154d189e239907ad686ec51ac8133b6d5eb895) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): Signer.findCells

## 0.0.13-alpha.6

### Patch Changes

- [#25](https://github.com/ckb-devrel/ccc/pull/25) [`69c10fd`](https://github.com/ckb-devrel/ccc/commit/69c10fdfcd507433c13b15d17015dca4687afb97) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(utxo-global): switchNetwork

- [`44c7fee`](https://github.com/ckb-devrel/ccc/commit/44c7feed37369836268fba21884418682f15254b) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): completeInputs

## 0.0.13-alpha.5

### Patch Changes

- [`6d62032`](https://github.com/ckb-devrel/ccc/commit/6d620326f42f8c48eff9deb95578cf28d7bf5c97) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): recordCells should not add usableCells

## 0.0.13-alpha.4

### Patch Changes

- [`3658797`](https://github.com/ckb-devrel/ccc/commit/3658797e67c42c56b20fa66481d0455ed019e69f) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): node.js websocket

- [`642f731`](https://github.com/ckb-devrel/ccc/commit/642f7317f4951ef801f1245aea96c40b4b6fb73e) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): custom ClientCache

## 0.0.13-alpha.3

### Patch Changes

- [`1f999f8`](https://github.com/ckb-devrel/ccc/commit/1f999f854beb255b3cd9dbbc5a7268e75442b3db) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): ClientCache.markTransactions

## 0.0.13-alpha.2

### Patch Changes

- [`96dbb61`](https://github.com/ckb-devrel/ccc/commit/96dbb6107d2071b9383350ddd578557746227054) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): custom client cache

## 0.0.13-alpha.1

### Patch Changes

- [`3378e85`](https://github.com/ckb-devrel/ccc/commit/3378e85b32797f5cdc1943b9ecaca1fd1d9fad5e) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): web socket

- [`a69a9dc`](https://github.com/ckb-devrel/ccc/commit/a69a9dc0c722f7b4cfa36b2ae8ecba4dcde0db90) Thanks [@Hanssen0](https://github.com/Hanssen0)! - fix(core): completeInputsAll

## 0.0.13-alpha.0

### Patch Changes

- [`600cc13`](https://github.com/ckb-devrel/ccc/commit/600cc137ac6eb7c5b2533670de6df29d82f1b9e1) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(core): extra infos in the response of getTransaction

  - blockNumber
  - blockHash
  - cycles
  - reason (When failed)
  - txIndex (After CKB 0.118)

## 0.0.12
