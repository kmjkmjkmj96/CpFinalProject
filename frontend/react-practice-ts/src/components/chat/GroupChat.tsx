import { Client } from "@stomp/stompjs";
import { useEffect, useRef, useState } from "react";
import SockJS from "sockjs-client";
import axios from "axios";
import profile from "../../assets/Images/chat/profile.png";
import bell from "../../assets/Images/chat/bell.png";
import personplus from "../../assets/Images/chat/personPlus.png";
import exit from "../../assets/Images/chat/exit.png";
import { Member } from "../../type/chatType";
import dayjs from 'dayjs';
import 'dayjs/locale/ko'; 
import utc from "dayjs/plugin/utc";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


const backendHost = "192.168.200.125"; 



dayjs.extend(utc);


interface ChatRoom {
  chatRoomNo: number;
  roomTitle: string;
}

interface ChatMessage {
  chatNo: number;
  userNo: number;
  userName: string;
  chatRoomNo: number;
  message: string;
  receivedDate: string;
  isMine: boolean;
  lastReadChatNo?: number;
  unreadCount?:number;
}

interface NotificationData {
  message: string;
}

interface GroupChatProps {
  room: ChatRoom;
  currentUser: { userNo: number; userName: string };
  currentMembers: Member[];
  onChangeRoom: (newRoom: ChatRoom) => void;
  onClose: () => void;
  messages?: ChatMessage[];
  onToggleAlarm: (ChatRoom: number, bellSetting: string) => void;
  setIsAddMemberPanelOpen: (isOpen: boolean) => void; // 이미 선언됨
}

