import { Client } from "@stomp/stompjs";
import { useEffect, useRef, useState } from "react";
import SockJS from "sockjs-client";
import axios from "axios";
import profile from "../../assets/Images/chat/profile.png";
import bell from "../../assets/Images/chat/bell.png";
import personplus from "../../assets/Images/chat/personPlus.png";
import exit from "../../assets/Images/chat/exit.png";
import { Member, ChatRoom } from "../../type/chatType";
import dayjs from 'dayjs';
import 'dayjs/locale/ko'; 
import utc from "dayjs/plugin/utc";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';




const backendHost = "192.168.200.115"; 

dayjs.extend(utc);


interface ChatMessage {
  chatNo: number;
  userNo: number;
  userName: string;
  chatRoomNo: number;
  message: string;
  receivedDate: string;
  isMine: boolean;
  lastReadChatNo?: number;
  unreadCount?: number;
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
  setIsAddMemberPanelOpen
}: GroupChatProps) => {
  const [client, setClient] = useState<Client | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const subscriptionRef = useRef<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [lastReadChatNo, setLastReadChatNo] = useState<number | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<{ [chatNo: number]: number }>({});
  

  

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
      connectHeaders: {
        userNo: currentUser.userNo.toString(),
      },
      onConnect: () => {
        console.log("🟢 WebSocket Connected");
    
        if (subscriptionRef.current) {
          stompClient.unsubscribe(subscriptionRef.current);
        }
    
        const subscription = stompClient.subscribe(`/sub/chatRoom/${room.chatRoomNo}`, (message) => {
          console.log("📩 새 메시지 수신:", message.body);
          const newMessage = JSON.parse(message.body);
          setChatMessages((prev) => [
            ...prev,
            { ...newMessage, isMine: newMessage.userNo === currentUser.userNo },
          ]);
        });
    
        subscriptionRef.current = subscription.id;
        
        // 알림용 구독 추가 (개별 사용자 알림)
        stompClient.subscribe('/user/queue/notifications', (message) => {
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
}, [room.chatRoomNo]);


  // ✅ 날짜 및 시간 변환 함수
  const formatTime = (dateTimeString: string) => {
    if (!dateTimeString) return "";
    // “YYYY-MM-DD HH:mm:ss” 형식이 이미 KST라면, 그냥 그대로 포맷
    return dayjs(dateTimeString, "YYYY-MM-DD HH:mm:ss")
      .format("HH:mm");
  };

 // 날짜만 비교하기 위한 헬퍼 함수 (중복 제거)
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
      const profileMap = await fetchOtherProfiles(); // ✅ 나 제외 프로필 정보 가져오기
  
      // ✅ 각 메시지에 프로필 이미지 추가
      const messagesWithProfile = response.data.map((msg: ChatMessage) => ({
        ...msg,
        profileImg: profileMap[msg.userNo] || profile, // 기본 이미지 설정
        isMine: msg.userNo === currentUser.userNo, // ✅ 내 메시지 여부
      }));

      // 여기서 unreadCounts 초기값도 세팅
      const initialUnreadCounts: { [chatNo: number]: number } = {};
      response.data.forEach((msg: ChatMessage) => {
        if (typeof msg.unreadCount === "number") {
          initialUnreadCounts[msg.chatNo] = msg.unreadCount;
        }
      });
      setUnreadCounts(initialUnreadCounts);
  
      setChatMessages(messagesWithProfile);
    } catch (error) {
      console.error("❌ 채팅 메시지 불러오기 실패:", error);
    }
  };

  
  useEffect(() => {
    fetchMessages(); 
  }, [room.chatRoomNo]);

  // 나를 제외한 멤버들의 프로필 정보 가져오기
  const fetchOtherProfiles = async () => {
    try {
      const response = await axios.get(`http://${backendHost}:8003/workly/api/chat/membersWithoutMe`, {
        params: { chatRoomNo: room.chatRoomNo, userNo: currentUser.userNo },
      });
  
      console.log("📸 프로필 데이터:", response.data);
      
      // userNo를 key로 하는 객체 생성 (예: { 2: 'image_url', 3: 'image_url' })
      return response.data.reduce((acc: { [key: number]: string }, member: any) => {
        acc[member.userNo] = member.profileImg || profile;
        return acc;
      }, {});
  
    } catch (error) {
      console.error("❌ 프로필 이미지 가져오기 실패:", error);
      return {};
    }
  };
  


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
      setUnreadCounts(response.data);
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

    // ✅ UNREAD_UPDATE는 메시지 아님 → 무시하거나 별도로 처리
    if (newMessage.type === "UNREAD_UPDATE") {
      setUnreadCounts(prev => ({
        ...prev,
        [newMessage.chatNo]: newMessage.unreadCount
      }));
      return;
    }
    

    setChatMessages((prev) => [
        ...prev,
        { ...newMessage, isMine: newMessage.userNo === currentUser.userNo },
    ]);

    if (newMessage.userNo !== currentUser.userNo) {
        updateUserChatStatus(newMessage.chatNo);
    }
});

