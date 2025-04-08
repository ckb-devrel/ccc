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

async function testNodeInfo() {
  try {
    // 初始化SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("开始测试获取节点信息...\n");

    try {
      // 获取节点信息
      console.log("正在调用 nodeInfo 方法...");
      const nodeInfo = await sdk.info.nodeInfo();

      // 类型检查
      if (!nodeInfo || typeof nodeInfo !== "object") {
        throw new Error("返回的节点信息格式不正确");
      }

      // 输出详细信息
      console.log("\n节点详细信息:");
      console.log("版本:", nodeInfo.version);
      console.log("提交哈希:", nodeInfo.commit_hash);
      console.log("节点ID:", nodeInfo.node_id);
      console.log("节点名称:", nodeInfo.node_name || "未设置");
      console.log(
        "地址列表:",
        nodeInfo.addresses.length > 0 ? nodeInfo.addresses.join(", ") : "无",
      );
      console.log("链哈希:", nodeInfo.chain_hash);
      console.log(
        "自动接受最小CKB资金金额:",
        hexToNumber(nodeInfo.open_channel_auto_accept_min_ckb_funding_amount),
      );
      console.log(
        "自动接受通道CKB资金金额:",
        hexToNumber(nodeInfo.auto_accept_channel_ckb_funding_amount),
      );
      console.log("通道数量:", hexToNumber(nodeInfo.channel_count));
      console.log(
        "待处理通道数量:",
        hexToNumber(nodeInfo.pending_channel_count),
      );
      console.log("对等节点数量:", hexToNumber(nodeInfo.peers_count));

      if (nodeInfo.udt_cfg_infos && nodeInfo.udt_cfg_infos.length > 0) {
        console.log("\nUDT配置信息:");
        nodeInfo.udt_cfg_infos.forEach((udt, index) => {
          console.log(`\nUDT ${index + 1}:`);
          console.log("名称:", udt.name);
          console.log("自动接受金额:", hexToNumber(udt.auto_accept_amount));
        });
      }
    } catch (error) {
      if (error.error) {
        handleRPCError(error);
      } else {
        console.error("获取节点信息失败:", error.message);
      }
    }

    console.log("\n测试完成！");
  } catch (error) {
    if (error.error) {
      handleRPCError(error);
    } else {
      console.error("测试过程中发生错误:", error.message);
    }
  }
}

// 运行测试
console.log("开始运行节点信息相关测试...\n");

testNodeInfo()
  .then(() => console.log("\n所有测试完成！"))
  .catch(console.error);
