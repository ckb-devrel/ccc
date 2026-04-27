// Example: Query CKB balance for an address

import { ccc } from "@ckb-ccc/ccc";
import { signer } from "@ckb-ccc/playground";

// Get the signer's address
const address = await signer.getRecommendedAddress();
console.log("Address:", address);

// Method 1: Use signer.getBalance() — simplest approach
const balance = await signer.getBalance();
console.log(`Balance (via signer): ${ccc.fixedPointToString(balance)} CKB`);

// Method 2: Use client.getBalanceSingle() — query any address
const { script: lock } = await ccc.Address.fromString(address, signer.client);
const balanceSingle = await signer.client.getBalanceSingle(lock);
console.log(
  `Balance (via client): ${ccc.fixedPointToString(balanceSingle)} CKB`,
);

// Method 3: Use client.getBalance() — query multiple addresses at once
const addrs = await signer.getAddressObjs();
const locks = addrs.map(({ script }) => script);
const totalBalance = await signer.client.getBalance(locks);
console.log(`Total balance: ${ccc.fixedPointToString(totalBalance)} CKB`);
