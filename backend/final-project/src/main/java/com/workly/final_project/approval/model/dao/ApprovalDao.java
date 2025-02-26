package com.workly.final_project.approval.model.dao;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;
import org.springframework.http.ResponseEntity;

import com.workly.final_project.approval.model.dto.ApprovalDTO;
import com.workly.final_project.approval.model.vo.Approval;
import com.workly.final_project.approval.model.vo.ApprovalAttachment;
import com.workly.final_project.approval.model.vo.ApprovalLine;
import com.workly.final_project.approval.model.vo.ApprovalMemo;

@Mapper
public interface ApprovalDao {
	int insertApproval(Approval approval);
	Approval selectApprovalById(int approvalNo);
	List<Approval> getAllApprovals();
	List<Map<String, Object>> getDepartmentsWithEmployees();

	List<Approval> getDraftApprovals();
	int deleteApprovals(List<Integer> approvalNos);
	int insertTempApproval(Approval approval);
	Approval getApprovalByNo(int approvalNo);

	Approval getApprovalData(int approvalNo);
	List<ApprovalLine> getApprovalLine(int approvalNo);
	List<ApprovalAttachment> getApprovalAttachmentByApprovalNo(int approvalNo);
	List<ApprovalMemo> getApprovalMemo(int approvalNo, int userNo);
	Approval getApprovalWriteUser(int userNo);
	
	// 예빈 추가 시작
	List<Approval> getApprovalRequests(int userNo);
	List<Approval> getApprovalFinishList(int userNo);
	List<Approval> getApprovalReference(int userNo);
	List<Approval> getApprovalSendList(int userNo);
	Integer countApprovalComplete(int userNo);
	Integer countApprovalRequest(int userNo);
	Integer countApprovalReference(int userNo);
	Integer countApprovalReceive(int userNo);
	Integer countApprovalReject(int userNo);
	
	// 예빈 추가 끝

	
}
