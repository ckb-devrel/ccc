"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/src/components/Button";
import { TextInput } from "@/src/components/Input";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { useFiber } from "../../context/FiberContext";
import { hexToDecimal, decimalToHex } from '@/src/utils/hex';
import { shannonToCKB } from "../../utils/numbers"

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

export default function peerDetail() {
  const params = useParams();
  const peerId = params?.peerid as string;
  const { fiber } = useFiber();
  const [channels, setChannels] = useState<any[]>([]);
  const [channelStates, setChannelStates] = useState<Record<string, ChannelState>>({});
  const [isLoading, setIsLoading] = useState(false);
  const channelStatesRef = useRef(channelStates);
  const initialized = useRef(false);
 
  // 更新 ref 当 channelStates 改变时
  useEffect(() => {
    channelStatesRef.current = channelStates;
  }, [channelStates]);

  const listChannels = useCallback(async () => {
    if (!fiber) return;
    setIsLoading(true);
    try {
      const channelList = await fiber.listChannels();
      const filteredChannelList = channelList.filter((channel: any) => channel.peer_id === peerId);
      setChannels(filteredChannelList);
      
      // 只在需要时更新 channelStates
      const newChannelStates: Record<string, ChannelState> = {};
      let hasChanges = false;
      
      channelList.forEach((channel: any) => {
        const existingState = channelStatesRef.current[channel.channel_id];
        if (!existingState) {
          hasChanges = true;
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
          newChannelStates[channel.channel_id] = existingState;
        }
      });
      
      if (hasChanges) {
        setChannelStates(newChannelStates);
      }
    } catch (error) {
      console.error("Failed to list channels:", error);
    } finally {
      setIsLoading(false);
    }
  }, [fiber]); // 只依赖 fiber

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
            args: "0xcc015401df73a3287d8b2b19f0cc23572ac8b14d"
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
            args: "0xcc015401df73a3287d8b2b19f0cc23572ac8b14d"
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
  useEffect(() => {
    if (fiber && !initialized.current) {
      initialized.current = true;
      listChannels();
    }
  }, [fiber, listChannels]);

  return (
    <div className="flex w-9/12 flex-col items-center items-stretch gap-2">
        <>
        <h2 className="mb-2 text-lg font-bold">Peer Info</h2>
        <p>{peerId}</p>
        </>

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
                    {shannonToCKB(hexToDecimal(channel.local_balance).toString())}
                  </p>
                  <p>
                    <span className="font-semibold">Remote Balance:</span>{" "}
                    {shannonToCKB(hexToDecimal(channel.remote_balance).toString())}
                  </p>
                </div>
                <div>
                  <div className="mt-1">
                    <TextInput
                      label="Funding Amount (Decimal)"
                      state={[
                        shannonToCKB(hexToDecimal(channelStates[channel.channel_id]?.fundingAmount || "0xba43b7400").toString()),
                        (value) => {
                          const newState = {
                            ...channelStates[channel.channel_id],
                            fundingAmount: shannonToCKB(decimalToHex(parseInt(value) || 0)),
                          };
                          setChannelStates((prev) => ({
                            ...prev,
                            [channel.channel_id]: newState,
                          }));
                        },
                      ]}
                      placeholder="500"
                      type="number"
                    />
                  </div>
                  <div className="mt-1">
                    <TextInput
                      label="Fee Rate (Decimal)"
                      state={[
                        hexToDecimal(channelStates[channel.channel_id]?.feeRate || "0x3FC").toString(),
                        (value) => {
                          const newState = {
                            ...channelStates[channel.channel_id],
                            feeRate: decimalToHex(parseInt(value) || 0),
                          };
                          setChannelStates((prev) => ({
                            ...prev,
                            [channel.channel_id]: newState,
                          }));
                        },
                      ]}
                      placeholder="1020"
                      type="number"
                    />
                  </div>
                  <div className="mt-1">
                    <TextInput
                      label="TLC Expiry Delta (Decimal)"
                      state={[
                        hexToDecimal(channelStates[channel.channel_id]?.tlcExpiryDelta || "0x100").toString(),
                        (value) => {
                          const newState = {
                            ...channelStates[channel.channel_id],
                            tlcExpiryDelta: decimalToHex(parseInt(value) || 0),
                          };
                          setChannelStates((prev) => ({
                            ...prev,
                            [channel.channel_id]: newState,
                          }));
                        },
                      ]}
                      placeholder="256"
                      type="number"
                    />
                  </div>
                  <div className="mt-1">
                    <TextInput
                      label="TLC Minimum Value (Decimal)"
                      state={[
                        hexToDecimal(channelStates[channel.channel_id]?.tlcMinValue || "0x0").toString(),
                        (value) => {
                          const newState = {
                            ...channelStates[channel.channel_id],
                            tlcMinValue: decimalToHex(parseInt(value) || 0),
                          };
                          setChannelStates((prev) => ({
                            ...prev,
                            [channel.channel_id]: newState,
                          }));
                        },
                      ]}
                      placeholder="0"
                      type="number"
                    />
                  </div>
                  <div className="mt-1">
                    <TextInput
                      label="TLC Fee Proportional Millionths (Decimal)"
                      state={[
                        hexToDecimal(channelStates[channel.channel_id]?.tlcFeeProportionalMillionths || "0x0").toString(),
                        (value) => {
                          const newState = {
                            ...channelStates[channel.channel_id],
                            tlcFeeProportionalMillionths: decimalToHex(parseInt(value) || 0),
                          };
                          setChannelStates((prev) => ({
                            ...prev,
                            [channel.channel_id]: newState,
                          }));
                        },
                      ]}
                      placeholder="0"
                      type="number"
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

     

      <ButtonsPanel>
        {fiber && (
          <>
            <Button
              className="ml-2"
              onClick={listChannels}
              disabled={isLoading}
            >
              刷新列表
            </Button>
          </>
        )}
      </ButtonsPanel>
    </div>
  );
}
