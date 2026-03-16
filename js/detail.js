const events = [
    {
        id: 1,
        code: "CNTT-01",
        name: "Hội thảo 'AI trong Giáo dục' - CLB Tin học",
        time: "08:30 - 11:30, Thứ 7, 20/05/2025",
        location: "Phòng A203, Cơ sở An Dương Vương",
        description: "Tìm hiểu ứng dụng trí tuệ nhân tạo trong giảng dạy và học tập. Diễn giả là chuyên gia từ Khoa Công nghệ thông tin. Chương trình gồm: thuyết trình, demo công cụ AI, thảo luận nhóm.",
        speaker: "TS.Nguyễn Văn A (Trưởng khoa CNTT) cùng các cộng sự."
    },
    {
        id: 2,
        code: "GDTH-02",
        name: "Workshop 'Phương pháp dạy học tích cực' - CLB Giáo dục Tiểu học",
        time: "14:00 - 17:00, Chủ nhật, 28/05/2025",
        location: "Hội trường D, Cơ sở An Dương Vương",
        description: "Chia sẻ các kỹ thuật dạy học lấy học sinh làm trung tâm, thực hành thiết kế hoạt động trải nghiệm. Workshop có sự tham gia của nhiều giảng viên giàu kinh nghiệm.",
        speaker: "TS. Nguyễn Thị B (Giảng viên Khoa Giáo dục Tiểu học)"
    },
    {
        id: 3,
        code: "VHNT-03",
        name: "Đêm nhạc Acoustic 'Giai điệu Sư phạm' - CLB Guitar",
        time: "19:00 - 21:30, Thứ 5, 01/06/2025",
        location: "Sân khấu ngoài trời, Ký túc xá",
        description: "Buổi biểu diễn âm nhạc học đường với sự tham gia của các bạn sinh viên yêu đàn hát. Các tiết mục đặc sắc, giao lưu văn nghệ.",
        speaker: "Nghệ sĩ guitar Nguyễn D (cựu sinh viên) cùng các bạn CLB Guitar"
    },
    {
        id: 4,
        code: "TDTT-04",
        name: "Giải bóng đá truyền thống 'Sư phạm Cup' - CLB Bóng đá",
        time: "07:30 - 17:00, Thứ 7, 10/06/2025",
        location: "Sân vận động trường",
        description: "Giải đấu dành cho các đội bóng đến từ các khoa, tranh cúp vô địch toàn trường. Sẽ có các trận đấu hấp dẫn, cổ động viên sôi động.",
        speaker: "Ban tổ chức giải và các trọng tài"
    },
    {
        id: 5,
        code: "TTDL-05",
        name: "Tọa đàm 'Du lịch xanh' - CLB Địa lý & Du lịch",
        time: "09:00 - 11:30, Thứ 3, 13/06/2025",
        location: "Giảng đường 19, Cơ sở Lê Văn Sỹ",
        description: "Thảo luận về xu hướng du lịch bền vững, bảo vệ môi trường tại các điểm du lịch, và cơ hội nghề nghiệp cho sinh viên ngành Du lịch.",
        speaker: "TS. Lê Hoàng C (Trưởng bộ môn Du lịch) cùng các diễn giả khách mời"
    }
];

function getEventIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

function findEventById(id) {
    return events.find(event => event.id == id);
}

function renderDetail() {
    const container = document.getElementById('detail-container');
    const eventId = getEventIdFromUrl();
    const event = findEventById(eventId);

    if (!event) {
        container.innerHTML = `
            <div class="error-message">
                ❌ Không tìm thấy sự kiện.<br>
                <a href="index.html" class="back-link" style="margin-top:15px;">← Quay lại danh sách</a>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="detail-table">
            <tr>
                <th>Tên sự kiện</th>
                <td><strong style="color:#003366; font-size:20px;">${event.name}</strong></td>
            </tr>
            <tr>
                <th>Mô tả</th>
                <td>${event.description}</td>
            </tr>
            <tr>
                <th>Diễn giả</th>
                <td><div class="speaker-highlight">🎤 ${event.speaker}</div></td>
            </tr>
            <tr>
                <th>Thời gian</th>
                <td>⏰ ${event.time}</td>
            </tr>
            <tr>
                <th>Địa điểm</th>
                <td>📍 ${event.location}</td>
            </tr>
        </table>

        <div class="register-section">
            <button class="register-btn" id="registerBtn">📝 Đăng ký tham gia</button>
        </div>

        <div style="text-align: center;">
            <a href="index.html" class="back-link">← Quay lại danh sách sự kiện</a>
        </div>
    `;

    
}

window.onload = renderDetail;