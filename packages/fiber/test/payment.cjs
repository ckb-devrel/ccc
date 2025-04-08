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
  return parseInt(hex.replace("0x", ""), 16);
}

async function testSendPayment() {
  try {
    // 初始化SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("开始测试发送支付...\n");

    try {
      // 发送支付
      console.log("正在调用 sendPayment 方法...");
      await sdk.payment.sendPayment({
        payment_hash: "payment_hash", // 替换为实际的 payment_hash
        amount: BigInt(1000),
        fee_rate: BigInt(100),
        custom_records: {
          // 自定义记录
          "key1": "value1",
          "key2": "value2",
        },
      });
      console.log("支付发送成功");
    } catch (error) {
      if (error.error) {
        handleRPCError(error);
      } else {
        console.error("发送支付失败:", error.message);
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

async function testGetPayment() {
  try {
    // 初始化SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("开始测试获取支付...\n");

    try {
      // 获取支付
      console.log("正在调用 getPayment 方法...");
      const paymentHash = "payment_hash"; // 替换为实际的 payment_hash
      const payment = await sdk.payment.getPayment(paymentHash);
      console.log("支付信息:", JSON.stringify(payment, null, 2));

      // 输出详细信息
      console.log("\n支付详细信息:");
      console.log("状态:", payment.status);
      console.log("支付哈希:", payment.payment_hash);
      console.log(
        "创建时间:",
        new Date(hexToNumber(payment.created_at)).toLocaleString(),
      );
      console.log(
        "最后更新时间:",
        new Date(hexToNumber(payment.last_updated_at)).toLocaleString(),
      );
      if (payment.failed_error) {
        console.log("失败原因:", payment.failed_error);
      }
      console.log("手续费:", hexToNumber(payment.fee));
    } catch (error) {
      if (error.error) {
        handleRPCError(error);
      } else {
        console.error("获取支付失败:", error.message);
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

// 运行所有测试
console.log("开始运行支付相关测试...\n");

testSendPayment()
  .then(() => testGetPayment())
  .then(() => console.log("\n所有测试完成！"))
  .catch(console.error); 