const { FiberClient, FiberSDK } = require("../dist.commonjs/index.js");

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

// 将十六进制字符串转换为数字
function hexToNumber(hex) {
  if (!hex) return 0;
  return parseInt(hex.replace("0x", ""), 16);
}

async function testListChannels() {
  try {
    // 初始化SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("开始测试列出通道...\n");

    try {
      // 列出通道
      console.log("正在调用 listChannels 方法...");
      const channels = await sdk.channel.listChannels();

      // 输出原始数据
      console.log("原始数据:", JSON.stringify(channels, null, 2));

      // 类型检查
      if (!Array.isArray(channels)) {
        throw new Error("返回的通道列表格式不正确");
      }

      // 输出详细信息
      if (channels.length > 0) {
        console.log("\n通道详细信息:");
        channels.forEach((channel, index) => {
          console.log(`\n通道 ${index + 1}:`);
          console.log("通道ID:", channel.channel_id);
          console.log("对等节点ID:", channel.peer_id);
          console.log("状态:", channel.state);
          console.log("本地余额:", hexToNumber(channel.local_balance));
          console.log("远程余额:", hexToNumber(channel.remote_balance));
          console.log(
            "创建时间:",
            new Date(hexToNumber(channel.created_at)).toLocaleString(),
          );
          console.log("是否公开:", channel.is_public ? "是" : "否");
          console.log("是否启用:", channel.is_enabled ? "是" : "否");
          console.log("TLC 过期增量:", hexToNumber(channel.tlc_expiry_delta));
          console.log("TLC 最小金额:", hexToNumber(channel.tlc_min_value));
          console.log(
            "TLC 费用比例:",
            hexToNumber(channel.tlc_fee_proportional_millionths),
          );
        });
      } else {
        console.log("当前没有通道");
      }

      return channels;
    } catch (error) {
      if (error.error) {
        handleRPCError(error);
      } else {
        console.error("列出通道失败:", error.message);
      }
      return [];
    }
  } catch (error) {
    if (error.error) {
      handleRPCError(error);
    } else {
      console.error("测试过程中发生错误:", error.message);
    }
    return [];
  }
}

async function testUpdateAndShutdownChannel() {
  console.log("\n开始测试更新和关闭通道...");

  const sdk = new FiberSDK({
    endpoint: "http://127.0.0.1:8227",
    timeout: 30000,
  });

  try {
    // 获取可用通道列表
    const channels = await sdk.channel.listChannels();

    if (!channels || channels.length === 0) {
      console.log("没有可用的通道");
      return;
    }

    // 选择第一个通道进行测试
    const channel = channels[0];
    console.log("\n准备更新的通道信息:");
    console.log("通道ID:", channel.channel_id);
    console.log("对等节点ID:", channel.peer_id);
    console.log("状态:", channel.state);

    console.log("\n正在调用 updateChannel 方法禁用通道...");
    await sdk.channel.updateChannel({
      channel_id: channel.channel_id,
      enabled: false,
      tlc_expiry_delta: 1000000, // 设置大于 900000 的值
      tlc_min_amount: 0,
      tlc_fee_rate: 0,
    });
    console.log("通道已成功禁用");

    console.log("\n正在调用 shutdownChannel 方法关闭通道...");
    await sdk.channel.shutdownChannel({
      channel_id: channel.channel_id,
      close_script: "",
      force: true,
      fee_rate: 1000,
    });
    console.log("通道已成功关闭");
  } catch (error) {
    console.log("更新和关闭通道失败:", error.message);
  }
}

async function testAcceptChannel() {
  try {
    // 初始化SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("\n开始测试接受通道...\n");

    try {
      // 获取可用的通道列表
      const channels = await testListChannels();

      if (channels.length === 0) {
        console.log("没有可用的通道可以接受");
        return;
      }

      // 选择第一个通道进行接受操作
      const channelToAccept = channels[0];
      console.log("\n准备接受的通道信息:");
      console.log("通道ID:", channelToAccept.channel_id);
      console.log("对等节点ID:", channelToAccept.peer_id);
      console.log("状态:", channelToAccept.state);

      // 检查通道状态是否适合接受
      if (channelToAccept.state.state_name !== "NEGOTIATING_FUNDING") {
        console.log("通道不处于资金协商状态，无法接受");
        return;
      }

      // 调用接受通道方法
      console.log("\n正在调用 acceptChannel 方法...");
      await sdk.channel.acceptChannel({
        temporary_channel_id: channelToAccept.channel_id,
        funding_amount: BigInt(100000000),
        max_tlc_value_in_flight: BigInt(100000000),
        max_tlc_number_in_flight: BigInt(10),
        tlc_min_value: BigInt(1000),
        tlc_fee_proportional_millionths: BigInt(1000),
        tlc_expiry_delta: BigInt(100),
      });
      console.log("通道接受成功");

      // 验证通道状态
      console.log("\n验证通道状态...");
      const updatedChannels = await sdk.channel.listChannels();
      const acceptedChannel = updatedChannels.find(
        (c) => c.channel_id === channelToAccept.channel_id,
      );

      if (acceptedChannel) {
        console.log("通道状态:", acceptedChannel.state);
      }
    } catch (error) {
      if (error.error) {
        handleRPCError(error);
      } else {
        console.error("接受通道失败:", error.message);
      }
    }
  } catch (error) {
    console.error("测试接受通道时发生错误:", error);
  }
}

