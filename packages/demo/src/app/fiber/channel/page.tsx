"use client";
"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/src/components/Button";
import { TextInput } from "@/src/components/Input";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { useFiber } from "../context/FiberContext";

interface ChannelState {
  fundingAmount: string;
  feeRate: string;
  tlcExpiryDelta: string;
  tlcMinValue: string;
  tlcFeeProportionalMillionths: string;
  isPublic: boolean;
  isEnabled: boolean;
  forceClose: boolean;
}

interface OpenChannelForm {
  peerAddress: string;
  fundingAmount: string;
  isPublic: boolean;
}

export default function Channel() {
  const { fiber } = useFiber();
  const [endpoint, setEndpoint] = useState("");
  const [nodeInfo, setNodeInfo] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [peers, setPeers] = useState<any[]>([]);
  const [peerAddress, setPeerAddress] = useState("");
  const [channelStates, setChannelStates] = useState<
    Record<string, ChannelState>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [openChannelForm, setOpenChannelForm] = useState<OpenChannelForm>({
    peerAddress:
      "/ip4/18.162.235.225/tcp/8119/p2p/QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo",
    fundingAmount: "50000000000",
    isPublic: true,
  });

  const listChannels = useCallback(async () => {
    if (!fiber) return;
    setIsLoading(true);
    try {
      const channelList = await fiber.listChannels();
      console.log(channelList);
      setChannels(channelList);
      // 初始化每个通道的状态
      const newChannelStates: Record<string, ChannelState> = {};
      channelList.forEach((channel: any) => {
        if (!channelStates[channel.channel_id]) {
          newChannelStates[channel.channel_id] = {
            fundingAmount: channel.funding_amount || "0xba43b7400",
            feeRate: channel.fee_rate || "0x3FC",
            tlcExpiryDelta: "0x100",
            tlcMinValue: "0x0",
            tlcFeeProportionalMillionths: "0x0",
            isPublic: true,
            isEnabled: true,
            forceClose: false,
          };
        } else {
          newChannelStates[channel.channel_id] =
            channelStates[channel.channel_id];
        }
      });
      setChannelStates(newChannelStates);
    } catch (error) {
      console.error("Failed to list channels:", error);
    } finally {
      setIsLoading(false);
    }
  }, [fiber, channelStates]);

  const updateChannel = async (channelId: string) => {
    if (!fiber || !channelId) return;
    const state = channelStates[channelId];
    if (!state) return;
    try {
      // 首先检查通道是否存在
      const channel = channels.find((c) => c.channel_id === channelId);
      if (!channel) {
        console.error("Channel not found:", channelId);
        alert("通道不存在或已被关闭");
        return;
      }

      // 检查通道状态是否允许更新
      if (channel.state.state_name !== "Normal") {
        console.error(
          "Channel is not in normal state:",
          channel.state.state_name,
        );
        alert(`通道状态为 ${channel.state.state_name}，无法更新`);
        return;
      }

      await fiber.channel.updateChannel({
        channel_id: channelId,
        enabled: state.isEnabled,
        tlc_expiry_delta: BigInt(state.tlcExpiryDelta),
        tlc_minimum_value: BigInt(state.tlcMinValue),
        tlc_fee_proportional_millionths: BigInt(
          state.tlcFeeProportionalMillionths,
        ),
      });
      console.log("Channel updated successfully");
      // Refresh channel list
      await listChannels();
    } catch (error) {
      console.error("Failed to update channel:", error);
      if (error instanceof Error) {
        alert(`更新通道失败: ${error.message}`);
      } else {
        alert("更新通道失败，请检查通道状态");
      }
    }
  };

  const abandonChannel = async (channelId: string) => {
    if (!fiber || !channelId) return;
    try {
      await fiber.abandonChannel(channelId);
      console.log("Channel abandoned successfully");
      // Refresh channel list
      await listChannels();
    } catch (error) {
      console.error("Failed to abandon channel:", error);
    }
  };

  const shutdownChannel = async (channelId: string) => {
    if (!fiber || !channelId) return;
    const state = channelStates[channelId];
    if (!state) return;
    try {
      if (state.forceClose) {
        await fiber.channel.shutdownChannel({
          channel_id: channelId,
          close_script: {
            code_hash:
              "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
            hash_type: "type",
            args: ["0xcc015401df73a3287d8b2b19f0cc23572ac8b14d"],
          },
          force: true,
          fee_rate: BigInt(state.feeRate),
        });
      } else {
        await fiber.channel.shutdownChannel({
          channel_id: channelId,
          close_script: {
            code_hash:
              "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
            hash_type: "type",
            args: ["0xcc015401df73a3287d8b2b19f0cc23572ac8b14d"],
          },
          force: false,
          fee_rate: BigInt(state.feeRate),
        });
      }
      console.log("Channel shutdown initiated successfully");
      // Refresh channel list
      await listChannels();
    } catch (error) {
      console.error("Failed to shutdown channel:", error);
    }
  };
  const connectPeer = async () => {
    if (!fiber) return;
    try {
      await fiber.connectPeer(openChannelForm.peerAddress);
      console.log("Peer connected successfully");
      // 连接成功后刷新 peers 列表
      const peerList = await fiber.listPeers();
      console.log("Current peers:", peerList);
      setPeers(peerList);
    } catch (error) {
      console.error("Failed to connect peer:", error);
      if (error instanceof Error) {
        alert(`连接 peer 失败: ${error.message}`);
      } else {
        alert("连接 peer 失败，请检查网络连接");
      }
    }
  };

  const handleOpenChannel = async () => {
    if (!fiber) return;
    try {
      // 先连接 peer
      await fiber.connectPeer(openChannelForm.peerAddress);
      console.log("Peer connected successfully");

      // 然后创建通道
      const peerId = openChannelForm.peerAddress.split("/p2p/")[1];
      await fiber.channel.openChannel({
        peer_id: peerId,
        funding_amount: BigInt(openChannelForm.fundingAmount),
        public: openChannelForm.isPublic,
      });
      console.log("Channel opened successfully");
      // 刷新通道列表
      await listChannels();
    } catch (error) {
      console.error("Failed to open channel:", error);
      if (error instanceof Error) {
        alert(`创建通道失败: ${error.message}`);
      } else {
        alert("创建通道失败，请检查网络连接");
      }
    }
  };

  useEffect(() => {
    if (fiber) {
      listChannels();
    }
  }, [fiber, listChannels]);

  return (
    <div className="flex w-9/12 flex-col items-center items-stretch gap-2">
      <div className="mb-4">
        <h2 className="mb-2 text-xl font-bold">通道管理</h2>
        <Button onClick={listChannels} disabled={isLoading}>
          刷新列表
        </Button>
      </div>

      <div className="mb-4">
        <h3 className="mb-2 text-lg font-semibold">创建新通道</h3>
        <div className="space-y-4">
          <TextInput
            label="Peer Address"
            state={[
              openChannelForm.peerAddress,
              (value) =>
                setOpenChannelForm((prev) => ({
                  ...prev,
                  peerAddress: value,
                })),
            ]}
            placeholder="输入 peer 地址"
          />
          <Button onClick={connectPeer}>连接 peer</Button>
          <TextInput
            label="Funding Amount (CKB)"
            state={[
              openChannelForm.fundingAmount,
              (value) =>
                setOpenChannelForm((prev) => ({
                  ...prev,
                  fundingAmount: value,
                })),
            ]}
            placeholder="输入资金数量（单位：CKB）"
            type="number"
          />
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={openChannelForm.isPublic}
                onChange={(e) =>
                  setOpenChannelForm((prev) => ({
                    ...prev,
                    isPublic: e.target.checked,
                  }))
                }
                className="mr-2"
              />
              公开通道
            </label>
          </div>
          <Button onClick={handleOpenChannel}>创建通道</Button>
        </div>
      </div>

      {channels.length > 0 && (
        <div className="mt-4 w-full rounded-lg border bg-white p-4">
          <h2 className="mb-2 text-lg font-bold">Channel List</h2>
          <div className="space-y-2">
            {channels.map((channel, index) => (
              <div key={index} className="border-t pt-2">
                <div>
                  <p>
                    <span className="font-semibold">Channel ID:</span>{" "}
                    {channel.channel_id}
                  </p>
                  <p>
                    <span className="font-semibold">Peer ID:</span>{" "}
                    {channel.peer_id}
                  </p>
                  <p>
                    <span className="font-semibold">State:</span>{" "}
                    {channel.state.state_name}
                  </p>
                  <p>
                    <span className="font-semibold">Local Balance:</span>{" "}
                    {channel.local_balance}
                  </p>
                  <p>
                    <span className="font-semibold">Remote Balance:</span>{" "}
                    {channel.remote_balance}
                  </p>
                </div>
                <div>
                  <div className="mt-1">
                    <TextInput
                      label="Funding Amount"
                      state={[
                        channelStates[channel.channel_id]?.fundingAmount ||
                          "0xba43b7400",
                        (value) => {
                          const newState = {
                            ...channelStates[channel.channel_id],
                            fundingAmount: value,
                          };
                          setChannelStates((prev) => ({
                            ...prev,
                            [channel.channel_id]: newState,
                          }));
                        },
                      ]}
                      placeholder="0xba43b7400"
                    />
                  </div>
                  <div className="mt-1">
                    <TextInput
                      label="Fee Rate"
                      state={[
                        channelStates[channel.channel_id]?.feeRate || "0x3FC",
                        (value) => {
                          const newState = {
                            ...channelStates[channel.channel_id],
                            feeRate: value,
                          };
                          setChannelStates((prev) => ({
                            ...prev,
                            [channel.channel_id]: newState,
                          }));
                        },
                      ]}
                      placeholder="0x3FC"
                    />
                  </div>
                  <div className="mt-1">
                    <TextInput
                      label="TLC Expiry Delta"
                      state={[
                        channelStates[channel.channel_id]?.tlcExpiryDelta ||
                          "0x100",
                        (value) => {
                          const newState = {
                            ...channelStates[channel.channel_id],
                            tlcExpiryDelta: value,
                          };
                          setChannelStates((prev) => ({
                            ...prev,
                            [channel.channel_id]: newState,
                          }));
                        },
                      ]}
                      placeholder="0x100"
                    />
                  </div>
                  <div className="mt-1">
                    <TextInput
                      label="TLC Minimum Value"
                      state={[
                        channelStates[channel.channel_id]?.tlcMinValue || "0x0",
                        (value) => {
                          const newState = {
                            ...channelStates[channel.channel_id],
                            tlcMinValue: value,
                          };
                          setChannelStates((prev) => ({
                            ...prev,
                            [channel.channel_id]: newState,
                          }));
                        },
                      ]}
                      placeholder="0x0"
                    />
                  </div>
                  <div className="mt-1">
                    <TextInput
                      label="TLC Fee Proportional Millionths"
                      state={[
                        channelStates[channel.channel_id]
                          ?.tlcFeeProportionalMillionths || "0x0",
                        (value) => {
                          const newState = {
                            ...channelStates[channel.channel_id],
                            tlcFeeProportionalMillionths: value,
                          };
                          setChannelStates((prev) => ({
                            ...prev,
                            [channel.channel_id]: newState,
                          }));
                        },
                      ]}
                      placeholder="0x0"
                    />
                  </div>
                  <div className="mt-1 flex items-center">
                    <input
                      type="checkbox"
                      id={`isPublic-${channel.channel_id}`}
                      checked={
                        channelStates[channel.channel_id]?.isPublic ?? true
                      }
                      onChange={(e) => {
                        const newState = {
                          ...channelStates[channel.channel_id],
                          isPublic: e.target.checked,
                        };
                        setChannelStates((prev) => ({
                          ...prev,
                          [channel.channel_id]: newState,
                        }));
                      }}
                      className="mr-2"
                    />
                    <label htmlFor={`isPublic-${channel.channel_id}`}>
                      Public Channel
                    </label>
                  </div>
                  <div className="mt-1 flex items-center">
                    <input
                      type="checkbox"
                      id={`isEnabled-${channel.channel_id}`}
                      checked={
                        channelStates[channel.channel_id]?.isEnabled ?? true
                      }
                      onChange={(e) => {
                        const newState = {
                          ...channelStates[channel.channel_id],
                          isEnabled: e.target.checked,
                        };
                        setChannelStates((prev) => ({
                          ...prev,
                          [channel.channel_id]: newState,
                        }));
                      }}
                      className="mr-2"
                    />
                    <label htmlFor={`isEnabled-${channel.channel_id}`}>
                      Enabled
                    </label>
                  </div>
                  <div className="mt-1 flex items-center">
                    <input
                      type="checkbox"
                      id={`forceClose-${channel.channel_id}`}
                      checked={
                        channelStates[channel.channel_id]?.forceClose ?? false
                      }
                      onChange={(e) => {
                        const newState = {
                          ...channelStates[channel.channel_id],
                          forceClose: e.target.checked,
                        };
                        setChannelStates((prev) => ({
                          ...prev,
                          [channel.channel_id]: newState,
                        }));
                      }}
                      className="mr-2"
                    />
                    <label htmlFor={`forceClose-${channel.channel_id}`}>
                      Force Close
                    </label>
                  </div>
                </div>

                <div className="flex">
                  <Button
                    className="ml-2"
                    onClick={() => updateChannel(channel.channel_id)}
                  >
                    Update Channel
                  </Button>
                  <Button
                    className="ml-2"
                    onClick={() => abandonChannel(channel.channel_id)}
                  >
                    Abandon Channel
                  </Button>
                  <Button
                    className="ml-2"
                    onClick={() => shutdownChannel(channel.channel_id)}
                  >
                    Shutdown Channel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {nodeInfo && (
        <>
          <div className="mt-4">
            <TextInput
              label="Peer Address"
              state={[peerAddress, setPeerAddress]}
              placeholder="/ip4/127.0.0.1/tcp/8119/p2p/QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo"
            />
          </div>
        </>
      )}

      <ButtonsPanel>
        {fiber && (
          <>
            <Button
              className="ml-2"
              onClick={listChannels}
              disabled={isLoading}
            >
              List Channels
            </Button>
          </>
        )}
      </ButtonsPanel>
    </div>
  );
}
