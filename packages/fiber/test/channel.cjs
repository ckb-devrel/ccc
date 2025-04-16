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

async function testListChannels() {
  try {
    // Initialize SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("Starting channel listing test...\n");

    try {
      // List channels
      console.log("Calling listChannels method...");
      const channels = await sdk.listChannels();

      // Output raw data
      console.log("Raw data:", JSON.stringify(channels, null, 2));

      // Type check
      if (!Array.isArray(channels)) {
        throw new Error("Invalid channel list format");
      }

      // Output detailed information
      if (channels.length > 0) {
        console.log("\nChannel details:");
        channels.forEach((channel, index) => {
          console.log(`\nChannel ${index + 1}:`);
          console.log("Channel ID:", channel.channel_id);
          console.log("Peer ID:", channel.peer_id);
          console.log("State:", channel.state_name);
          console.log("State Flags:", channel.state_flags);
          console.log("Local Balance:", hexToNumber(channel.local_balance));
          console.log("Remote Balance:", hexToNumber(channel.remote_balance));
          console.log(
            "Created At:",
            new Date(hexToNumber(channel.created_at)).toLocaleString(),
          );
          console.log("Is Public:", channel.is_public ? "Yes" : "No");
          console.log("Is Enabled:", channel.is_enabled ? "Yes" : "No");
          console.log(
            "TLC Expiry Delta:",
            hexToNumber(channel.tlc_expiry_delta),
          );
          console.log("TLC Min Value:", hexToNumber(channel.tlc_min_value));
          console.log(
            "TLC Fee Proportion:",
            hexToNumber(channel.tlc_fee_proportional_millionths),
          );
        });
      } else {
        console.log("No channels available");
      }

      return channels;
    } catch (error) {
      if (error.error) {
        handleRPCError(error);
      } else {
        console.error("Failed to list channels:", error.message);
      }
      return [];
    }
  } catch (error) {
    if (error.error) {
      handleRPCError(error);
    } else {
      console.error("Error during test:", error.message);
    }
    return [];
  }
}

async function testAbandonChannel() {
  try {
    // Initialize SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("\nStarting channel closure test...\n");

    try {
      // Get available channels
      const channels = await testListChannels();

      if (channels.length === 0) {
        console.log("No channels available to close");
        return;
      }

      // Select first channel for closure
      const channelToClose = channels[0];
      console.log("\nChannel to close:");
      console.log("Channel ID:", channelToClose.channel_id);
      console.log("Peer ID:", channelToClose.peer_id);
      console.log("State:", channelToClose.state);

      await sdk.abandonChannel(channelToClose.channel_id);
    } catch (error) {
      if (error.error) {
        handleRPCError(error);
      } else {
        console.error("Failed to close channel:", error.message);
      }
    }
  } catch (error) {
    console.error("Error during channel closure test:", error);
  }
}

async function testNewChannel() {
  const sdk = new FiberSDK({
    endpoint: "http://127.0.0.1:8227",
    timeout: 5000,
  });
  const peerId = "QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo";
  console.log("Calling open_channel method, Peer ID:", peerId);
  const result = await sdk.openChannel({
    peer_id: peerId,
    funding_amount: "0xba43b7400", // 100 CKB
    public: true,
  });
  console.log("Open channel result:", result);
}

async function testUpdateAndShutdownChannel() {
  const sdk = new FiberSDK({
    endpoint: "http://127.0.0.1:8227",
    timeout: 5000,
  });
  const channels = await testListChannels();

  if (channels.length === 0) {
    console.log("No channels available to close");
    return;
  }

  // Select first channel for closure
  const channelToClose = channels[0];
  const channelId = channelToClose.channel_id;

  // Check channel state
  if (channelToClose.state_name === "NEGOTIATING_FUNDING") {
    console.log("Channel is in funding negotiation stage, cannot close");
    return;
  }

  // Ensure channelId is string type
  if (typeof channelId !== "string") {
    console.error("Invalid channel ID format:", channelId);
    return;
  }

  console.log("Calling shutdown_channel method, Channel ID:", channelId);
  const result2 = await sdk.shutdownChannel({
    channel_id: channelId,
    close_script: {
      code_hash:
        "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
      hash_type: "type",
      args: "0xcc015401df73a3287d8b2b19f0cc23572ac8b14d",
    },
    fee_rate: "0x3FC",
    force: false,
  });
  console.log("Channel closure result:", result2);
}

async function main() {
  try {
    // await testListChannels();
    // await testNewChannel();
    await testUpdateAndShutdownChannel();
    // await testListChannels();
    // await testAbandonChannel();
    console.log("\nAll tests completed!");
  } catch (error) {
    console.error("Error during test:", error);
  }
}

// Run tests
console.log("Starting channel-related tests...\n");

main()
  .then(() => console.log("\nAll tests completed!"))
  .catch(console.error);
