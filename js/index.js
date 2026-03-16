const events = [
    {
        id: 1,
        code: "CNTT-01",
        name: "Hội thảo 'AI trong Giáo dục' - CLB Tin học",
        time: "08:30 - 11:30, Thứ 7, 20/05/2025",
        location: "Phòng A203, Cơ sở An Dương Vương",
        description: "Tìm hiểu ứng dụng trí tuệ nhân tạo trong giảng dạy và học tập. Diễn giả là chuyên gia từ Khoa Công nghệ thông tin.",
        speaker: "PGS.TS Trần Văn Minh (Trưởng khoa CNTT)"
    },
    {
        id: 2,
        code: "GDTH-02",
        name: "Workshop 'Phương pháp dạy học tích cực' - CLB Giáo dục Tiểu học",
        time: "14:00 - 17:00, Chủ nhật, 28/05/2025",
        location: "Hội trường D, Cơ sở An Dương Vương",
        description: "Chia sẻ các kỹ thuật dạy học lấy học sinh làm trung tâm, thực hành thiết kế hoạt động trải nghiệm.",
        speaker: "TS. Nguyễn Thị Hồng (Giảng viên Khoa Giáo dục Tiểu học)"
    },
    {
        id: 3,
        code: "VHNT-03",
        name: "Đêm nhạc Acoustic 'Giai điệu Sư phạm' - CLB Guitar",
        time: "19:00 - 21:30, Thứ 5, 01/06/2025",
        location: "Sân khấu ngoài trời, Ký túc xá",
        description: "Buổi biểu diễn âm nhạc học đường với sự tham gia của các bạn sinh viên yêu đàn hát.",
        speaker: "Nghệ sĩ guitar Nguyễn Duy (cựu sinh viên)"
    },
    {
        id: 4,
        code: "TDTT-04",
        name: "Giải bóng đá truyền thống 'Sư phạm Cup' - CLB Bóng đá",
        time: "07:30 - 17:00, Thứ 7, 10/06/2025",
        location: "Sân vận động trường",
        description: "Giải đấu dành cho các đội bóng đến từ các khoa, tranh cúp vô địch toàn trường.",
        speaker: "Ban tổ chức giải"
    },
    {
        id: 5,
        code: "TTDL-05",
        name: "Tọa đàm 'Du lịch xanh' - CLB Địa lý & Du lịch",
        time: "09:00 - 11:30, Thứ 3, 13/06/2025",
        location: "Giảng đường 19, Cơ sở Lê Văn Sỹ",
        description: "Thảo luận về xu hướng du lịch bền vững, bảo vệ môi trường tại các điểm du lịch.",
        speaker: "TS. Lê Hoàng Nam (Trưởng bộ môn Du lịch)"
    }
];

function renderEventTable() {
    const tbody = document.getElementById('event-list');
    tbody.innerHTML = ''; 

    events.forEach(event => {
        const row = document.createElement('tr');

        const codeCell = document.createElement('td');
        codeCell.innerHTML = `<span class="event-code">${event.code}</span>`;

        const nameCell = document.createElement('td');
        nameCell.textContent = event.name;

        const timeCell = document.createElement('td');
        timeCell.textContent = event.time;

        const locationCell = document.createElement('td');
        locationCell.textContent = event.location;

        const actionCell = document.createElement('td');
        const detailLink = document.createElement('a');
        detailLink.href = `detail.html?id=${event.id}`;
        detailLink.className = 'detail-btn';
        detailLink.textContent = 'Xem chi tiết';
        actionCell.appendChild(detailLink);

        row.appendChild(codeCell);
        row.appendChild(nameCell);
        row.appendChild(timeCell);
        row.appendChild(locationCell);
        row.appendChild(actionCell);

        tbody.appendChild(row);
    });
}

window.onload = renderEventTable;