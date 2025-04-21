package com.workly.final_project.chat.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 메시지의 unreadCount가 변경되었을 때, 그 정보를 브로드캐스트하기 위한 DTO.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UnreadUpdateDTO {
    private int chatNo;       // 메시지 번호
    private int unreadCount;  // 새로 계산된 안 읽은 사용자 수
}
