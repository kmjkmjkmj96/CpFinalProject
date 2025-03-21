package com.workly.final_project.chat.controller;
import java.security.Principal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.workly.final_project.chat.model.dto.ChatStatusUpdateDTO;
import com.workly.final_project.chat.model.service.ChatPresenceService;
import com.workly.final_project.chat.model.service.ChatService;
import com.workly.final_project.chat.model.vo.Chat;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
@RequiredArgsConstructor
@Slf4j
@RestController
public class StompController {
    private final ChatService chatService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ChatPresenceService chatPresenceService;
    
    // 채팅 메세지 저장 및 전송 + 알림
    @MessageMapping("/chat/sendMessage/{chatRoomNo}")
    public void sendMessage(@DestinationVariable int chatRoomNo, @Payload Chat chat) {
        log.info("[WebSocket] 메시지 수신: roomNo={}, message={}", chatRoomNo, chat);
        try {
            chatService.saveChatMessage(chat);
            log.info("[DB 저장 완료] 저장된 메시지: {}", chat);
        } catch (Exception e) {
            log.error("[DB 저장 실패]", e);
        }
        
        // unreadUserNos를 구한 후, 그 크기를 Chat 객체에 넣습니다.
        List<Integer> unreadUserNos = chatService.getUnreadUserList(chatRoomNo, chat.getChatNo());
        chat.setUnreadCount(unreadUserNos.size());  // 여기서 추가
        
        // 기존 채팅 메시지 전송 (실시간 반영) -> 이제 unreadCount가 포함됩니다.
        messagingTemplate.convertAndSend("/sub/chatRoom/" + chatRoomNo, chat);
        
        // 아래 알림 전송 부분은 그대로 둡니다.
        log.info("알림 전송 대상: " + unreadUserNos);
        for (Integer userNo : unreadUserNos) {
            Map<String, String> notif = new HashMap<>();
            notif.put("message", "새 메시지가 도착했습니다 in room " + chatRoomNo);
            messagingTemplate.convertAndSendToUser(String.valueOf(userNo), "/queue/notifications", notif);
            log.info("알림 전송: " + userNo);
        }
    }

    
    
 // NoticeChat 기본 채팅방 (chatRoomNo = 0) 실시간 메시지 처리 
    @MessageMapping("/noticeChat/sendMessage")
    public void sendNoticeChatMessage(@Payload Chat chat) {
        if (chat.getChatRoomNo() != 0) {
            log.warn("NoticeChat 메시지는 chatRoomNo가 0이어야 합니다.");
            return;
        }
        log.info("[NoticeChat] 메시지 수신: {}", chat);
        try {
            chatService.saveChatMessage(chat);
            log.info("[NoticeChat] 메시지 저장 완료: {}", chat);
        } catch (Exception e) {
            log.error("[NoticeChat] 메시지 저장 실패", e);
            return;
        }
        // 기본 채팅방 구독 경로: "/sub/noticeChat"
        messagingTemplate.convertAndSend("/sub/noticeChat", chat);
        
        // (선택사항) 알림 전송 처리
        List<Integer> unreadUserNos = chatService.getUnreadUserList(0, chat.getChatNo());
        for (Integer userNo : unreadUserNos) {
            Map<String, String> notif = new HashMap<>();
            notif.put("message", "새 메시지가 도착했습니다 in 사내 공지 톡방");
            messagingTemplate.convertAndSendToUser(String.valueOf(userNo), "/queue/notifications", notif);
        }
    }
    
 // 새로운 STOMP 엔드포인트: 상태 업데이트 요청 처리
    @MessageMapping("/chat/statusUpdate")
    public void updateStatus(@Payload ChatStatusUpdateDTO statusDTO) {
        log.info("STOMP 상태 업데이트 요청: {}", statusDTO);
        int result = chatService.updateMemberStatus(statusDTO.getUserNo(), statusDTO.getStatusType());
        if(result > 0) {
            String statusString = (statusDTO.getStatusType() == 2) ? "활성화" : "비활성";
            ChatStatusUpdateDTO updatedDTO = new ChatStatusUpdateDTO(statusDTO.getUserNo(), statusDTO.getStatusType(), statusString);
            messagingTemplate.convertAndSend("/sub/status", updatedDTO);
            log.info("상태 업데이트 브로드캐스트 완료: {}", updatedDTO);
        } else {
            log.error("상태 업데이트 실패: userNo={}, statusType={}", statusDTO.getUserNo(), statusDTO.getStatusType());
        }
    }

    @GetMapping("/api/chat/messages/{chatRoomNo}")
    public ResponseEntity<List<Chat>> getChatMessages(@PathVariable int chatRoomNo) {
        // 1) DB에서 메시지 목록 가져오기
        List<Chat> messages = chatService.getChatMessages(chatRoomNo);

        // 2) 각 메시지별로 unreadCount 계산
        for (Chat msg : messages) {
            List<Integer> unreadUsers = chatService.getUnreadUserList(chatRoomNo, msg.getChatNo());
            msg.setUnreadCount(unreadUsers.size());
        }

        return ResponseEntity.ok(messages);
    }

  

    
 // 마지막으로 읽은 번호 조회 (REST API)
    @GetMapping("/api/chat/lastRead/{chatRoomNo}/{userNo}")
    public ResponseEntity<Integer> getLastReadChatNo(
            @PathVariable int chatRoomNo,
            @PathVariable int userNo) {
        try {
            int lastReadChatNo = chatService.getLastReadChatNo(userNo, chatRoomNo);
            return ResponseEntity.ok(lastReadChatNo);
        } catch (Exception e) {
            log.error("[STOMP] lastReadChatNo 조회 실패", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(-1);
        }
    }
    
    @PostMapping("/api/chat/saveMessage")
    public ResponseEntity<?> saveChatMessage(@RequestBody Chat chat) {
        try {
            chatService.saveChatMessage(chat);
            return ResponseEntity.ok(chat);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("메시지 저장 실패");
        }
    }

    // STOMP 엔드포인트: 채팅방 입장 시 온라인 상태 등록
    @MessageMapping("/chat/enter")
    public void enterChatRoom(@Payload int chatRoomNo, Principal principal) {
        int userNo = Integer.parseInt(principal.getName());
        chatPresenceService.addUser(chatRoomNo, userNo);
        log.info("[STOMP] User {} entered chatRoom {}", userNo, chatRoomNo);
        
        // 사용자가 입장했으므로 해당 사용자의 USER_CHAT 업데이트를 수행
        chatService.enterChatRoom(userNo, chatRoomNo);
        
        // 입장 후 최신 unreadCount 재계산 및 브로드캐스트
        int lastChatNo = chatService.getLastChatNo(chatRoomNo);
        List<Integer> unreadUserNos = chatService.getUnreadUserList(chatRoomNo, lastChatNo);
        int unreadCount = unreadUserNos.size();
        messagingTemplate.convertAndSend("/sub/chat/unread/" + chatRoomNo, unreadCount);
    }

    
    // STOMP 엔드포인트: 채팅방에서 단순히 온라인 상태 제거 (실제 탈퇴와는 구분)
    @MessageMapping("/chat/presenceExit")
    public void presenceExitChatRoom(@Payload int chatRoomNo, Principal principal) {
        int userNo = Integer.parseInt(principal.getName());
        chatPresenceService.removeUser(chatRoomNo, userNo);
        log.info("[STOMP] User {} left presence in chatRoom {}", userNo, chatRoomNo);
    }
}