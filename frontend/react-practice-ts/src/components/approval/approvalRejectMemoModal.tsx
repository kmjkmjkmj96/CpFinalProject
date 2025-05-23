import axios from "axios";
import { useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
export const ApprovalRejectMemoModal = ({ onClose, onSave, approvalNo }:any) => {

  const userNo = useSelector((state: any) => state.user.userNo);
  console.log("footer에서 받은 approvalNo값:", approvalNo);
  const [memoContent, setMemocontent] = useState("");
  const navigate = useNavigate();

  const handleReject = async () => {
    try{
      // 1. 반려 처리 요청(APPROVAL + APPROVAL_LINE 상태 변경)
      await axios.post("http://localhost:8003/workly/api/approval/reject", null,{
        params: {
            approvalNo: approvalNo,
            userNo: userNo,
        }
      })

      // 2. 메모 저장 요청 (userNo 업데이트 후 실행)
      setTimeout(async () => {
        if (memoContent.trim() !== "") {
          await axios.post("http://localhost:8003/workly/api/approvalMemos/create", {
            approvalNo: approvalNo,
            userNo: userNo, // 이제 정상적으로 값이 들어감
            memoContent: memoContent,
          });
        }

        alert("결재 문서가 반려되었습니다.");

        // 3. 반려 완료 후 이동
        onSave(memoContent);
        navigate(`/approvalRejectpage`);
        setTimeout(() => {
          window.location.reload();
        });

      }, 100); // 100ms(0.1초) 지연 후 실행

    } catch (error) {
      console.error("반려 또는 메모 저장 실패:", error);
      alert("반려 처리 중 오류가 발생했습니다.");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "rgba(0, 0, 0, 0.5)", // 반투명 배경 추가
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "442px", // :흰색_확인_표시: 모달 크기 조정
          background: "white",
          borderRadius: "8px",
          border: "1px solid #ccc",
          display: "flex",
          flexDirection: "column",
          padding: "20px",
          position: "relative",
          boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)", // :흰색_확인_표시: 그림자 추가
        }}
      >
        {/* 닫기 버튼 (오른쪽 상단) */}
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            cursor: "pointer",
          }}
          onClick={onClose}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12.25 2.5L2.75 12.5M2.75 2.5L12.25 12.5"
              stroke="#1E1E1E"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        {/* 타이틀 */}
        <div
          style={{
            fontSize: "18px",
            fontWeight: "700",
            marginBottom: "15px",
          }}
        >
          반려사유
        </div>
        {/* 내용 타이틀 */}
        <div
          style={{
            fontSize: "14px",
            fontWeight: "600",
            marginBottom: "5px",
          }}
        >
        </div>
        {/* 입력 필드 */}
        <textarea
          value={memoContent}
          onChange={(e) => setMemocontent(e.target.value)}
          placeholder="반려사유를 입력하세요"
          style={{
            width: "100%",
            height: "100px", // :흰색_확인_표시: 입력 필드 크기 조정
            borderRadius: "4px",
            border: "1px solid #ccc",
            padding: "10px",
            fontSize: "14px",
            resize: "none",
            overflowY: "auto",
            background: "#FAFAFA", // :흰색_확인_표시: 약간의 배경색 추가
          }}
        />
        {/* 버튼 */}
        <button
          style={{
            width: "100%", // :흰색_확인_표시: 버튼 크기 조정
            height: "40px",
            background: "#ff6b6b",
            borderRadius: "8px",
            border: "none",
            color: "white",
            fontSize: "16px",
            fontWeight: "600",
            cursor: "pointer",
            marginTop: "15px",
          }}
          onClick={handleReject}
        >
          저장
        </button>
      </div>
    </div>
  );
};