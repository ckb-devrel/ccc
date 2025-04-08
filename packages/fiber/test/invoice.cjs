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

async function testNewInvoice() {
  try {
    // 初始化SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("开始测试创建新发票...\n");

    try {
      // 创建新发票
      console.log("正在调用 newInvoice 方法...");
      const invoice = await sdk.invoice.newInvoice({
        amount: BigInt(1000),
        description: "测试发票",
        expiry: BigInt(3600), // 1小时过期
        payment_secret: "secret", // 可选
      });
      console.log("发票信息:", JSON.stringify(invoice, null, 2));
    } catch (error) {
      if (error.error) {
        handleRPCError(error);
      } else {
        console.error("创建发票失败:", error.message);
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

async function testParseInvoice() {
  try {
    // 初始化SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("开始测试解析发票...\n");

    try {
      // 解析发票
      console.log("正在调用 parseInvoice 方法...");
      const invoiceString = "invoice_string"; // 替换为实际的发票字符串
      const invoice = await sdk.invoice.parseInvoice(invoiceString);
      console.log("解析结果:", JSON.stringify(invoice, null, 2));
    } catch (error) {
      if (error.error) {
        handleRPCError(error);
      } else {
        console.error("解析发票失败:", error.message);
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

async function testGetInvoice() {
  try {
    // 初始化SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("开始测试获取发票...\n");

    try {
      // 获取发票
      console.log("正在调用 getInvoice 方法...");
      const paymentHash = "payment_hash"; // 替换为实际的 payment_hash
      const invoice = await sdk.invoice.getInvoice(paymentHash);
      console.log("发票信息:", JSON.stringify(invoice, null, 2));

      // 输出详细信息
      console.log("\n发票详细信息:");
      console.log("状态:", invoice.status);
      console.log("发票地址:", invoice.invoice_address);
      console.log("发票内容:", JSON.stringify(invoice.invoice, null, 2));
    } catch (error) {
      if (error.error) {
        handleRPCError(error);
      } else {
        console.error("获取发票失败:", error.message);
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

async function testCancelInvoice() {
  try {
    // 初始化SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("开始测试取消发票...\n");

    try {
      // 取消发票
      console.log("正在调用 cancelInvoice 方法...");
      const paymentHash = "payment_hash"; // 替换为实际的 payment_hash
      await sdk.invoice.cancelInvoice(paymentHash);
      console.log("发票取消成功");
    } catch (error) {
      if (error.error) {
        handleRPCError(error);
      } else {
        console.error("取消发票失败:", error.message);
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
console.log("开始运行发票相关测试...\n");

testNewInvoice()
  .then(() => testParseInvoice())
  .then(() => testGetInvoice())
  .then(() => testCancelInvoice())
  .then(() => console.log("\n所有测试完成！"))
  .catch(console.error); 