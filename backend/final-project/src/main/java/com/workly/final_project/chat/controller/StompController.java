package com.workly.final_project.chat.controller;
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

import com.workly.final_project.chat.model.dao.ChatDao;
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

    private final ChatDao chatDao;
    // 채팅 메세지 저장 및 전송 + 알림
    @MessageMapping("/chat/sendMessage/{chatRoomNo}")
    public void sendMessage(@DestinationVariable int chatRoomNo, @Payload Chat chat) {
        log.info(":말풍선: [WebSocket] 메시지 수신: roomNo={}, message={}", chatRoomNo, chat);
        


        try {
            // 1. DB 저장
            chatService.saveChatMessage(chat);
            log.info("[DB 저장 완료] 저장된 메시지: {}", chat);
        } catch (Exception e) {

            log.error(":x: [DB 저장 실패]", e);
            return; // 에러 났으면 뒤에 진행하지 않도록 중단
        }

        // 2. 기본 메시지 브로드캐스트
        messagingTemplate.convertAndSend("/sub/chatRoom/" + chatRoomNo, chat);

        // 3. unreadCount push: 메시지 전송 직후에도 각 메시지별 unread 정보 push
        List<Integer> affectedChatNos = chatService.getChatNosToUpdate(chatRoomNo, chat.getChatNo());
        for (Integer chatNo : affectedChatNos) {
            int unreadCount = chatService.getUnreadCount(chatRoomNo, chatNo);

            Map<String, Object> update = new HashMap<>();
            update.put("type", "UNREAD_UPDATE");
            update.put("chatNo", chatNo);
            update.put("unreadCount", unreadCount);

            messagingTemplate.convertAndSend("/sub/chatRoom/" + chatRoomNo, update);
        }

        // 4. 알림 (optional)
        List<Integer> unreadUserNos = chatService.getUnreadUserList(chatRoomNo, chat.getChatNo());
        log.info("알림 전송 대상: " + unreadUserNos);
        for (Integer userNo : unreadUserNos) {
            Map<String, String> notif = new HashMap<>();
            notif.put("message", "새 메시지가 도착했습니다 in room " + chatRoomNo);
            // /sub/notifications/{userNo} 로 보냄 → 사용자 세션 매핑 무관
            messagingTemplate.convertAndSend("/sub/notifications/" + userNo, notif);
            log.info("알림 전송 to /sub/notifications/{}: {}", userNo, notif);
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

    // 채팅방 나가기(진짜로 나가는거 x)
    @PostMapping("/api/chat/leave") // 관련 주소 exit에서 leave로 변경
    public ResponseEntity<String> exitChatRoom(@RequestBody UserChat userChat) {
        try {
            int userNo = userChat.getUserNo();
            int chatRoomNo = userChat.getChatRoomNo();
            // :흰색_확인_표시: 마지막으로 본 메시지 번호 가져오기
            int lastReadChatNo = chatService.getLastChatNo(chatRoomNo);
            userChat.setLastReadChatNo(lastReadChatNo);
            // :흰색_확인_표시: USER_CHAT 업데이트
            chatService.updateUserChat(userChat);
            log.info(":작은_파란색_다이아몬드: [Chat Exit] USER_CHAT 업데이트 (lastReadChatNo: {})", lastReadChatNo);
            return ResponseEntity.ok("채팅방 나가기 성공");
        } catch (Exception e) {
            log.error(":x: 채팅방 나가기 실패", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("채팅방 나가기 실패");
        }
    }
    @MessageMapping("/chat/enter")
    public void handleChatEnter(@Payload UserChat userChat) {
        log.info(" 채팅방 입장 처리: {}", userChat);

        // 1. 유저의 마지막 읽은 메시지 chatNo 업데이트
        chatService.updateUserChatStatus(
            userChat.getUserNo(), userChat.getChatRoomNo(), userChat.getLastReadChatNo()
        );

        // 2. 해당 chatNo 이하 메시지 전체 가져오기 (read 반영 후 기준)
        List<Integer> affectedChatNos = chatDao.getChatNosToUpdate(
            userChat.getChatRoomNo(), userChat.getLastReadChatNo()
        );

        // 3. 각 메시지에 대해 unread 수 계산 후 push
        for (Integer chatNo : affectedChatNos) {
            int unreadCount = chatService.getUnreadCount(userChat.getChatRoomNo(), chatNo);

            Map<String, Object> update = new HashMap<>();
            update.put("type", "UNREAD_UPDATE");
            update.put("chatNo", chatNo);
            update.put("unreadCount", unreadCount);

            messagingTemplate.convertAndSend("/sub/chatRoom/" + userChat.getChatRoomNo(), update);
        }
    }


    // 마지막으로 읽은 번호 가지고 오기
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
    
    
    @MessageMapping("/chat/read")
    public void handleChatRead(@Payload UserChat userChat) {
        log.info("읽음 처리 요청: {}", userChat);

        // 1. DB에 읽음 상태 업데이트
        chatService.updateUserChatStatus(userChat.getUserNo(), userChat.getChatRoomNo(), userChat.getLastReadChatNo());

        // 2. lastReadChatNo 이하의 메시지들 조회
        List<Integer> affectedChatNos = chatService.getChatNosToUpdate(userChat.getChatRoomNo(), userChat.getLastReadChatNo());

        // 3. 각 메시지에 대해 unreadCount 재계산 후 broadcast
        for (Integer chatNo : affectedChatNos) {
            int unreadCount = chatService.getUnreadCount(userChat.getChatRoomNo(), chatNo);

            Map<String, Object> updateMessage = new HashMap<>();
            updateMessage.put("type", "UNREAD_UPDATE");
            updateMessage.put("chatNo", chatNo);
            updateMessage.put("unreadCount", unreadCount);

            messagingTemplate.convertAndSend("/sub/chatRoom/" + userChat.getChatRoomNo(), updateMessage);
        }
    }

    
}