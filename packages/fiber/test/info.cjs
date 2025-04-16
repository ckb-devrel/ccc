const { FiberSDK } = require("../dist.commonjs/index.js");
// Custom error handling function
function handleRPCError(error) {
  if (error.error && error.error.code === -32601) {
    console.error(
      "Error: Node may not be running or RPC method does not exist",
    );
    console.error("Please ensure:");
    console.error("1. Fiber node is started");
    console.error(
      "2. Node RPC address is correct (current: http://127.0.0.1:8227)",
    );
    console.error("3. Node RPC interface is available");
  } else if (error.error && error.error.code === -32602) {
    console.error("Error: Invalid parameters");
    console.error("Please check:");
    console.error("1. Parameter types are correct");
    console.error("2. Parameter values are within valid range");
    console.error("3. All required parameters are provided");
  } else {
    console.error("RPC Error:", error.message);
    if (error.error && error.error.data) {
      console.error("Error details:", error.error.data);
    }
  }
}

// Convert hexadecimal string to number
function hexToNumber(hex) {
  if (!hex) return 0;
  return parseInt(hex.replace("0x", ""), 16);
}

async function testNodeInfo() {
  try {
    // Initialize SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("Starting node info test...\n");

    try {
      // Get node information
      console.log("Calling node_info method...");
      const info = await sdk.nodeInfo();
      console.log(info);
      // // Output node information
      // console.log("\nNode Information:");
      // console.log("Node Name:", info.node_name);
      // console.log("Node ID:", info.node_id);
      // console.log("Addresses:", info.addresses);
      // console.log("Chain Hash:", info.chain_hash);
      // console.log(
      //   "Auto Accept Min CKB Funding Amount:",
      //   info.auto_accept_min_ckb_funding_amount,
      // );
      // console.log("UDT Config Info:", info.udt_cfg_infos);
      // console.log(
      //   "Timestamp:",
      //   new Date(Number(info.timestamp)).toLocaleString(),
      // );
    } catch (error) {
      if (error.error) {
        handleRPCError(error);
      } else {
        console.error("Failed to get node info:", error.message);
      }
    }

    console.log("\nTest completed!");
  } catch (error) {
    if (error.error) {
      handleRPCError(error);
    } else {
      console.error("Error during test:", error.message);
    }
  }
}

// Run tests
console.log("Starting node info tests...\n");

testNodeInfo()
  .then(() => console.log("\nAll tests completed!"))
  .catch(console.error);
