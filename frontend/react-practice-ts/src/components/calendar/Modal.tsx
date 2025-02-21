import React, { useState, useEffect } from "react";
import styles from "./Modal.module.css";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: any, type: string) => void;
  onDelete?: (eventId: string) => void;
  selectedEvent?: any;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, onSave, onDelete, selectedEvent }) => {
  const [selectedTab, setSelectedTab] = useState("내 일정"); // '내 일정' or '팀 일정'
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedColor, setSelectedColor] = useState("#000000");

  // 🌟 수정 모드인지 확인 (선택한 이벤트가 있으면 수정 모드)
  useEffect(() => {
    if (selectedEvent) {
      setEventTitle(selectedEvent.title);
      setEventDescription(selectedEvent.description || "");
      setStartDate(selectedEvent.start || "");
      setEndDate(selectedEvent.end || "");
      setSelectedColor(selectedEvent.backgroundColor || "#000000");
      setSelectedTab(selectedEvent.type || "내 일정");
    } else {
      resetForm();
    }
  }, [selectedEvent, isOpen]);

  // 🌟 입력값 초기화
  const resetForm = () => {
    setEventTitle("");
    setEventDescription("");
    setStartDate("");
    setEndDate("");
    setSelectedColor("#000000");
  };

  // 🌟 일정 저장 (새로운 일정 추가 & 기존 일정 수정)
  const handleSaveClick = () => {
    console.log(endDate);
    if (!eventTitle || !startDate || !endDate) {
      alert("제목과 날짜를 입력해주세요.");
      return;
    }

    const newEvent = {
      id: selectedEvent ? selectedEvent.id : Date.now().toString(),
      title: eventTitle,
      start: startDate,
      end: endDate,
      description: eventDescription,
      backgroundColor: selectedColor,
      borderColor: selectedColor,
      type: selectedTab,
    };

    onSave(newEvent, selectedTab);
    onClose();
  };

  // 🌟 일정 삭제
  const handleDeleteClick = () => {
    if (selectedEvent && onDelete) {
      onDelete(selectedEvent.id);
    }
    onClose();
  };

  if (!isOpen) return null; // 모달이 닫혀 있으면 렌더링하지 않음.

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        {/* 일정 구분 탭 */}
        <div className={styles.tabContainer}>
          <button
            className={`${styles.tabButton} ${selectedTab === "내 일정" ? styles.active : ""}`}
            onClick={() => setSelectedTab("내 일정")}
          >
            내 일정
          </button>
          <button
            className={`${styles.tabButton} ${selectedTab === "팀 일정" ? styles.active : ""}`}
            onClick={() => setSelectedTab("팀 일정")}
          >
            팀 일정
          </button>
        </div>

        {/* 날짜 선택 */}
        <div className={styles.formGroup}>
          <label>날짜 지정 *</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <span>시작</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <span>종료</span>
        </div>

        {/* 제목 입력 */}
        <div className={styles.formGroup}>
          <label>일정 제목 *</label>
          <input type="text" placeholder="제목을 입력하세요" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} />
        </div>

        {/* 내용 입력 */}
        <div className={styles.formGroup}>
          <label>일정 내용</label>
          <textarea placeholder="일정 내용을 입력하세요" value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} />
        </div>

        {/* 색상 선택 */}
        <div className={styles.formGroup}>
          <label>색 지정</label>
          <div className={styles.colorPicker}>
            {["#000000", "#FF6B6B", "#4C93FF", "#FFD93D", "#A10035", "#86C3F0", "#171717", "#563AD6"].map((color) => (
              <button key={color} className={styles.colorButton} style={{ backgroundColor: color, border: selectedColor === color ? "3px solid #000" : "none" }} onClick={() => setSelectedColor(color)} />
            ))}
          </div>
        </div>

        {/* 버튼 영역 */}
        <div className={styles.buttonGroup}>
          {selectedEvent ? (
            <>
              <button className={styles.deleteButton} onClick={handleDeleteClick}>일정 삭제</button>
              <button className={styles.saveButton} onClick={handleSaveClick}>일정 수정</button>
            </>
          ) : (
            <button className={styles.saveButton} onClick={handleSaveClick}>일정 등록</button>
          )}
          <button className={styles.cancelButton} onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