const GroupChat = ({
  room,
  currentUser,
  onClose,
  messages = [],
  setIsAddMemberPanelOpen
}: GroupChatProps) => {
  const [client, setClient] = useState<Client | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const subscriptionRef = useRef<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [lastReadChatNo, setLastReadChatNo] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  

  const showNotification = (notification : NotificationData) => {
    toast.info(`알림: ${notification.message}`, {
      position: "top-center",
      autoClose: 3000, // 3초 후 자동 종료
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  };
  
  // 스크롤 하단으로
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);
  


  // ✅ WebSocket 연결 및 메시지 수신
  useEffect(() => {
    const sock = new SockJS(`http://${backendHost}:8003/workly/ws-stomp`);
    const stompClient = new Client({
      webSocketFactory: () => sock,
      reconnectDelay: 5000,
      debug: (str) => console.log("🛠 [WebSocket Debug]:", str),
      connectHeaders: { userNo: currentUser.userNo.toString() },
      onConnect: () => {
        console.log("🟢 WebSocket Connected");
        
        // 채팅방 연결이 성공한 후, 온라인 상태 등록 (입장)
        stompClient.publish({
          destination: "/pub/chat/enter", // 서버측에서 @MessageMapping("/chat/enter")가 처리
          body: room.chatRoomNo.toString()
        });

        // 기존 구독 해제 (있다면)
        if (subscriptionRef.current) {
          stompClient.unsubscribe(subscriptionRef.current);
        }
  
        // 채팅방 메시지 구독: 해당 채팅방의 메시지 수신
        const chatSubscription = stompClient.subscribe(
          `/sub/chatRoom/${room.chatRoomNo}`,
          (message) => {
            const newMessage = JSON.parse(message.body);
            setChatMessages((prev) => [
              ...prev,
              {
                ...newMessage,
                isMine: newMessage.userNo === currentUser.userNo,
              },
            ]);
          }
        );
        
        subscriptionRef.current = chatSubscription.id;
  
        // 개별 알림 구독 (채팅방에 있지 않을 때 알림)
        stompClient.subscribe("/user/queue/notifications", (message) => {
          console.log("알림 수신:", message.body);
          const notification = JSON.parse(message.body);
          showNotification(notification);
        });
        setClient(stompClient);
      },
      onDisconnect: () => console.log("🔴 WebSocket Disconnected"),
    });
    stompClient.activate();
  
    return () => {
      if (subscriptionRef.current) {
        stompClient.unsubscribe(subscriptionRef.current);
      }
      stompClient.deactivate();
    };
  }, [room.chatRoomNo, currentUser.userNo]);
  

  // ✅ 날짜 및 시간 변환 함수
  
  const formatTime = (dateTimeString: string) => {
    if (!dateTimeString) return "";
    // UTC로 해석하지 않고, 지정한 포맷으로 바로 파싱합니다.
    return dayjs(dateTimeString, "YYYY-MM-DD HH:mm:ss").format("HH:mm");
  };
  
  function getDateKey(dateString: string): string | null {
    if (!dateString) return null;
    const parsed = dayjs(dateString, "YYYY-MM-DD HH:mm:ss");
    if (!parsed.isValid()) return null;
    return parsed.format("YYYY-MM-DD");
  }
  

  
  
// 스크롤 하단으로
useEffect(() => {
  if (chatContainerRef.current) {
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }
}, [chatMessages]);
  // 채팅 메시지 불러오기 (비동기 함수)
  const fetchMessages = async () => {
    try {
      const response = await axios.get(`http://${backendHost}:8003/workly/api/chat/messages/${room.chatRoomNo}`);
      
  
      // ✅ 각 메시지에 프로필 이미지 추가
      const messagesWithProfile = response.data.map((msg: ChatMessage) => ({
        ...msg,
        
        profileImg: profile, // 기본 프로필만
        isMine: msg.userNo === currentUser.userNo, // ✅ 내 메시지 여부
      }));
  
      setChatMessages(messagesWithProfile);
    } catch (error) {
      console.error("❌ 채팅 메시지 불러오기 실패:", error);
    }
  };

  
  useEffect(() => {
    fetchMessages(); 
  }, [room.chatRoomNo]);

  
  useEffect(() => {
    // 채팅방이 변경될 때 자동으로 읽음 상태 업데이트
    const updateReadStatus = async () => {
      try {
        await axios.put(`http://${backendHost}:8003/workly/api/chat/updateStatus/${room.chatRoomNo}/${currentUser.userNo}`);
        console.log("✅ [프론트엔드] 채팅방 입장 시 읽음 상태 업데이트 완료");
      } catch (error) {
        console.error("❌ [프론트엔드] 읽음 상태 업데이트 실패:", error);
      }
    };
  
    updateReadStatus();
  }, [room.chatRoomNo, currentUser.userNo]);
  


// 스크롤 하단으로
useEffect(() => {
  if (chatContainerRef.current) {
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }
}, [chatMessages]);
// ✅ 안 읽은 메시지 개수 가져오는 함수
const fetchUnreadMessages = async () => {
  try {
      const response = await axios.get(`http://${backendHost}:8003/workly/api/chat/unread/${room.chatRoomNo}/${currentUser.userNo}`);
      setUnreadCount(response.data);
  } catch (error) {
      console.error("❌ [프론트엔드] 안 읽은 메시지 개수 불러오기 실패", error);
  }
};
// 스크롤 하단으로
useEffect(() => {
  if (chatContainerRef.current) {
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }
}, [chatMessages]);
// ✅ 채팅방 입장 시 안 읽은 메시지 수 업데이트
useEffect(() => {
  fetchUnreadMessages();
}, [room.chatRoomNo, currentUser.userNo]);

  // ✅ 마지막 읽은 메시지 가져오기
  useEffect(() => {
    axios.get(`http://${backendHost}:8003/workly/api/chat/lastRead/${room.chatRoomNo}/${currentUser.userNo}`)
      .then(response => {
        setLastReadChatNo(response.data); // ✅ 데이터가 바로 정수값이므로 그대로 사용
      })
      .catch(() => setLastReadChatNo(null));
}, [room.chatRoomNo, currentUser.userNo]);


// 스크롤 하단으로
useEffect(() => {
  if (chatContainerRef.current) {
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }
}, [chatMessages]);
  // 프론트엔드 채팅 메세지 저장 로직 추가
  useEffect(() => {
    axios.get(`/chat/messages/${room.chatRoomNo}`)
      .then(response => {
        if (Array.isArray(response.data)) {
          setChatMessages(response.data);
          localStorage.setItem(`chatMessages_${room.chatRoomNo}`, JSON.stringify(response.data)); // ✅ 저장
        }
      })
      .catch(error => console.error("❌ 채팅 메시지 불러오기 실패", error));
  }, [room.chatRoomNo]);
  
  useEffect(() => {
    fetchMessages();
  }, []); // ✅ room.chatRoomNo 의존성 제거
  
  
  


  
// 스크롤 하단으로
useEffect(() => {
  if (chatContainerRef.current) {
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }
}, [chatMessages]);
  // 채팅방을 구독하는 모두에게 전송?
  const subscribeToChatRoom = () => {
    if (!client || !client.connected) return;

    // 채팅방 메시지 수신 구독 콜백 부분
    // 기존 subscribeToChatRoom 콜백 내
      client.subscribe(`/sub/chatRoom/${room.chatRoomNo}`, (message) => {
        const newMessage = JSON.parse(message.body);
        setChatMessages((prev) => [
            ...prev,
            { ...newMessage, isMine: newMessage.userNo === currentUser.userNo },
        ]);

        // 만약 수신된 메시지가 내가 보낸 메시지가 아니라면, 읽음 상태 업데이트를 호출
        if (newMessage.userNo !== currentUser.userNo) {
            updateUserChatStatus();
        }

        // 최신 unread 메시지 다시 불러오기
        fetchUnreadMessages();
      }, { userNo: currentUser.userNo.toString(), roomId: room.chatRoomNo.toString() });

    };

    // 새로 추가(presence)
    useEffect(() => {
      return () => {
        if (client && client.connected) {
          client.publish({
            destination: "/pub/chat/presenceExit", // 서버의 존재 제거 엔드포인트
            body: room.chatRoomNo.toString(),
          });
          console.log("STOMP: Presence exit published for room", room.chatRoomNo);
        }
      };
    }, [client, room.chatRoomNo]);
    
  
useEffect(() => {
  if (!client || !client.connected) return;

  if (subscriptionRef.current) {
      console.log("🔄 기존 구독 해제:", subscriptionRef.current);
      client.unsubscribe(subscriptionRef.current);
  }

  // 채팅 메시지 구독
  const chatSubscription = client.subscribe(`/sub/chatRoom/${room.chatRoomNo}`, (message) => {
      console.log("📩 새 메시지 수신:", message.body);
      const newMessage = JSON.parse(message.body);

      setChatMessages((prev) => [
          ...prev,
          { ...newMessage, isMine: newMessage.userNo === currentUser.userNo },
      ]);

      if (newMessage.userNo !== currentUser.userNo) {
          updateUserChatStatus(newMessage.chatNo);
      }
  });

  // 안 읽은 메시지 개수 업데이트 구독
  // unreadSubscription: 클라이언트 측에서 unreadCount 업데이트 구독
  const unreadSubscription = client.subscribe(`/sub/chat/unread/${room.chatRoomNo}`, (message) => {
    console.log("📩 안 읽은 메시지 개수 업데이트:", message.body);
    setUnreadCount(JSON.parse(message.body));
  });


  subscriptionRef.current = chatSubscription.id;

  return () => {
      chatSubscription.unsubscribe();
      unreadSubscription.unsubscribe();
  };
}, [room.chatRoomNo, client]);

  
  

  
  // ✅ 메시지 전송 함수
  const sendMessage = () => {
    if (!client || !client.connected || !inputMessage.trim()) return;
  
    const chatMessage = {
      chatRoomNo: room.chatRoomNo,
      userNo: currentUser.userNo,
      userName: currentUser.userName,
      message: inputMessage,
      receivedDate: dayjs().format("YYYY-MM-DD HH:mm:ss")

    };
  
    console.log("📤 [프론트엔드] WebSocket으로 메시지 전송:", chatMessage);
    try {
      client.publish({
        destination: `/pub/chat/sendMessage/${room.chatRoomNo}`,
        body: JSON.stringify(chatMessage),
      });
      console.log("✅ [프론트엔드] WebSocket 메시지 전송 성공");
      setInputMessage("");
      
      // 보내는 사람은 자신의 메시지는 바로 읽은 상태로 처리해야 함 → REST API 호출
      updateUserChatStatus();  
    } catch (error) {
      console.error("❌ [프론트엔드] WebSocket 메시지 전송 실패", error);
    }
  };
  
  

// exitChatRoom API 호출 함수
const exitChatRoomAPI = async () => {
  try {
    await axios.post(`http://localhost:8003/workly/api/chat/exit`, {
      chatRoomNo: room.chatRoomNo,
      userNo: currentUser.userNo,
      userName: currentUser.userName,
    });
    console.log("🚪 [프론트엔드] exitChatRoom 요청 완료");
    if (subscriptionRef.current && client) {
      client.unsubscribe(subscriptionRef.current);
    }
  } catch (error) {
    console.error("❌ [프론트엔드] exitChatRoom 요청 실패:", error);
  }
};

// 채팅방 나가기 (Exit) 처리 – exit 아이콘 클릭 시
const handleExit = async () => {
  if (window.confirm("채팅방을 나가시겠습니까?")) {
    
    await exitChatRoomAPI();
    alert("채팅방을 나갔습니다.");
    onClose(); // 채팅방 닫기 처리 (ChatList에서 해당 방 제거)
  }
};

// 채팅방 창 닫기 시 처리 – close 아이콘 클릭 시 (exit와 별개로 단순 창 닫기)
const handleClose = async () => {
  localStorage.removeItem(`chatMessages_${room.chatRoomNo}`);
  setChatMessages([]);
  setLastReadChatNo(null);
  onClose();
};



// 마지막 읽은 메세지 번호 업데이트
const updateUserChatStatus = async () => {
  try {
      await axios.put(`http://${backendHost}:8003/workly/api/chat/updateStatus/${room.chatRoomNo}/${currentUser.userNo}`);
      console.log("✅ [프론트엔드] updateUserChatStatus 요청 완료");
  } catch (error) {
      console.error("❌ [프론트엔드] updateUserChatStatus 요청 실패:", error);
  }
};

// ✅ 채팅방 입장 시 업데이트 실행
useEffect(() => {
    updateUserChatStatus();
}, [room.chatRoomNo, currentUser.userNo]);  // ✅ 채팅방이 변경될 때마다 실행


const isUnread = (msg: ChatMessage) => {
  return lastReadChatNo !== null && msg.chatNo > lastReadChatNo;
};

  

 return (
  <div className="group-chat" style={{ width: 390, height: 600, position: "relative" }}>
    <ToastContainer />
    <div
      className="groupchat-background"
      style={{ width: 390, height: 600, position: "absolute", background: "white", boxShadow: "0px 4px 4px rgba(0, 0, 0, 0.25)" }}
    />

    {/* 채팅방 이름 표시 */}
    <div
      className="groupchat-title"
      style={{ left: 20, top: 26, position: "absolute", color: "black", fontSize: 20, fontWeight: "700" }}
    >
      {room.roomTitle}
    </div>

    <div
      className="groupchat-close-icon"
      style={{ left: 359, top: 22, position: "absolute", cursor: "pointer" }}
      onClick={handleClose}
    >
      ←
    </div>

    <div
      ref={chatContainerRef}
      style={{
        position: "absolute",
        top: 75,
        left: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: 360,
        overflowY: "auto",
        height: 380,
      }}
    >
      {chatMessages.map((msg, index) => {
        // (1) 시스템 메시지 처리
        if (msg.userName === "SYSTEM") {
          return (
            <div
              key={msg.chatNo ? msg.chatNo : `sys-${index}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "10px 0",
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  backgroundColor: "#D3D3D3",
                  marginRight: "10px",
                }}
              />
              <span style={{ color: "#999", fontSize: "12px" }}>{msg.message}</span>
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  backgroundColor: "#D3D3D3",
                  marginLeft: "10px",
                }}
              />
            </div>
          );
        }

        // (2) 날짜 구분(날짜가 바뀌었을 때 divider + 날짜 표시)
        const prevMsg = chatMessages[index - 1];
        const currentDateKey = getDateKey(msg.receivedDate);
        const prevDateKey = prevMsg ? getDateKey(prevMsg.receivedDate) : null;
        const isNewDay = !prevMsg || (prevDateKey !== currentDateKey && currentDateKey);

        // (3) 이전 메시지와 같은 작성자인지 여부 (프로필 표시 여부)
        const isSameUserAsBefore = prevMsg && prevMsg.userNo === msg.userNo;
        // unread 여부 (isUnread 함수는 lastReadChatNo !== null && msg.chatNo > lastReadChatNo)
        const unread = isUnread(msg);

        // (4) 다음 메시지와 시간 비교하여 시간 표시 여부
        const nextMsg = chatMessages[index + 1];
        const showTime = !nextMsg || formatTime(nextMsg.receivedDate) !== formatTime(msg.receivedDate);

        return (
          <div
            key={msg.chatNo ? msg.chatNo : `msg-${index}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: msg.isMine ? "flex-end" : "flex-start",
              marginBottom: 10,
            }}
          >
            {isNewDay && currentDateKey && (
              <div
                className="dividerDate"
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: "15px",
                  width: "100%",
                }}
              >
                <div
                  className="left-divider"
                  style={{ flex: 1, height: "1px", backgroundColor: "#E0E0E0" }}
                />
                <div
                  className="noticechat-date"
                  style={{
                    margin: "0 10px",
                    color: "#4880FF",
                    fontSize: "11px",
                    fontFamily: "Roboto",
                    fontWeight: "500",
                    lineHeight: "10px",
                    letterSpacing: "0.5px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {dayjs(msg.receivedDate, "YYYY-MM-DD HH:mm:ss")
                    .format("YYYY년 MM월 DD일 dddd")}

                </div>
                <div
                  className="right-divider"
                  style={{ flex: 1, height: "1px", backgroundColor: "#E0E0E0" }}
                />
              </div>
            )}

            {/* (5) 수정된 안 읽은 메시지 표시: 메시지 시작 부분에, 내가 보낸 메시지이면 왼쪽, 남의 메시지이면 오른쪽에 표시 */}
            {(msg.unreadCount ?? 0) > 0 && (
            <div
              style={{
                fontSize: 10,
                color: "red",
                marginTop: 2,
                alignSelf: msg.isMine ? "flex-start" : "flex-end",
              }}
            >
              {msg.unreadCount}명 안 읽음
            </div>
          )}

            {/* (6) 프로필 이미지 표시 (내 메시지가 아닌 경우, 작성자가 바뀌었을 때) */}
            {!msg.isMine && !isSameUserAsBefore && (
              <div style={{ display: "flex", alignItems: "center", marginTop: "3px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    background: "#D9D9D9",
                    borderRadius: "25%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    cursor: "pointer",
                    marginRight: "8px",
                  }}
                >
                  <img
                    style={{ width: "22px", height: "22px", objectFit: "cover" }}
                    src={msg.profileImg || profile}
                    alt="profile"
                  />
                </div>
                <div style={{ marginTop: "0", fontSize: "15px", fontWeight: "bold", color: "#333" }}>
                  {msg.userName}
                </div>
              </div>
            )}

            {/* (7) 메시지 내용 및 시간 */}
            <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
              {!msg.isMine ? (
                <div
                  style={{
                    background: "#E9EBF1",
                    wordBreak: "break-word",
                    padding: "11px",
                    borderRadius: "7px",
                    fontSize: "12px",
                    color: "black",
                    maxWidth: "230px",
                    marginLeft: "50px",
                    marginBottom: "-5px",
                  }}
                >
                  {msg.message}
                </div>
              ) : (
                <div
                  style={{
                    background: "#D2E3FF",
                    padding: "11px",
                    borderRadius: "7px",
                    fontSize: "12px",
                    color: "black",
                    maxWidth: "230px",
                    wordBreak: "break-word",
                    marginRight: "5px",
                    marginBottom: "-5px",
                    marginTop: "2px",
                  }}
                >
                  {msg.message}
                </div>
              )}

              {showTime && (
                <div
                  style={{
                    fontSize: 10,
                    color: "#B3B3B3",
                    position: "absolute",
                    bottom: -20,
                    right: msg.isMine ? "0px" : "0",
                    left: msg.isMine ? "0px" : "50px",
                  }}
                >
                  {formatTime(msg.receivedDate)}
                </div>
              )}
            </div>

            
          </div>
        );
      })}
    </div>

    <img
      className="bell"
      //onClick={handleBellClick}
      style={{ cursor: "pointer", width: 30, height: 30, left: 23, top: 545, position: "absolute" }}
      src={bell}
      alt="icon"
    />
    <img
      className="personplus"
      onClick={() => {
        console.log("personplus 클릭: 부모 상태 업데이트 호출");
        setIsAddMemberPanelOpen(true);
      }}
      style={{
        width: 30,
        height: 30,
        left: 69,
        top: 545,
        position: "absolute",
        cursor: "pointer",
      }}
      src={personplus}
      alt="icon"
    />
    <img
      className="exit"
      onClick={handleExit}
      style={{ width: 30, height: 30, left: 116, top: 545, position: "absolute", cursor: "pointer" }}
      src={exit}
      alt="icon"
    />
    <textarea
      value={inputMessage}
      onChange={(e) => setInputMessage(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      }}
      placeholder="메세지 입력"
      maxLength={5000}
      style={{
        position: "absolute",
        bottom: 70,
        left: "20px",
        width: "350px",
        height: "60px",
        borderRadius: "5px",
        border: "1.5px solid #ccc",
        padding: "10px",
        fontSize: "14px",
        resize: "none",
        overflowY: "auto",
      }}
    />
    <div
      onClick={sendMessage}
      style={{
        position: "absolute",
        bottom: 23,
        left: 300,
        width: "70px",
        height: "35px",
        background: "#4880FF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontSize: "14px",
        borderRadius: "5px",
        cursor: "pointer",
      }}
    >
      전송
    </div>
  </div>
);

};

export default GroupChat;  