"use client";

import { ccc } from "@ckb-ccc/connector";
import { EventName, createComponent } from "@lit/react";
import * as React from "react";

export const Connector = createComponent({
  tagName: "ccc-connector",
  elementClass: ccc.WebComponentConnector,
  react: React,
  events: {
    onClose: ccc.ConnectorCloseEvent
      .eventName as EventName<ccc.ConnectorCloseEvent>,
    onSelectClient: ccc.SelectClientEvent
      .eventName as EventName<ccc.SelectClientEvent>,
    onConnection: ccc.ConnectorConnectionEvent
      .eventName as EventName<ccc.ConnectorConnectionEvent>,
  },
});
