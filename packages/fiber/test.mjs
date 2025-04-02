import pkg from "./dist.commonjs/index.js";
const { FiberSDK } = pkg;

async function testNodeInfo() {
  try {
    // 初始化 SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227", // Fiber 节点的默认 RPC 地址
      timeout: 5000,
    });
    console.log("开始获取节点信息...\n");

    // 调用 nodeInfo 方法
    const nodeInfo = await sdk.info.nodeInfo();

    // 打印节点信息
    console.log("节点信息:");
    console.log("节点名称:", nodeInfo.node_name);
    console.log("节点地址:", nodeInfo.addresses);
    console.log("节点ID:", nodeInfo.node_id);
    console.log("链哈希:", nodeInfo.chain_hash);
    if (nodeInfo.auto_accept_min_ckb_funding_amount) {
      console.log(
        "自动接受最小资金金额:",
        nodeInfo.auto_accept_min_ckb_funding_amount.toString(),
      );
    }
    console.log("UDT配置信息:", nodeInfo.udt_cfg_infos);

    console.log("\n测试完成！");
  } catch (error) {
    console.error("获取节点信息时发生错误:", error.message);
  }
}

async function testChannelManagement() {
  console.log("开始测试通道管理...\n");

  try {
    // 初始化 SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    // 尝试打开新通道
    // console.log('尝试打开新通道:');

    // 先连接对等节点
    const peerAddress =
      "/ip4/18.162.235.225/tcp/8119/p2p/QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo";
    const targetPeerId = "QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo";

    try {
      // 先检查节点状态
      const status = await sdk.info.nodeStatus();
      console.log("当前节点状态:", status);

      // 尝试连接对等节点
      console.log("正在连接到对等节点:", peerAddress);
      await sdk.peer.connectPeer({
        address: peerAddress,
        save: true,
      });
      console.log("成功连接到对等节点:", peerAddress);

      // 等待更长时间确保连接完全建立
      console.log("等待连接稳定...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // // 再次检查节点状态
      // const newStatus = await sdk.info.nodeStatus();
      // console.log('连接后的节点状态:', newStatus);

      // 检查连接是否成功
      const updatedChannels = await sdk.channel.listChannels();
      console.log("连接后的通道列表:", updatedChannels);

      const openChannelParams = {
        peer_id: targetPeerId,
        funding_amount: BigInt("0x1717918000"), // 62 CKB = 6200000000 shannon
        public: true,
        commitment_delay_epoch: BigInt("0x54"), // 84 epochs
        commitment_fee_rate: BigInt("0x3e8"),
        funding_fee_rate: BigInt("0x3e8"),
        tlc_expiry_delta: BigInt(900000),
        tlc_min_value: BigInt("0x3e8"),
        tlc_fee_proportional_millionths: BigInt("0x3e8"),
        max_tlc_value_in_flight: BigInt("0x1717918000"),
        max_tlc_number_in_flight: BigInt("0x64"),
      };

      console.log("准备打开通道，参数:", openChannelParams);

      try {
        const result = await sdk.channel.openChannel(openChannelParams);
        console.log("成功打开通道，临时通道ID:", result.temporary_channel_id);

        // 测试接受通道
        console.log("\n尝试接受通道:", result.temporary_channel_id);
        try {
          const acceptResult = await sdk.channel.acceptChannel({
            temporary_channel_id: result.temporary_channel_id,
            funding_amount: BigInt("390000000000"),
            max_tlc_value_in_flight: BigInt("390000000000"),
            max_tlc_number_in_flight: BigInt("100"),
            tlc_min_value: BigInt("1000"),
            tlc_fee_proportional_millionths: BigInt("1000"),
            tlc_expiry_delta: BigInt("900000"),
          });
          console.log("通道接受成功，最终通道ID:", acceptResult.channel_id);

          // 测试关闭通道
          console.log("\n尝试关闭通道:", acceptResult.channel_id);
          try {
            await sdk.channel.shutdownChannel({
              channel_id: acceptResult.channel_id,
              close_script: null, // 使用默认的关闭脚本
              force: false,
              fee_rate: BigInt(1000),
            });
            console.log("通道关闭成功");

            // 测试更新通道参数
            console.log("\n尝试更新通道参数:", acceptResult.channel_id);
            try {
              await sdk.channel.updateChannel({
                channel_id: acceptResult.channel_id,
                enabled: true,
                tlc_expiry_delta: BigInt(200),
                tlc_minimum_value: BigInt(200000000), // 0.2 CKB
                tlc_fee_proportional_millionths: BigInt(200),
              });
              console.log("通道参数更新成功");
            } catch (error) {
              console.log("更新通道参数失败:", error.message);
            }

            // 测试放弃通道
            console.log("\n尝试放弃通道:", acceptResult.channel_id);
            try {
              await sdk.channel.abandonChannel(acceptResult.channel_id);
              console.log("通道放弃成功");
            } catch (error) {
              console.log("放弃通道失败:", error.message);
            }
          } catch (error) {
            console.log("关闭通道失败:", error.message);
          }
        } catch (error) {
          console.log("接受通道失败:", error.message);
        }
      } catch (error) {
        console.log("打开通道失败:", error.message);
      }
    } catch (error) {
      console.log("连接对等节点失败:", error.message);
    }
  } catch (error) {
    console.error("测试过程中出错:", error.message);
  }

  console.log("\n通道管理测试完成！");
}

// 运行测试
async function runTests() {
  // await testNodeInfo();
  await testChannelManagement();
}

runTests().catch(console.error);