// 안 읽은 메시지 개수 업데이트 구독
const unreadSubscription = client.subscribe(`/sub/chat/unread/${room.chatRoomNo}`, (message) => {
    console.log("📩 안 읽은 메시지 개수 업데이트:", message.body);
    setUnreadCounts(JSON.parse(message.body));
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

  // 현재 한국 로컬시간을 UTC로 변환한 후 "YYYY-MM-DD HH:mm:ss"로 포맷
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




const updateUserChatStatus:any = async () => {
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

useEffect(() => {
  const savedCounts = localStorage.getItem(`unreadCounts_${room.chatRoomNo}`);
  if (savedCounts) {
    setUnreadCounts(JSON.parse(savedCounts));
  }
}, [room.chatRoomNo]);

useEffect(() => {
  localStorage.setItem(`unreadCounts_${room.chatRoomNo}`, JSON.stringify(unreadCounts));
}, [unreadCounts, room.chatRoomNo]);


// 실시간 채팅 상대방 안읽음 메세지 수 처리
// ✅ 새 메시지가 추가될 때마다, 안 읽은 메시지를 읽음 처리 
useEffect(() => {
  if (!client || !client.connected || chatMessages.length === 0) return;

  const unreadMessages = chatMessages.filter(
    (msg) =>
      msg.chatNo > (lastReadChatNo || 0) &&
      msg.userNo !== currentUser.userNo
  );

  if (unreadMessages.length === 0) return;

  const latestUnread = unreadMessages[unreadMessages.length - 1];

  if (lastReadChatNo && latestUnread.chatNo <= lastReadChatNo) return;

  const payload = {
    chatRoomNo: room.chatRoomNo,
    userNo: currentUser.userNo,
    lastReadChatNo: latestUnread.chatNo,
  };

  // ✅ read와 enter를 동시에 보내도 되지만 순서 주의
  client.publish({
    destination: "/pub/chat/read",
    body: JSON.stringify(payload),
  });

  // ✅ enter는 read 이후에
  setTimeout(() => {
    client.publish({
      destination: "/pub/chat/enter",
      body: JSON.stringify(payload),
    });
  }, 100); // 약간의 delay를 두면 더 안정적

  setLastReadChatNo(latestUnread.chatNo);
}, [chatMessages, client]);



  

  return (
    <div className="group-chat" style={{ width: 390, height: 600, position: "relative" }}>
    {/* ToastContainer는 페이지 어딘가에 있어야 함 */}
    <ToastContainer />
      <div className="groupchat-background" style={{ width: 390, height: 600, position: "absolute", background: "white", boxShadow: "0px 4px 4px rgba(0, 0, 0, 0.25)"}} />
        
       {/* 채팅방 이름 표시 */}
       <div className="groupchat-title" style={{ left: 20, top: 26, position: "absolute", color: "black", fontSize: 20, fontWeight: "700" }}>
        {room.roomTitle}
      </div>

      <div className="groupchat-close-icon" style={{ left: 359, top: 22, position: "absolute", cursor: "pointer" }}  onClick={handleClose}>←</div>

      <div ref={chatContainerRef} style={{ position: "absolute", top: 75, left: 20, display: "flex", flexDirection: "column", gap: 10, width: 360, overflowY: "auto", height: 380 }}>
      {chatMessages.map((msg, index) => {
    // (2) 시스템 메시지 처리
    if (msg.userName === "SYSTEM") {
      return (
        <div
        key={`sys-${index}`}
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

    // 이전 메시지 / 현재 메시지
    const prevMsg = chatMessages[index - 1];
    // 날짜 키(YYYY-MM-DD)만 뽑아서 비교
    const prevDateKey = prevMsg ? getDateKey(prevMsg.receivedDate) : null;
    const currentDateKey = getDateKey(msg.receivedDate);

    // 이전 메시지가 없거나, 날짜 키가 달라졌으면 새로운 날
    const isNewDay = !prevMsg || (prevDateKey !== currentDateKey && currentDateKey);

    const nextMsg = chatMessages[index + 1];
    const isSameUserAsBefore = prevMsg && prevMsg.userNo === msg.userNo;
    

    // 시간을 표시할지 여부 (다음 메시지와 시간이 같으면 표시 생략)
    const showTime =
      !nextMsg ||
      formatTime(nextMsg.receivedDate) !== formatTime(msg.receivedDate);

    return (
      <div
        key={`chat-${msg.chatNo}-${msg.userNo}`}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: msg.isMine ? "flex-end" : "flex-start",
          marginBottom: 10,
        }}
      >
        {/* 날짜가 바뀌었을 때만 divider + 날짜 */}
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
              style={{ flex: 1, height: "1px", background: "#E0E0E0" }}
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
                width: "auto",
              }}
            >
              {/* 원하는 형식으로 날짜 표시 (예: YYYY년 MM월 DD일 dddd) */}
              {dayjs
                .utc(msg.receivedDate, "YYYY-MM-DD HH:mm:ss")
                .locale("ko")
                .format("YYYY년 MM월 DD일 dddd")}
            </div>
            <div
              className="right-divider"
              style={{ flex: 1, height: "1px", background: "#E0E0E0" }}
            />
          </div>
        )}

            {/* ✅ 안 읽은 메시지 표시 */}
            {typeof unreadCounts[msg.chatNo] === 'number' && unreadCounts[msg.chatNo] > 0 && (
              <div style={{ fontSize: 10, color: "red", marginTop: 2, alignSelf: "flex-end" }}>
                안 읽은 메시지: {unreadCounts[msg.chatNo]}개
              </div>
            )}

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
                  {/* 서버에서 받은 프로필 이미지가 있으면 사용, 없으면 기본 이미지 사용 */}
                  <img
                    style={{ width: "22px", height: "22px", objectFit: "cover" }}
                    src={profile}
                    alt="profile"
                  />
                </div>
                <div style={{ marginTop: "0", fontSize: "15px", fontWeight: "bold", color: "#333" }}>
                  {msg.userName}
                </div>
              </div>
            )}


              <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
                {!msg.isMine && (
                  <div
                    style={{
                      background: "#E9EBF1",
                      wordBreak: "break-word",
                      padding: "11px",
                      borderRadius: "7px",
                      fontSize: "12px",
                      color: "black",
                      maxWidth: "230px",
                      marginLeft: !msg.isMine ? "50px" : "0px",
                      marginRight: msg.isMine ? "5px" : "0px",
                      marginBottom: "-5px"
                    }}
                  >
                    {msg.message}
                  </div>
                )}
                {msg.isMine && (
                  <div
                    style={{
                      background: "#D2E3FF",
                      padding: "11px",
                      borderRadius: "7px",
                      fontSize: "12px",
                      color: "black",
                      maxWidth: "230px",
                      wordBreak: "break-word",
                      marginLeft: "0px",
                      marginRight: "5px",
                      marginBottom: "-5px",
                      marginTop: "2px",
                    }}
                  >
                    {msg.message}
                  </div>
                )}

                {/* 시간 표시 */}
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
      
      

      <img className="bell" 
      //onClick={handleBellClick} 
      style={{ cursor: "pointer", width: 30, height: 30, left: 23, top: 545, position: "absolute" }} src={bell} alt="icon" />
        <img
        className="personplus"
        onClick={() => {
          console.log("personplus 클릭: 부모 상태 업데이트 호출");
          // 부모에서 전달받은 setIsAddMemberPanelOpen 함수 호출
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
              // Shift+Enter는 줄바꿈 허용, 단순 Enter면 전송
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
      <div onClick={sendMessage} style={{ position: "absolute", bottom: 23, left: 300, width: "70px", height: "35px", background: "#4880FF", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "14px", borderRadius: "5px", cursor: "pointer" }}>전송</div>
      
    </div>
  );
};

export default GroupChat;  