type WebRTCFactory = typeof import("@libp2p/webrtc").webRTC;

export const webRTC: WebRTCFactory = () => {
  throw new Error("WebRTC is only available in browsers");
};