async function testAbandonChannel() {
  try {
    // 初始化SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("\n开始测试放弃通道...\n");

    try {
      // 获取可用的通道列表
      const channels = await testListChannels();

      if (channels.length === 0) {
        console.log("没有可用的通道可以放弃");
        return;
      }

      // 选择第一个通道进行放弃操作
      const channelToAbandon = channels[0];
      console.log("\n准备放弃的通道信息:");
      console.log("通道ID:", channelToAbandon.channel_id);
      console.log("对等节点ID:", channelToAbandon.peer_id);
      console.log("状态:", channelToAbandon.state);

      // 调用放弃通道方法
      console.log("\n正在调用 abandonChannel 方法...");
      await sdk.channel.abandonChannel(channelToAbandon.channel_id);
      console.log("通道放弃成功");

      // 验证通道状态
      console.log("\n验证通道状态...");
      const updatedChannels = await sdk.channel.listChannels();
      const abandonedChannel = updatedChannels.find(
        (c) => c.channel_id === channelToAbandon.channel_id,
      );

      if (!abandonedChannel) {
        console.log("验证成功：通道已被放弃");
      } else {
        console.log("通道状态:", abandonedChannel.state);
      }
    } catch (error) {
      if (error.error) {
        handleRPCError(error);
      } else {
        console.error("放弃通道失败:", error.message);
      }
    }
  } catch (error) {
    console.error("测试放弃通道时发生错误:", error);
  }
}

async function testRemoveWatchChannel() {
  try {
    // 初始化SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("\n开始测试移除监视通道...\n");

    // 获取可用的通道列表
    const channels = await testListChannels();

    if (channels.length === 0) {
      console.log("没有可用的通道可以移除");
      return;
    }

    // 选择第一个通道进行移除操作
    const channelToRemove = channels[0];
    console.log("\n准备移除的通道信息:");
    console.log("通道ID:", channelToRemove.channel_id);
    console.log("对等节点ID:", channelToRemove.peer_id);
    console.log("状态:", channelToRemove.state);

    // 调用移除监视通道方法
    console.log("\n正在调用 removeWatchChannel 方法...");
    await sdk.dev.removeWatchChannel(channelToRemove.channel_id);
    console.log("移除监视通道成功");

    // 验证通道状态
    console.log("\n验证通道状态...");
    const updatedChannels = await sdk.channel.listChannels();
    const removedChannel = updatedChannels.find(
      (c) => c.channel_id === channelToRemove.channel_id,
    );

    if (!removedChannel) {
      console.log("验证成功：通道已被移除");
    } else {
      console.log("通道仍然存在，状态:", removedChannel.state);
    }
  } catch (error) {
    if (error.error) {
      handleRPCError(error);
    } else {
      console.error("移除监视通道时发生错误:", error);
    }
  }
}

async function testSubmitCommitmentTransaction() {
  try {
    // 初始化SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("\n开始测试提交承诺交易...\n");

    // 获取可用的通道列表
    const channels = await testListChannels();

    if (channels.length === 0) {
      console.log("没有可用的通道");
      return;
    }

    // 选择第一个通道
    const channel = channels[0];
    console.log("\n准备提交承诺交易的通道信息:");
    console.log("通道ID:", channel.channel_id);
    console.log("对等节点ID:", channel.peer_id);
    console.log("状态:", channel.state);

    // 创建承诺交易
    const commitmentTransaction = "0x" + "00".repeat(32); // 示例交易数据

    // 调用提交承诺交易方法
    console.log("\n正在调用 submitCommitmentTransaction 方法...");
    await sdk.dev.submitCommitmentTransaction({
      channel_id: channel.channel_id,
      commitment_transaction: commitmentTransaction,
    });
    console.log("承诺交易提交成功");

    // 验证通道状态
    console.log("\n验证通道状态...");
    const updatedChannels = await sdk.channel.listChannels();
    const updatedChannel = updatedChannels.find(
      (c) => c.channel_id === channel.channel_id,
    );

    if (updatedChannel) {
      console.log("通道新状态:", updatedChannel.state);
    } else {
      console.log("找不到通道，可能已被关闭");
    }
  } catch (error) {
    if (error.error) {
      handleRPCError(error);
    } else {
      console.error("提交承诺交易时发生错误:", error);
    }
  }
}

async function testUpdateChannel() {
  try {
    // 初始化SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("\n开始测试更新通道...\n");

    try {
      // 获取可用的通道列表
      const channels = await testListChannels();

      if (channels.length === 0) {
        console.log("没有可用的通道可以更新");
        return;
      }

      // 选择第一个通道进行更新操作
      const channelToUpdate = channels[0];
      console.log("\n准备更新的通道信息:");
      console.log("通道ID:", channelToUpdate.channel_id);
      console.log("对等节点ID:", channelToUpdate.peer_id);
      console.log("状态:", channelToUpdate.state);

      // 调用更新通道方法，禁用通道
      console.log("\n正在调用 updateChannel 方法...");
      await sdk.channel.updateChannel({
        channel_id: channelToUpdate.channel_id,
        enabled: false,
      });
      console.log("通道更新成功");

      // 验证通道状态
      console.log("\n验证通道状态...");
      const updatedChannels = await sdk.channel.listChannels();
      const updatedChannel = updatedChannels.find(
        (c) => c.channel_id === channelToUpdate.channel_id,
      );

      if (updatedChannel) {
        console.log("通道状态:", updatedChannel.state);
        console.log("是否启用:", updatedChannel.enabled ? "是" : "否");
      }
    } catch (error) {
      if (error.error) {
        handleRPCError(error);
      } else {
        console.error("更新通道失败:", error.message);
      }
    }
  } catch (error) {
    console.error("测试更新通道时发生错误:", error);
  }
}

async function main() {
  try {
    await testListChannels();
    await testUpdateAndShutdownChannel();
    console.log("\n所有测试完成！");
  } catch (error) {
    console.error("测试过程中发生错误:", error);
  }
}

// 运行测试
console.log("开始运行通道相关测试...\n");

main()
  .then(() => console.log("\n所有测试完成！"))
  .catch(console.error);
