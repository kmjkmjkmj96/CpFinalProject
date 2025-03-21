package com.workly.final_project.chat.model.service;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.springframework.stereotype.Service;

//ChatPresenceService 예시
@Service
public class ChatPresenceService {
 private final ConcurrentMap<Integer, Set<Integer>> presenceMap = new ConcurrentHashMap<>();

 public void addUser(int chatRoomNo, int userNo) {
     presenceMap.computeIfAbsent(chatRoomNo, k -> ConcurrentHashMap.newKeySet()).add(userNo);
 }

 public void removeUser(int chatRoomNo, int userNo) {
     Set<Integer> users = presenceMap.get(chatRoomNo);
     if (users != null) {
         users.remove(userNo);
     }
 }

 public boolean isOnline(int chatRoomNo, int userNo) {
     Set<Integer> users = presenceMap.get(chatRoomNo);
     return users != null && users.contains(userNo);
 }
}

