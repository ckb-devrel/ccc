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

async function testConnectPeer() {
  try {
    // Initialize SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("Starting peer connection test...\n");

    try {
      // Connect to peer
      console.log("Calling connect_peer method...");
      const peerAddress =
        "/ip4/18.162.235.225/tcp/8119/p2p/QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo";

      try {
        const response = await sdk.connectPeer({
          address: peerAddress,
        });
        console.log("Successfully connected to peer:", response);
      } catch (error) {
        // Check error message, if already connected, consider it a success
        if (error.message && error.message.includes("already connected")) {
          console.log("Peer is already connected, proceeding with next steps");
        } else {
          throw error;
        }
      }
    } catch (error) {
      if (error.error) {
        handleRPCError(error);
      } else {
        console.error("Failed to connect to peer:", error.message);
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

async function testDisconnectPeer() {
  console.log("\nStarting peer disconnection test...\n");
  const sdk = new FiberSDK({
    endpoint: "http://127.0.0.1:8227",
    timeout: 30000,
  });
  const peerId = "QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo";
  console.log("正在调用 disconnect_peer 方法，节点 ID:", peerId);
  const result = await sdk.peer.disconnectPeer(peerId);
  console.log("断开链接结果:", result);
}

async function testListChannels() {
  console.log("\n开始测试列出通道...\n");

  try {
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 30000,
    });

    const peerId = "QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo";
    console.log("正在调用 list_channels 方法，节点 ID:", peerId);

    const result = await sdk.listChannels({
      peer_id: peerId,
    });

    console.log("通道列表:", result);
  } catch (error) {
    console.error("列出通道失败:", error.message);
    handleRPCError(error);
  }

  console.log("\n测试完成！");
}

async function main() {
  // 1. First clean up channels in NEGOTIATING_FUNDING state
  // await testListChannels();

  // 2. Then establish network connection
  await testConnectPeer();

  // 3. Disconnect
  await testDisconnectPeer();

  // 4. Finally query channel status
  // await testListChannels();
}

// Run tests
console.log("开始运行节点连接测试...\n");

main()
  .then(() => console.log("\n所有测试完成！"))
  .catch(console.error);
