// StompContext.tsx
import React, { createContext, useContext, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import { RootState } from "./store";

const backendHost = "192.168.200.183";

const StompContext = createContext<Client | null>(null);

export const StompProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const clientRef = useRef<Client | null>(null);

  if (!clientRef.current) {
    const client = new Client({
      webSocketFactory: () =>
        new SockJS(`http://${backendHost}:8003/workly/ws-stomp`),
      reconnectDelay: 5000,
    });

    client.onConnect = () => {
      const userNo = useSelector((state: RootState) => state.user.userNo);
      client.subscribe(`/sub/notifications/${userNo}`, frame => {
        console.log("🔔 notification frame", frame.body);
        const { message } = JSON.parse(frame.body);
        toast.info(message);
      });
    };

    client.activate();
    clientRef.current = client;
  }

  return (
    <StompContext.Provider value={clientRef.current}>
      {children}
    </StompContext.Provider>
  );
};

export const useStompClient = (): Client => {
  const client = useContext(StompContext);
  if (!client) throw new Error("StompClient not initialized");
  return client;
};
