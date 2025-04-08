const { FiberSDK } = require("../dist.commonjs/index.js");

// 自定义错误处理函数
function handleRPCError(error) {
  if (error.error && error.error.code === -32601) {
    console.error("错误: 节点可能未运行或 RPC 方法不存在");
    console.error("请确保:");
    console.error("1. Fiber 节点已启动");
    console.error("2. 节点 RPC 地址正确 (当前: http://127.0.0.1:8227)");
    console.error("3. 节点 RPC 接口可用");
  } else if (error.error && error.error.code === -32602) {
    console.error("错误: 参数无效");
    console.error("请检查:");
    console.error("1. 参数类型是否正确");
    console.error("2. 参数值是否在有效范围内");
    console.error("3. 必填参数是否都已提供");
  } else {
    console.error("RPC 错误:", error.message);
    if (error.error && error.error.data) {
      console.error("错误详情:", error.error.data);
    }
  }
}

async function testConnectPeer() {
  console.log("\n开始测试连接节点...\n");

  try {
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 30000,
    });

    // 使用文档中的测试节点地址
    const peerAddress = "/ip4/18.162.235.225/tcp/8119/p2p/QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo";
    console.log("正在调用 connect_peer 方法，连接地址:", peerAddress);

    await sdk.peer.connectPeer({ address: peerAddress });
    console.log("连接节点成功");
  } catch (error) {
    console.error("连接节点失败:", error.message);
    handleRPCError(error);
  }

  console.log("\n测试完成！");
}

async function testOpenChannel() {
  console.log("\n开始测试打开通道...\n");

  try {
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 30000,
    });

    const peerId = "QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo";
    console.log("正在调用 open_channel 方法，节点 ID:", peerId);

    const result = await sdk.channel.openChannel({
      peer_id: peerId,
      funding_amount: "0x174876e800", // 100 CKB
      public: true,
    });

    console.log("打开通道结果:", result);
  } catch (error) {
    console.error("打开通道失败:", error.message);
    handleRPCError(error);
  }

  console.log("\n测试完成！");
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

    const result = await sdk.channel.listChannels({
      peer_id: peerId,
    });

    console.log("通道列表:", result);
  } catch (error) {
    console.error("列出通道失败:", error.message);
    handleRPCError(error);
  }

  console.log("\n测试完成！");
}

async function testCloseChannel() {
  console.log("\n开始测试关闭通道...\n");

  try {
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 30000,
    });

    // 获取通道列表
    const channels = await sdk.channel.listChannels({
      peer_id: "QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo",
    });

    // 关闭所有通道
    for (const channel of channels) {
      console.log("正在关闭通道:", channel.channel_id);
      await sdk.channel.shutdownChannel({
        channel_id: channel.channel_id,
        close_script: {
          code_hash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
          hash_type: "type",
          args: "0xea076cd91e879a3c189d94068e1584c3fbcc1876"
        },
        fee_rate: "0x3FC"
      });
      console.log("通道关闭成功:", channel.channel_id);
    }
  } catch (error) {
    console.error("关闭通道失败:", error.message);
    handleRPCError(error);
  }

  console.log("\n测试完成！");
}

async function cleanupNegotiatingChannels() {
  console.log("\n开始清理处于 NEGOTIATING_FUNDING 状态的通道...\n");

  try {
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 30000,
    });

    // 获取通道列表
    const channels = await sdk.channel.listChannels({
      peer_id: "QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo",
    });

    // 过滤出处于 NEGOTIATING_FUNDING 状态的通道
    const negotiatingChannels = channels.filter(
      channel => channel.state.state_name === "NEGOTIATING_FUNDING"
    );

    console.log(`找到 ${negotiatingChannels.length} 个处于 NEGOTIATING_FUNDING 状态的通道`);

    // 关闭这些通道
    for (const channel of negotiatingChannels) {
      console.log("正在关闭通道:", channel.channel_id);
      try {
        await sdk.channel.shutdownChannel({
          channel_id: channel.channel_id,
          close_script: {
            code_hash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
            hash_type: "type",
            args: "0xea076cd91e879a3c189d94068e1584c3fbcc1876"
          },
          fee_rate: "0x3FC",
          force: true
        });
        console.log("通道关闭成功:", channel.channel_id);
      } catch (closeError) {
        console.error("关闭通道失败:", channel.channel_id, closeError.message);
      }
    }
  } catch (error) {
    console.error("清理通道失败:", error.message);
    handleRPCError(error);
  }

  console.log("\n清理完成！");
}

async function main() {
  // 1. 首先清理处于 NEGOTIATING_FUNDING 状态的通道
  await cleanupNegotiatingChannels();
  
  // 2. 然后建立网络连接
  await testConnectPeer();
  
  // 3. 打开新通道
  await testOpenChannel();
  
  // 4. 最后查询通道状态
  await testListChannels();
}

main().catch(console.error);
