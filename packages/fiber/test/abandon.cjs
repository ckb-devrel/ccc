const { FiberSDK } = require('../dist.commonjs');

const sdk = new FiberSDK({
  endpoint: 'http://ec2-18-162-235-225.ap-east-1.compute.amazonaws.com:8119',
  timeout: 30000
});

async function abandonNegotiatingChannels() {
  try {
    console.log('开始放弃处于 NEGOTIATING_FUNDING 状态的通道...\n');

    // 首先获取所有通道
    const channels = await sdk.channel.listChannels();
    console.log(`找到 ${channels.length} 个通道`);

    // 筛选出处于 NEGOTIATING_FUNDING 状态的通道
    const negotiatingChannels = channels.filter(
      channel => channel.state.state_name === 'NEGOTIATING_FUNDING'
    );

    console.log(`找到 ${negotiatingChannels.length} 个处于 NEGOTIATING_FUNDING 状态的通道`);

    // 遍历并放弃这些通道
    for (const channel of negotiatingChannels) {
      console.log(`正在放弃通道: ${channel.channel_id}`);
      try {
        await sdk.channel.abandonChannel(channel.channel_id);
        console.log(`成功放弃通道: ${channel.channel_id}`);
      } catch (error) {
        console.error(`放弃通道失败: ${channel.channel_id}`, error);
      }
    }

    console.log('\n放弃通道完成！');
  } catch (error) {
    console.error('发生错误:', error);
  }
}

abandonNegotiatingChannels(); 