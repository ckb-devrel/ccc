import type { ConnectorMessages } from "../types.js";

export const zhCN: ConnectorMessages = {
  // Common actions / states
  connect: "连接",
  disconnect: "断开连接",
  connecting: "正在连接...",
  reconnect: "重新连接",
  tryAgain: "重试",
  manage: "管理",
  copy: "复制",
  copied: "已复制",
  or: "或",
  advancedSettings: "高级设置",
  poweredBy: "Powered by CCC",

  // Wallet / chain / network
  connectWallet: "连接钱包",
  selectChain: "选择链",
  selectNetwork: "选择网络",
  mainnet: "主网",
  testnet: "测试网",
  confirmInWallet: "请在钱包中确认连接",
  openingWallet: "正在打开 {name}...",
  failedToOpenWallet: "打开 {name} 失败",

  // Fee rate
  feeRate: "费率",
  selectFeeRate: "选择费率",
  feeRateHint: "费率单位为每 1,000 字节所需的 shannon 数。",
  feeRateAuto: "自动",
  feeRateEconomy: "经济",
  feeRateCustom: "自定义",
  feeRateEconomyHint: "费用更低，可能需要更长时间方可上链",
  feeRateAutoHint: "基于近期网络的交易情况",
  feeRateLoading: "正在加载网络费率...",
  feeRateUnit: "shannons/KB",

  // Khie pairing
  khieConnectWallet: "通过 Khie 连接钱包",
  khieLoading: "正在加载 Khie...",
  khieEstablishingConnection: "正在建立安全连接...",
  khieApproveInWallet: "请在 Khie 中确认连接",
  khieLetWalletScan: "让钱包扫描此码",
  khieCopyPairingCode: "点击复制配对码",
  khieOpenWallet: "打开钱包",
  khieOpenWalletHint:
    "如果钱包应用没有打开，请安装支持 Khie 的钱包，或手动配对。",
  khieConnectingRelay: "正在连接中继...",
  khieScanWalletCode: "扫描钱包配对码",
  khieWalletPairingCode: "钱包配对码",
  khiePastePairingCode: "或粘贴配对码",
  khieHelpIntro: "Khie 是一个连接钱包与应用的点对点协议。",
  khieHelpLink: "点击此处了解更多",
  khieHelpOutro: "，你也可以在钱包所在的设备上直接连接本地钱包。",
  khieRelayMultiaddr: "中继地址（Multiaddr 格式）",
  khieConnectRelay: "连接中继",
  khieIncompatiblePairingCode: "这不是兼容的 Khie 配对码",
  khieIncompatiblePairingCodeHint: "请扫描来自钱包的配对码。",
  khieLearnMore: "点击此处了解更多。",

  // Errors raised by the connector itself
  errorUnknownConnectionStatus: "未知的连接状态",
  errorUnknownBrowser: "未知的浏览器错误",
  errorKhieWalletUnpaired: "钱包已取消配对，请返回并重新配对。",
  errorKhieSignerNotConnected: "Khie 签名器未能连接",
  errorKhieScanFailed: "无法扫描配对码：{error}",
  errorCameraRequiresSecureContext: "访问摄像头需要 HTTPS 或 localhost",
  errorCameraNotSupported: "当前浏览器不支持访问摄像头",
  errorCameraPreviewUnavailable: "摄像头预览不可用",
};
