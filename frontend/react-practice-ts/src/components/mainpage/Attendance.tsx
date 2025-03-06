import { useEffect, useState } from 'react';
import styles from '../../styles/mainpage/Attendance.module.css';
import { useSelector } from 'react-redux';
import profileImg from '../../assets/images/icon/profile.png';
import axios from '../../utils/CustomAxios';

const Attendance = () => {
    const [time, setTime] = useState(new Date());
    const [preview, setPreview] = useState("");

    const url = "http://localhost:8003/workly/uploads/profile/";

    let user = useSelector((state) => {
        return state.user;
    });

    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        setPreview(user.changeName);
        return () => clearInterval(interval);
    }, []);

    const formatDate = (time) => {
        return time.toISOString().split("T")[0];
    };

    const formatTime = (time) => {
        const hours = String(time.getHours()).padStart(2, "0");
        const minutes = String(time.getMinutes()).padStart(2, "0");
        const seconds = String(time.getSeconds()).padStart(2, "0");
        return `${hours}:${minutes}:${seconds}`;
    };

    const insertAttendance = () => {
        if (!confirm("출근을 기록하시겠습니까?")) {
            return;
        }

        axios.get("http://localhost:8003/workly/insertAttendance", {
            params: {
                userNo: user.userNo
            }
        }).then((response) => {
            const date = formatTimestamp(response.data.date);
<<<<<<< HEAD
<<<<<<< HEAD
            const message = `${response.data.msg} ${date}`;
            alert(message);
        }).catch((error) => {
            const date = formatTimestamp(error.response.data.date);
            const message = `${error.response.data.msg} ${date}`;
            alert(message)
=======
            const message = `${response.data.msg}\n${date}`;
            alert(message);
        }).catch((error) => {
            alert(error.response.data.msg)
>>>>>>> b991b03 ((윤성) 출퇴근 기록 커밋 3.5(수))
=======
            const message = `${response.data.msg} ${date}`;
            alert(message);
        }).catch((error) => {
            const date = formatTimestamp(error.response.data.date);
            const message = `${error.response.data.msg} ${date}`;
            alert(message)
>>>>>>> b1eec7b ((윤성) 또커밋함 ㅈㅅ 3.5(수))
        })
    }

    const updateAttendance = () => {
        if (!confirm("퇴근을 기록하시겠습니까?")) {
            return;
        }

        axios.get("http://localhost:8003/workly/updateAttendance", {
            params: {
                userNo: user.userNo
            }
        }).then((response) => {
            const date = formatTimestamp(response.data.date);
<<<<<<< HEAD
<<<<<<< HEAD
            const message = `${response.data.msg} ${date}`;
            alert(message);
        }).catch((error) => {
            if(error.response.data.date) {
                const date = formatTimestamp(error.response.data.date);
                const message = `${error.response.data.msg} ${date}`;
                alert(message);
                return;
            }
            alert(error.response.data.msg);
=======
            const message = `${response.data.msg}\n${date}`;
            alert(message);
        }).catch((error) => {
            alert(error.response.data.msg)
>>>>>>> b991b03 ((윤성) 출퇴근 기록 커밋 3.5(수))
=======
            const message = `${response.data.msg} ${date}`;
            alert(message);
        }).catch((error) => {
            if(error.response.data.date) {
                const date = formatTimestamp(error.response.data.date);
                const message = `${error.response.data.msg} ${date}`;
                alert(message);
                return;
            }
            alert(error.response.data.msg);
>>>>>>> b1eec7b ((윤성) 또커밋함 ㅈㅅ 3.5(수))
        })
    }

    const formatTimestamp= (timestamp) =>{
        const date = new Date(timestamp);
        
        const month = date.getMonth() + 1;
        const day = date.getDate();
        
<<<<<<< HEAD
<<<<<<< HEAD
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
=======
        const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
>>>>>>> b991b03 ((윤성) 출퇴근 기록 커밋 3.5(수))
=======
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
>>>>>>> b1eec7b ((윤성) 또커밋함 ㅈㅅ 3.5(수))
        const weekday = weekdays[date.getDay()];
        
        const hour = date.getHours();
        const minute = date.getMinutes();
        
<<<<<<< HEAD
<<<<<<< HEAD
        return `${month}/${day}(${weekday}) ${hour}:${minute}`;
=======
        return `${month}/${day}(${weekday}) ${hour}:${minute}분`;
>>>>>>> b991b03 ((윤성) 출퇴근 기록 커밋 3.5(수))
=======
        return `${month}/${day}(${weekday}) ${hour}:${minute}`;
>>>>>>> b1eec7b ((윤성) 또커밋함 ㅈㅅ 3.5(수))
      }

    return (
        <div className={styles.widgetContainer}>
            <div className={styles.dateSection}>
                <div className={styles.date}>{formatDate(time)} ({["일", "월", "화", "수", "목", "금", "토"][time.getDay()]})</div>
                <div className={styles.time}>{formatTime(time)}</div>
            </div>
            <div className={styles.profile}>
                {!preview && <img src={profileImg} alt="profile" className={styles.avatar} />}
                {preview && <img src={url + preview} alt="preview" className={styles.avatar} />}
                <div className={styles.name}>{user.userName}</div>
                <div className={styles.position}>{user.deptName} {user.positionName}</div>
            </div>
            <div className={styles.buttons}>
                <button className={styles.checkIn} onClick={insertAttendance}>출근</button>
                <button className={styles.checkOut} onClick={updateAttendance}>퇴근</button>
            </div>
        </div>
    )
}

export default Attendance;